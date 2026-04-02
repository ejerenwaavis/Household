/**
 * Natural Language Query Service
 * Allows users to ask financial questions in plain English.
 * Uses OpenAI to classify intent + extract parameters, then executes
 * pre-approved read-only queries, and formats results naturally.
 */

import OpenAI from 'openai';
import Expense from '../models/Expense.js';
import Income from '../models/Income.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import BankTransaction from '../models/BankTransaction.js';
import FixedExpense from '../models/FixedExpense.js';
import Goal from '../models/Goal.js';
import logger from '../utils/logger.js';

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const VALID_INTENTS = [
  'spending_by_category',
  'spending_total',
  'income_total',
  'top_expenses',
  'goal_progress',
  'fixed_expenses_list',
  'savings_rate',
  'transaction_search',
  'unknown',
];

/**
 * Use OpenAI to parse the user question into a structured intent.
 * Falls back to 'unknown' if OpenAI is unavailable.
 */
async function parseIntent(question, defaultMonth) {
  if (!openai) {
    return { intent: 'unknown', month: defaultMonth, category: null, keyword: null };
  }

  try {
    const prompt = `Parse this financial question into a JSON object with these fields:
- intent: one of ${VALID_INTENTS.join(', ')}
- month: YYYY-MM string if mentioned, otherwise "${defaultMonth}"
- category: spending category if mentioned (Groceries, Dining, Gas, Medical, Shopping, Transportation, Subscriptions, Utilities, Housing, Transfer, Income, Other), or null
- keyword: a search keyword for transaction_search intent, or null

User question: "${question}"

Reply with ONLY a valid JSON object.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    // Validate intent against whitelist
    const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'unknown';
    return {
      intent,
      month: /^\d{4}-\d{2}$/.test(parsed.month) ? parsed.month : defaultMonth,
      category: typeof parsed.category === 'string' ? parsed.category : null,
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : null,
    };
  } catch (err) {
    logger.warn('[NLQuery] Intent parsing failed:', err.message);
    return { intent: 'unknown', month: defaultMonth, category: null, keyword: null };
  }
}

/**
 * Execute a safe read-only query based on intent and return structured data.
 */
async function executeIntent(householdId, { intent, month, category, keyword }) {
  switch (intent) {
    case 'spending_by_category': {
      const query = { householdId, month };
      if (category) query.category = category;
      const expenses = await Expense.find(query).lean();
      const byCategory = {};
      for (const e of expenses) {
        const cat = e.category || 'Other';
        byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
      }
      return { type: 'spending_by_category', month, byCategory, total: Object.values(byCategory).reduce((s, v) => s + v, 0) };
    }

    case 'spending_total': {
      const expenses = await Expense.find({ householdId, month }).lean();
      const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      return { type: 'spending_total', month, total };
    }

    case 'income_total': {
      const incomes = await Income.find({ householdId, month }).lean();
      const total = incomes.reduce((s, inc) => {
        const weeklyTotal = inc.dailyBreakdown?.reduce((a, d) => a + d.amount, 0) || inc.weeklyTotal || 0;
        return s + weeklyTotal;
      }, 0);
      return { type: 'income_total', month, total };
    }

    case 'top_expenses': {
      const expenses = await Expense.find({ householdId, month })
        .sort({ amount: -1 })
        .limit(5)
        .lean();
      return { type: 'top_expenses', month, expenses: expenses.map((e) => ({ description: e.description || e.category, amount: e.amount, category: e.category })) };
    }

    case 'goal_progress': {
      const goals = await Goal.find({ householdId, isActive: true }).lean();
      return { type: 'goal_progress', goals: goals.map((g) => ({ name: g.name, target: g.targetAmount, saved: g.currentAmount || 0, pct: g.targetAmount ? Math.round(((g.currentAmount || 0) / g.targetAmount) * 100) : 0 })) };
    }

    case 'fixed_expenses_list': {
      const fixed = await FixedExpense.find({ householdId, isActive: true }).lean();
      const total = fixed.reduce((s, f) => s + (f.amount || 0), 0);
      return { type: 'fixed_expenses_list', fixed: fixed.map((f) => ({ name: f.name, amount: f.amount, frequency: f.frequency })), total };
    }

    case 'savings_rate': {
      const [expenses, incomes] = await Promise.all([
        Expense.find({ householdId, month }).lean(),
        Income.find({ householdId, month }).lean(),
      ]);
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalIncome = incomes.reduce((s, inc) => s + (inc.dailyBreakdown?.reduce((a, d) => a + d.amount, 0) || inc.weeklyTotal || 0), 0);
      const rate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
      return { type: 'savings_rate', month, totalIncome, totalExpenses, rate };
    }

    case 'transaction_search': {
      if (!keyword) return { type: 'transaction_search', results: [] };
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [bankTxns, plaidTxns] = await Promise.all([
        BankTransaction.find({ householdId, month, description: regex }).limit(10).lean(),
        PlaidTransaction.find({ householdId, $or: [{ name: regex }, { merchant: regex }, { description: regex }] }).limit(10).lean(),
      ]);
      const results = [
        ...bankTxns.map((t) => ({ source: 'uploaded', date: t.date, description: t.description, amount: t.amount, category: t.category })),
        ...plaidTxns.map((t) => ({ source: 'plaid', date: t.date, description: t.description || t.name, amount: t.amount, category: t.userCategory || t.primaryCategory })),
      ];
      return { type: 'transaction_search', keyword, results };
    }

    default:
      return { type: 'unknown' };
  }
}

/**
 * Format the structured data result into a human-readable answer using OpenAI.
 * Falls back to a plain text summary if OpenAI is unavailable.
 */
async function formatAnswer(question, data) {
  const dataStr = JSON.stringify(data, null, 2);

  if (!openai) {
    // Simple fallback formatting
    if (data.type === 'spending_total') return `Your total spending for ${data.month} was $${(data.total || 0).toFixed(2)}.`;
    if (data.type === 'income_total') return `Your total income for ${data.month} was $${(data.total || 0).toFixed(2)}.`;
    if (data.type === 'savings_rate') return `Your savings rate for ${data.month} was ${data.rate}% (income $${(data.totalIncome || 0).toFixed(2)}, expenses $${(data.totalExpenses || 0).toFixed(2)}).`;
    return `Here is your financial data: ${dataStr}`;
  }

  try {
    const prompt = `A user asked: "${question}"

Here is the relevant financial data:
${dataStr}

Write a short, friendly, plain-English answer (1-3 sentences). Be specific with dollar amounts. Do not mention JSON or data structures.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 150,
    });

    return completion.choices[0]?.message?.content?.trim() || 'I was unable to generate an answer.';
  } catch (err) {
    logger.warn('[NLQuery] Answer formatting failed:', err.message);
    return `I found some data but couldn't format the answer: ${dataStr}`;
  }
}

/**
 * Main entry point: process a natural language financial question.
 */
export async function answerFinancialQuestion(householdId, question) {
  if (!question || typeof question !== 'string' || question.length > 500) {
    return { answer: 'Please ask a specific financial question (up to 500 characters).', data: null };
  }

  const month = currentMonth();
  const parsed = await parseIntent(question, month);

  logger.info('[NLQuery] Processing question:', { householdId, intent: parsed.intent, month: parsed.month });

  const data = await executeIntent(householdId, parsed);
  const answer = await formatAnswer(question, data);

  return { answer, data, intent: parsed.intent, month: parsed.month };
}
