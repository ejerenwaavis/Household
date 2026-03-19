import Income from '../models/Income.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import LinkedAccount from '../models/LinkedAccount.js';

function getMonthRange(month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

function getMonthString(date) {
  const parsed = new Date(date);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekOfMonth(date) {
  const parsed = new Date(date);
  return Math.min(4, Math.ceil(parsed.getDate() / 7));
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyTransferOrPayment(text) {
  return /payment thank you|credit card payment|autopay|transfer from|transfer to|internal transfer|ach transfer|online payment|loan payment|mortgage payment/.test(text);
}

function toUnifiedManualIncome(income) {
  return {
    ...income,
    source: income.source || 'manual',
    isSynced: false,
    canEdit: true,
    canDelete: true,
  };
}

function toUnifiedPlaidIncome(transaction, linkedAccount) {
  const date = new Date(transaction.date);
  const amount = Math.abs(Number(transaction.amount || 0));

  return {
    _id: transaction._id,
    householdId: transaction.householdId,
    userId: transaction.userId,
    contributorName: linkedAccount?.accountName || 'Bank Sync',
    week: getWeekOfMonth(date),
    month: getMonthString(date),
    dailyBreakdown: [{
      date: date.toISOString(),
      amount,
      source: 'synced deposit',
      description: transaction.merchant || transaction.name || transaction.description || 'Bank deposit',
    }],
    weeklyTotal: amount,
    amount,
    source: 'plaid',
    description: transaction.merchant || transaction.name || transaction.description || 'Bank deposit',
    linkedTransactionId: transaction._id,
    plaidTransactionId: transaction.plaidTransactionId,
    isSynced: true,
    canEdit: false,
    canDelete: false,
    primaryCategory: transaction.primaryCategory,
    detailedCategory: transaction.detailedCategory,
  };
}

export function isLikelySyncedIncomeTransaction(transaction, linkedAccount) {
  const amount = Number(transaction?.amount || 0);
  if (amount >= 0) return false;
  if (transaction?.isPending || transaction?.isDuplicate) return false;
  if (linkedAccount?.accountType !== 'depository') return false;

  const text = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);
  if (!text) return true;
  if (isLikelyTransferOrPayment(text)) return false;

  return true;
}

export async function getUnifiedMonthlyIncome(householdId, month) {
  const { start, end } = getMonthRange(month);

  const [manualIncome, plaidTransactions, linkedAccounts] = await Promise.all([
    Income.find({ householdId, month }).sort({ createdAt: 1 }).lean(),
    PlaidTransaction.find({
      householdId,
      date: { $gte: start, $lte: end },
      amount: { $lt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    LinkedAccount.find({ householdId, isActive: true }).select('accountName accountType').lean(),
  ]);

  const accountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const syncedIncome = plaidTransactions
    .filter((transaction) => isLikelySyncedIncomeTransaction(transaction, accountMap.get(String(transaction.linkedAccountId))))
    .map((transaction) => toUnifiedPlaidIncome(transaction, accountMap.get(String(transaction.linkedAccountId))));

  const incomes = [
    ...manualIncome.map(toUnifiedManualIncome),
    ...syncedIncome,
  ].sort((left, right) => new Date(left.dailyBreakdown?.[0]?.date || left.createdAt || 0) - new Date(right.dailyBreakdown?.[0]?.date || right.createdAt || 0));

  const weeklyTotals = [0, 0, 0, 0];
  for (const income of incomes) {
    const week = Number(income.week) || 1;
    const idx = Math.min(3, Math.max(0, week - 1));
    weeklyTotals[idx] += Number(income.weeklyTotal || income.amount || 0);
  }

  return {
    month,
    income: incomes,
    weeklyTotals,
    total: weeklyTotals.reduce((sum, value) => sum + value, 0),
    syncedCount: syncedIncome.length,
  };
}

export async function getUnifiedIncomeByHousehold(householdId) {
  const [manualIncome, plaidTransactions, linkedAccounts] = await Promise.all([
    Income.find({ householdId }).sort({ createdAt: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $lt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    LinkedAccount.find({ householdId, isActive: true }).select('accountName accountType').lean(),
  ]);

  const accountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const syncedIncome = plaidTransactions
    .filter((transaction) => isLikelySyncedIncomeTransaction(transaction, accountMap.get(String(transaction.linkedAccountId))))
    .map((transaction) => toUnifiedPlaidIncome(transaction, accountMap.get(String(transaction.linkedAccountId))));

  const incomes = [
    ...manualIncome.map(toUnifiedManualIncome),
    ...syncedIncome,
  ].sort((left, right) => new Date(right.dailyBreakdown?.[0]?.date || right.createdAt || 0) - new Date(left.dailyBreakdown?.[0]?.date || left.createdAt || 0));

  const byMonth = {};
  let total = 0;
  for (const income of incomes) {
    const month = income.month || getMonthString(income.dailyBreakdown?.[0]?.date || income.createdAt);
    const amount = Number(income.weeklyTotal || income.amount || 0);
    byMonth[month] = (byMonth[month] || 0) + amount;
    total += amount;
  }

  return {
    incomes,
    total,
    byMonth,
  };
}