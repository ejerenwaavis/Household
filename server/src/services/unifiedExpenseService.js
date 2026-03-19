import Expense from '../models/Expense.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import FixedExpense from '../models/FixedExpense.js';

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
    isSynced: true,
    canEdit: false,
    canDelete: false,
  };
}

export async function getUnifiedMonthlyVariableExpenses(householdId, month) {
  const { start, end } = getMonthRange(month);

  const [manualExpenses, plaidTransactions, fixedExpenses] = await Promise.all([
    Expense.find({
      householdId,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      date: { $gte: start, $lte: end },
      amount: { $gt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    FixedExpense.find({ householdId, isActive: true }).lean(),
  ]);

  const merged = [
    ...manualExpenses.map(toUnifiedManualExpense),
    ...plaidTransactions
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
  };
}

export async function getUnifiedVariableExpensesByHousehold(householdId) {
  const [manualExpenses, plaidTransactions, fixedExpenses] = await Promise.all([
    Expense.find({ householdId }).sort({ date: -1 }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $gt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
    }).sort({ date: -1 }).lean(),
    FixedExpense.find({ householdId, isActive: true }).lean(),
  ]);

  const merged = [
    ...manualExpenses.map(toUnifiedManualExpense),
    ...plaidTransactions
      .filter((transaction) => !isLikelyFixedPlaidTransaction(transaction, fixedExpenses))
      .filter((transaction) => !isManualDuplicateOfPlaid(transaction, manualExpenses))
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
  };
}