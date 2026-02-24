/**
 * AI Insights Service
 * Generates financial insights using rule-based analysis + optional OpenAI enhancement
 */

import OpenAI from 'openai';
import Expense from '../models/Expense.js';
import Income from '../models/Income.js';
import FixedExpense from '../models/FixedExpense.js';
import Goal from '../models/Goal.js';
import InsightCache from '../models/InsightCache.js';

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const CACHE_TTL_HOURS = 6;

// ============================================================
// Data Collection Helpers
// ============================================================

async function collectHouseholdData(householdId, months = 3) {
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const [expenses, incomes, fixedExpenses, goals] = await Promise.all([
    Expense.find({ householdId, month: { $in: monthKeys } }).lean(),
    Income.find({ householdId, month: { $in: monthKeys } }).lean(),
    FixedExpense.find({ householdId, isActive: true }).lean(),
    Goal.find({ householdId, isActive: true }).lean(),
  ]);

  return { expenses, incomes, fixedExpenses, goals, monthKeys };
}

// ============================================================
// Task 12.1: Spending Patterns Analysis
// ============================================================

export function analyzeSpendingPatterns(expenses, monthKeys) {
  const byCategory = {};
  const byMonth = {};

  for (const exp of expenses) {
    const cat = exp.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    byMonth[exp.month] = (byMonth[exp.month] || 0) + exp.amount;
  }

  // Sort categories by spend
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }));

  // Month over month trend
  const monthlyTotals = monthKeys.map(m => ({ month: m, total: Math.round((byMonth[m] || 0) * 100) / 100 }));
  const trend = monthlyTotals.length >= 2
    ? monthlyTotals[0].total - monthlyTotals[1].total
    : 0;

  return {
    topCategories,
    monthlyTotals,
    trend: Math.round(trend * 100) / 100,
    trendDirection: trend > 50 ? 'up' : trend < -50 ? 'down' : 'stable',
    totalSpent: Math.round(Object.values(byCategory).reduce((a, b) => a + b, 0) * 100) / 100,
  };
}

// ============================================================
// Task 12.2: Budget Recommendations
// ============================================================

export function generateBudgetRecommendations(expenses, incomes, fixedExpenses) {
  const totalIncome = incomes.reduce((sum, inc) => {
    return sum + (inc.dailyBreakdown?.reduce((s, d) => s + d.amount, 0) || inc.weeklyTotal || 0);
  }, 0);

  const totalFixed = fixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);
  const totalVariable = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const recommendations = [];

  // Savings rate check
  if (savingsRate < 10) {
    recommendations.push({
      type: 'warning',
      title: 'Low Savings Rate',
      message: `You're saving only ${savingsRate.toFixed(1)}% of income. Aim for at least 20%.`,
      action: 'Review your variable expenses to find areas to cut.',
      priority: 'high',
    });
  } else if (savingsRate >= 20) {
    recommendations.push({
      type: 'success',
      title: 'Great Savings Rate',
      message: `You're saving ${savingsRate.toFixed(1)}% of income — above the 20% benchmark!`,
      action: 'Consider investing the surplus in your goals.',
      priority: 'low',
    });
  }

  // Fixed expenses as % of income
  const fixedRatio = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;
  if (fixedRatio > 50) {
    recommendations.push({
      type: 'warning',
      title: 'High Fixed Expenses',
      message: `Fixed expenses are ${fixedRatio.toFixed(1)}% of income. Consider reducing recurring costs.`,
      action: 'Review subscriptions and recurring bills for things you can cut.',
      priority: 'medium',
    });
  }

  // Category-specific 50/30/20 rule
  const needsCategories = ['Housing', 'Utilities', 'Food', 'Transportation', 'Medical'];
  const needsTotal = expenses
    .filter(e => needsCategories.includes(e.category))
    .reduce((s, e) => s + e.amount, 0) + totalFixed;
  const needsRatio = totalIncome > 0 ? (needsTotal / totalIncome) * 100 : 0;

  if (needsRatio > 50) {
    recommendations.push({
      type: 'info',
      title: '50/30/20 Rule Check',
      message: `Your needs are ${needsRatio.toFixed(1)}% of income (target: 50% or less).`,
      action: 'Try to keep essential expenses at or below half your income.',
      priority: 'medium',
    });
  }

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalFixed: Math.round(totalFixed * 100) / 100,
    totalVariable: Math.round(totalVariable * 100) / 100,
    savingsRate: Math.round(savingsRate * 100) / 100,
    recommendations,
  };
}

// ============================================================
// Task 12.3: Anomaly Detection
// ============================================================

export function detectAnomalies(expenses, monthKeys) {
  const anomalies = [];
  if (monthKeys.length < 2) return anomalies;

  const currentMonth = monthKeys[0];
  const currentExpenses = expenses.filter(e => e.month === currentMonth);
  const priorExpenses = expenses.filter(e => e.month !== currentMonth);

  // Build average by category from prior months
  const priorByCategory = {};
  for (const exp of priorExpenses) {
    const cat = exp.category || 'Uncategorized';
    if (!priorByCategory[cat]) priorByCategory[cat] = [];
    priorByCategory[cat].push(exp.amount);
  }

  const priorAvg = {};
  for (const [cat, amounts] of Object.entries(priorByCategory)) {
    priorAvg[cat] = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  }

  // Check current month for spikes
  const currentByCategory = {};
  for (const exp of currentExpenses) {
    const cat = exp.category || 'Uncategorized';
    currentByCategory[cat] = (currentByCategory[cat] || 0) + exp.amount;
  }

  for (const [cat, total] of Object.entries(currentByCategory)) {
    const avg = priorAvg[cat];
    if (avg && total > avg * 1.5 && total - avg > 50) {
      anomalies.push({
        category: cat,
        currentTotal: Math.round(total * 100) / 100,
        priorAverage: Math.round(avg * 100) / 100,
        percentIncrease: Math.round(((total - avg) / avg) * 100),
        message: `${cat} spending is ${Math.round(((total - avg) / avg) * 100)}% above average this month.`,
        severity: total > avg * 2 ? 'high' : 'medium',
      });
    }
  }

  return anomalies.sort((a, b) => b.percentIncrease - a.percentIncrease);
}

// ============================================================
// Task 12.4: Metrics Calculations
// ============================================================

export function calculateMetrics(expenses, incomes, fixedExpenses, goals) {
  const totalIncome = incomes.reduce((sum, inc) => {
    return sum + (inc.dailyBreakdown?.reduce((s, d) => s + d.amount, 0) || inc.weeklyTotal || 0);
  }, 0);
  const totalVarExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFixed = fixedExpenses.reduce((sum, fe) => sum + fe.amount, 0);
  const netSavings = totalIncome - totalVarExpenses - totalFixed;

  const goalProgress = goals.map(g => ({
    name: g.name,
    progress: g.target > 0 ? Math.round((g.currentBalance / g.target) * 100) : 0,
    currentBalance: g.currentBalance,
    target: g.target,
    monthsToGoal: g.monthlyContribution > 0
      ? Math.ceil((g.target - g.currentBalance) / g.monthlyContribution)
      : null,
  }));

  const debtToIncomeRatio = totalIncome > 0 ? (totalFixed / totalIncome) * 100 : 0;

  return {
    netSavings: Math.round(netSavings * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round((totalVarExpenses + totalFixed) * 100) / 100,
    savingsRate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 10000) / 100 : 0,
    debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100,
    goalProgress,
  };
}

// ============================================================
// OpenAI Enhancement (optional, graceful fallback)
// ============================================================

async function generateAISummary(data) {
  if (!openai) return null;

  try {
    const prompt = `You are a personal finance advisor. Based on this household financial data, provide 2-3 short, actionable insights in plain English. Be specific and friendly.

Data:
- Monthly income: $${data.metrics.totalIncome}
- Monthly expenses: $${data.metrics.totalExpenses}
- Savings rate: ${data.metrics.savingsRate}%
- Top spending categories: ${data.patterns.topCategories.map(c => `${c.category} ($${c.total})`).join(', ')}
- Spending trend: ${data.patterns.trendDirection} (${data.patterns.trend > 0 ? '+' : ''}$${data.patterns.trend} vs last month)
- Active anomalies: ${data.anomalies.length} unusual spending patterns detected

Respond with a JSON array of exactly 3 objects: [{ "title": "...", "insight": "...", "emoji": "..." }]`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.insights || parsed.data || null);
  } catch (err) {
    console.warn('[AIInsights] OpenAI call failed, using rule-based fallback:', err.message);
    return null;
  }
}

// ============================================================
// Main: Generate Full Insights Report
// ============================================================

export async function generateInsights(householdId) {
  // Check cache
  const cached = await InsightCache.findOne({ householdId });
  if (cached && cached.generatedAt) {
    const ageHours = (Date.now() - cached.generatedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < CACHE_TTL_HOURS) {
      return { ...cached.data, fromCache: true, cachedAt: cached.generatedAt };
    }
  }

  const { expenses, incomes, fixedExpenses, goals, monthKeys } = await collectHouseholdData(householdId, 3);

  const patterns = analyzeSpendingPatterns(expenses, monthKeys);
  const budget = generateBudgetRecommendations(expenses, incomes, fixedExpenses);
  const anomalies = detectAnomalies(expenses, monthKeys);
  const metrics = calculateMetrics(expenses, incomes, fixedExpenses, goals);

  const result = { patterns, budget, anomalies, metrics };

  // Try OpenAI enhancement
  const aiSummary = await generateAISummary(result);
  result.aiSummary = aiSummary;
  result.aiEnabled = !!aiSummary;
  result.generatedAt = new Date();

  // Cache the result
  await InsightCache.findOneAndUpdate(
    { householdId },
    { householdId, data: result, generatedAt: new Date() },
    { upsert: true, new: true }
  );

  return result;
}

export async function invalidateCache(householdId) {
  await InsightCache.deleteOne({ householdId });
}
