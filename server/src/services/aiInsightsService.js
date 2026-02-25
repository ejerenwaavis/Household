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

export function analyzeSpendingPatterns(expenses, monthKeys, incomes = []) {
  const byCategory = {};
  const byMonth = {};
  const incomeByMonth = {};

  for (const exp of expenses) {
    const cat = exp.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + exp.amount;
    byMonth[exp.month] = (byMonth[exp.month] || 0) + exp.amount;
  }

  for (const inc of incomes) {
    const total = inc.dailyBreakdown?.reduce((s, d) => s + d.amount, 0) || inc.weeklyTotal || 0;
    incomeByMonth[inc.month] = (incomeByMonth[inc.month] || 0) + total;
  }

  const totalSpent = Object.values(byCategory).reduce((a, b) => a + b, 0);

  // Sort categories by spend with percentage
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
      percentage: totalSpent > 0 ? Math.round((total / totalSpent) * 10000) / 100 : 0,
    }));

  // Month over month combined trend
  const monthlyTrend = monthKeys.map(m => ({
    month: m,
    income: Math.round((incomeByMonth[m] || 0) * 100) / 100,
    expenses: Math.round((byMonth[m] || 0) * 100) / 100,
  }));

  const trend = monthlyTrend.length >= 2
    ? monthlyTrend[0].expenses - monthlyTrend[1].expenses
    : 0;

  return {
    topCategories,
    monthlyTrend,
    trend: Math.round(trend * 100) / 100,
    trendDirection: trend > 50 ? 'up' : trend < -50 ? 'down' : 'stable',
    totalSpent: Math.round(totalSpent * 100) / 100,
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
// Rule-based Natural Language Summary (always available)
// ============================================================

function generateRuleBasedSummary(data) {
  const { metrics, spendingPatterns, budgetRecommendations, anomalies } = data;
  const { totalIncome, totalExpenses, savingsRate, netSavings } = metrics;

  const top = spendingPatterns.topCategories?.[0];
  const trend = spendingPatterns.trendDirection;

  const summaryParts = [];

  if (totalIncome > 0) {
    summaryParts.push(`Your household is bringing in $${totalIncome.toLocaleString()} and spending $${totalExpenses.toLocaleString()} — a savings rate of ${savingsRate.toFixed(1)}%.`);
  } else {
    return { summary: 'Add income and expense data to get personalized financial insights.', insights: [] };
  }

  const insights = [];

  if (savingsRate >= 20) {
    insights.push({ emoji: '🎉', title: 'Excellent Savings', insight: `You're saving ${savingsRate.toFixed(1)}% of income — well above the recommended 20% target. Consider moving excess savings into investments or accelerating goal funding.` });
  } else if (savingsRate >= 10) {
    insights.push({ emoji: '📈', title: 'Good Progress', insight: `At ${savingsRate.toFixed(1)}% savings rate, you're on the right track. A few small adjustments could push you above the 20% benchmark.` });
  } else {
    insights.push({ emoji: '⚠️', title: 'Savings Alert', insight: `Your savings rate of ${savingsRate.toFixed(1)}% is below the recommended 20%. Focus on reducing discretionary spending to build your safety net.` });
  }

  if (top) {
    const pct = top.percentage.toFixed(1);
    insights.push({ emoji: '💡', title: `Top Spend: ${top.category}`, insight: `${top.category} makes up ${pct}% of your spending at $${top.total.toLocaleString()}. ${top.percentage > 30 ? 'This is a significant portion — look for opportunities to reduce here.' : 'This looks reasonable.'}` });
  }

  if (trend === 'up') {
    insights.push({ emoji: '📊', title: 'Spending Increased', insight: `Your spending is trending up compared to last month ($${Math.abs(spendingPatterns.trend).toLocaleString()} more). Review recent expenses to identify what changed.` });
  } else if (trend === 'down') {
    insights.push({ emoji: '✅', title: 'Spending Reduced', insight: `Great job! Your spending is down $${Math.abs(spendingPatterns.trend).toLocaleString()} compared to last month. Keep up the disciplined approach.` });
  }

  if (anomalies?.length > 0) {
    insights.push({ emoji: '🔍', title: `${anomalies.length} Unusual Pattern${anomalies.length > 1 ? 's' : ''} Detected`, insight: `${anomalies[0].category} spending is ${anomalies[0].percentIncrease}% above your average. Review this category to ensure no unexpected charges.` });
  }

  const netLabel = netSavings >= 0 ? `$${netSavings.toLocaleString()} saved this period` : `a $${Math.abs(netSavings).toLocaleString()} shortfall`;
  summaryParts.push(`You have ${netLabel}.`);
  if (insights.length > 0 && savingsRate < 20) summaryParts.push('Focus on the recommendations below to improve your financial health.');

  return { summary: summaryParts.join(' '), insights: insights.slice(0, 3) };
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
- Top spending categories: ${data.spendingPatterns.topCategories.map(c => `${c.category} ($${c.total})`).join(', ')}
- Spending trend: ${data.spendingPatterns.trendDirection} (${data.spendingPatterns.trend > 0 ? '+' : ''}$${data.spendingPatterns.trend} vs last month)
- Active anomalies: ${data.anomalies.length} unusual spending patterns detected

Respond with a JSON object: { "summary": "2-3 sentence financial summary", "insights": [{ "title": "...", "insight": "...", "emoji": "..." }] }`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    const parsed = JSON.parse(raw);
    return { summary: parsed.summary, insights: parsed.insights || [] };
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

  const spendingPatterns = analyzeSpendingPatterns(expenses, monthKeys, incomes);
  const budget = generateBudgetRecommendations(expenses, incomes, fixedExpenses);
  const anomalies = detectAnomalies(expenses, monthKeys);
  const metrics = calculateMetrics(expenses, incomes, fixedExpenses, goals);

  const result = {
    spendingPatterns,
    budgetRecommendations: budget.recommendations,
    budget,
    anomalies,
    metrics,
  };

  // Always generate rule-based summary (fast, reliable)
  const ruleBasedSummary = generateRuleBasedSummary(result);
  result.aiSummary = ruleBasedSummary;
  result.aiEnabled = true; // Always enabled with rule-based

  // Try to enhance with OpenAI if available
  const aiEnhancement = await generateAISummary(result);
  if (aiEnhancement) {
    result.aiSummary = aiEnhancement;
    result.aiEnhanced = true; // Marks actual OpenAI usage
  }

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
