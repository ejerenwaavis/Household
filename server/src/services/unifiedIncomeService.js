import Income from '../models/Income.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import LinkedAccount from '../models/LinkedAccount.js';
import {
  createdAtAfterReset,
  getMonthResetCutoff,
  getMonthResetCutoffMap,
} from './monthWorkspaceService.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

function roundAmountToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function getDateKey(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getAdjacentDateKeys(dateValue) {
  const date = new Date(dateValue);
  const previous = new Date(date.getTime() - ONE_DAY_MS);
  const next = new Date(date.getTime() + ONE_DAY_MS);
  return [getDateKey(previous), getDateKey(date), getDateKey(next)];
}

function isLikelyTransferDescriptor(transaction) {
  const text = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);
  const categoryText = normalizeText(`${transaction.userCategory || ''} ${transaction.primaryCategory || ''} ${transaction.detailedCategory || ''}`);
  return /\btransfer\b|\binternal\b|\bzelle\b|\bvenmo\b|\bpaypal\b|\bach\b|\bwire\b/.test(text) || /\btransfer\b/.test(categoryText);
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
    createdAt: transaction.createdAt || transaction.syncedAt || date,
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
  const resetCutoff = await getMonthResetCutoff(householdId, month);

  const manualFilter = { householdId, month };
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

  const [manualIncome, plaidIncomeTransactions, plaidHouseholdTransactions, linkedAccounts] = await Promise.all([
    Income.find(manualFilter).sort({ createdAt: 1 }).lean(),
    PlaidTransaction.find({ ...plaidFilter, amount: { $lt: 0 } }).sort({ date: -1 }).lean(),
    PlaidTransaction.find(plaidFilter).sort({ date: -1 }).lean(),
    LinkedAccount.find({ householdId, isActive: true }).select('accountName accountType').lean(),
  ]);

  const internalTransferIds = buildInternalTransferIdSet(plaidHouseholdTransactions);
  const accountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const syncedIncome = plaidIncomeTransactions
    .filter((transaction) => createdAtAfterReset(transaction, resetCutoffMap[getMonthString(transaction.date)]))
    .filter((transaction) => !internalTransferIds.has(String(transaction._id)))
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
    excludedInternalTransfers: plaidIncomeTransactions.filter((transaction) => internalTransferIds.has(String(transaction._id))).length,
  };
}

export async function getUnifiedIncomeByHousehold(householdId) {
  const [manualIncome, plaidIncomeTransactions, plaidHouseholdTransactions, linkedAccounts, resetCutoffMap] = await Promise.all([
    Income.find({ householdId }).sort({ createdAt: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $lt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    LinkedAccount.find({ householdId, isActive: true }).select('accountName accountType').lean(),
    getMonthResetCutoffMap(householdId),
  ]);

  const internalTransferIds = buildInternalTransferIdSet(plaidHouseholdTransactions);
  const accountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const syncedIncome = plaidIncomeTransactions
    .filter((transaction) => !internalTransferIds.has(String(transaction._id)))
    .filter((transaction) => isLikelySyncedIncomeTransaction(transaction, accountMap.get(String(transaction.linkedAccountId))))
    .map((transaction) => toUnifiedPlaidIncome(transaction, accountMap.get(String(transaction.linkedAccountId))));

  const incomes = [
    ...manualIncome
      .filter((income) => createdAtAfterReset(income, resetCutoffMap[income.month || getMonthString(income.dailyBreakdown?.[0]?.date || income.createdAt)]))
      .map(toUnifiedManualIncome),
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
    excludedInternalTransfers: plaidIncomeTransactions.filter((transaction) => internalTransferIds.has(String(transaction._id))).length,
  };
}