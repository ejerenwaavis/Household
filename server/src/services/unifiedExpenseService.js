import Expense from '../models/Expense.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import FixedExpense from '../models/FixedExpense.js';
import {
  createdAtAfterReset,
  getMonthResetCutoff,
  getMonthResetCutoffMap,
} from './monthWorkspaceService.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMonthString(date) {
  const parsed = new Date(date);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekOfMonth(date) {
  const parsed = new Date(date);
  return Math.min(4, Math.ceil(parsed.getDate() / 7));
}

function getMonthRange(month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

function mapPlaidCategory(rawCategory = '') {
  const normalized = normalizeText(rawCategory).replace(/\s+/g, '_');

  if (!normalized) return 'Other';
  if (normalized.includes('grocer')) return 'Groceries';
  if (normalized.includes('gas') || normalized.includes('fuel')) return 'Gas';
  if (normalized.includes('transport') || normalized.includes('travel')) return 'Transportation';
  if (normalized.includes('entertain')) return 'Entertainment';
  if (normalized.includes('medical') || normalized.includes('health')) return 'Medical';
  if (normalized.includes('shopping') || normalized.includes('merchandise') || normalized.includes('retail')) return 'Shopping';
  if (normalized.includes('utilit')) return 'Utilities';
  if (normalized.includes('dining')) return 'Dining';
  if (normalized.includes('food_and_drink') || normalized === 'food') return 'Food';

  return 'Other';
}

function roundAmountToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function getDateKey(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isLikelyTransferDescriptor(transaction) {
  const text = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);
  const categoryText = normalizeText(`${transaction.userCategory || ''} ${transaction.primaryCategory || ''} ${transaction.detailedCategory || ''}`);
  return /\btransfer\b|\binternal\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bach\b|\bwire\b/.test(text) || /\btransfer\b/.test(categoryText);
}

function getAdjacentDateKeys(dateValue) {
  const date = new Date(dateValue);
  const previous = new Date(date.getTime() - ONE_DAY_MS);
  const next = new Date(date.getTime() + ONE_DAY_MS);
  return [getDateKey(previous), getDateKey(date), getDateKey(next)];
}

function buildInternalTransferIdSet(transactions = []) {
  const candidateBuckets = new Map();
  const matchedIds = new Set();

  for (const transaction of transactions) {
    if (!isLikelyTransferDescriptor(transaction)) continue;

    const amountCents = Math.abs(roundAmountToCents(transaction.amount));
    if (!amountCents) continue;

    const currentSign = Number(transaction.amount || 0) > 0 ? 'out' : 'in';
    const counterSign = currentSign === 'out' ? 'in' : 'out';
    const linkedAccountId = String(transaction.linkedAccountId || '');
    const txId = String(transaction._id);

    for (const dateKey of getAdjacentDateKeys(transaction.date)) {
      const bucketKey = `${amountCents}:${dateKey}:${counterSign}`;
      const candidates = candidateBuckets.get(bucketKey) || [];

      const match = candidates.find((candidate) => {
        if (candidate.txId === txId) return false;
        if (!candidate.linkedAccountId || !linkedAccountId) return false;
        if (candidate.linkedAccountId === linkedAccountId) return false;
        return true;
      });

      if (match) {
        matchedIds.add(txId);
        matchedIds.add(match.txId);
        break;
      }
    }

    const ownDateKey = getDateKey(transaction.date);
    const ownBucketKey = `${amountCents}:${ownDateKey}:${currentSign}`;
    if (!candidateBuckets.has(ownBucketKey)) candidateBuckets.set(ownBucketKey, []);
    candidateBuckets.get(ownBucketKey).push({
      txId,
      linkedAccountId,
    });
  }

  return matchedIds;
}

function isLikelyFixedPlaidTransaction(transaction, fixedExpenses) {
  const normalizedCategory = mapPlaidCategory(transaction.userCategory || transaction.primaryCategory || transaction.detailedCategory);
  const text = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);

  return fixedExpenses.some((fixedExpense) => {
    const fixedName = normalizeText(fixedExpense.name);
    const fixedGroup = normalizeText(fixedExpense.group);

    if (fixedName && (text.includes(fixedName) || fixedName.includes(text))) {
      return true;
    }

    if (fixedName === 'groceries' && normalizedCategory === 'Groceries') return true;
    if (fixedName === 'utilities' && normalizedCategory === 'Utilities') return true;
    if (fixedName === 'gas' && normalizedCategory === 'Gas') return true;

    if (fixedGroup === 'housing' && /rent|mortgage|lease|hoa/.test(text)) return true;
    if (fixedGroup === 'utilities' && /electric|water|utility|internet|xfinity|comcast|verizon|att|spectrum/.test(text)) return true;

    return false;
  });
}

function isManualDuplicateOfPlaid(transaction, manualExpenses) {
  const transactionDate = new Date(transaction.date);
  const transactionText = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);

  return manualExpenses.some((expense) => {
    const amountMatches = Math.abs(Number(expense.amount || 0) - Number(transaction.amount || 0)) <= 0.01;
    if (!amountMatches) return false;

    const dateMatches = Math.abs(new Date(expense.date) - transactionDate) <= ONE_DAY_MS;
    if (!dateMatches) return false;

    const expenseText = normalizeText(`${expense.category || ''} ${expense.description || ''}`);
    if (!expenseText) return false;

    return transactionText.includes(expenseText) || expenseText.includes(transactionText) || expense.category === mapPlaidCategory(transaction.userCategory || transaction.primaryCategory || transaction.detailedCategory);
  });
}

function toUnifiedManualExpense(expense) {
  return {
    ...expense,
    source: expense.source || 'manual',
    isSynced: false,
    canEdit: true,
    canDelete: true,
  };
}

function toUnifiedPlaidExpense(transaction) {
  const date = new Date(transaction.date);
  const category = mapPlaidCategory(transaction.userCategory || transaction.primaryCategory || transaction.detailedCategory);

  return {
    _id: transaction._id,
    householdId: transaction.householdId,
    userId: transaction.userId,
    contributorName: 'Bank Sync',
    amount: Number(transaction.amount || 0),
    category,
    description: transaction.merchant || transaction.name || 'Bank transaction',
    date,
    week: getWeekOfMonth(date),
    month: getMonthString(date),
    source: 'plaid',
    autoImported: true,
    linkedTransactionId: transaction._id,
    plaidTransactionId: transaction.plaidTransactionId,
    createdAt: transaction.createdAt || transaction.syncedAt || date,
    isSynced: true,
    canEdit: false,
    canDelete: false,
  };
}

export async function getUnifiedMonthlyVariableExpenses(householdId, month) {
  const { start, end } = getMonthRange(month);
  const resetCutoff = await getMonthResetCutoff(householdId, month);

  const manualFilter = {
    householdId,
    date: { $gte: start, $lte: end },
  };
  const plaidFilter = {
    householdId,
    date: { $gte: start, $lte: end },
    isPending: { $ne: true },
    isDuplicate: { $ne: true },
  };

  if (resetCutoff) {
    manualFilter.createdAt = { $gte: resetCutoff };
    plaidFilter.createdAt = { $gte: resetCutoff };
  }

  const [manualExpenses, plaidExpenseTransactions, plaidHouseholdTransactions, fixedExpenses] = await Promise.all([
    Expense.find(manualFilter).sort({ date: -1 }).lean(),
    PlaidTransaction.find({ ...plaidFilter, amount: { $gt: 0 } }).sort({ date: -1 }).lean(),
    PlaidTransaction.find(plaidFilter).sort({ date: -1 }).lean(),
    FixedExpense.find({ householdId, isActive: true }).lean(),
  ]);

  const internalTransferIds = buildInternalTransferIdSet(plaidHouseholdTransactions);

  const merged = [
    ...manualExpenses.map(toUnifiedManualExpense),
    ...plaidExpenseTransactions
      .filter((transaction) => !internalTransferIds.has(String(transaction._id)))
      .filter((transaction) => !isLikelyFixedPlaidTransaction(transaction, fixedExpenses))
      .filter((transaction) => !isManualDuplicateOfPlaid(transaction, manualExpenses))
      .map(toUnifiedPlaidExpense),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const byCategory = {};
  for (const expense of merged) {
    const category = expense.category || 'Other';
    byCategory[category] = (byCategory[category] || 0) + Number(expense.amount || 0);
  }

  const total = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);

  return {
    month,
    expenses: merged,
    byCategory,
    total,
    excludedInternalTransfers: plaidExpenseTransactions.filter((transaction) => internalTransferIds.has(String(transaction._id))).length,
    externalTransferOutflows: externalTransferOutflows.length,
  };
}

export async function getUnifiedVariableExpensesByHousehold(householdId) {
  const [manualExpenses, plaidExpenseTransactions, plaidHouseholdTransactions, fixedExpenses, resetCutoffMap] = await Promise.all([
    Expense.find({ householdId }).sort({ date: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $gt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    FixedExpense.find({ householdId, isActive: true }).lean(),
    getMonthResetCutoffMap(householdId),
  ]);

  const internalTransferIds = buildInternalTransferIdSet(plaidHouseholdTransactions);
  const filteredManualExpenses = manualExpenses
    .filter((expense) => createdAtAfterReset(expense, resetCutoffMap[expense.month || getMonthString(expense.date)]));
  const filteredPlaidExpenseTransactions = plaidExpenseTransactions
    .filter((transaction) => createdAtAfterReset(transaction, resetCutoffMap[getMonthString(transaction.date)]));
  const externalTransferOutflows = filteredPlaidExpenseTransactions.filter((transaction) => isLikelyTransferDescriptor(transaction) && !internalTransferIds.has(String(transaction._id)));

  const merged = [
    ...filteredManualExpenses.map(toUnifiedManualExpense),
    ...filteredPlaidExpenseTransactions
      .filter((transaction) => !internalTransferIds.has(String(transaction._id)))
      .filter((transaction) => !isLikelyFixedPlaidTransaction(transaction, fixedExpenses))
      .filter((transaction) => !isManualDuplicateOfPlaid(transaction, filteredManualExpenses))
      .map(toUnifiedPlaidExpense),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = merged.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const byMonth = {};
  for (const expense of merged) {
    const month = expense.month || getMonthString(expense.date);
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += Number(expense.amount || 0);
  }

  return {
    expenses: merged,
    total,
    byMonth,
    excludedInternalTransfers: plaidExpenseTransactions.filter((transaction) => internalTransferIds.has(String(transaction._id))).length,
    externalTransferOutflows: externalTransferOutflows.length,
  };
}