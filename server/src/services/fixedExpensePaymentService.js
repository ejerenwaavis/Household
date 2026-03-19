import FixedExpense from '../models/FixedExpense.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';
import Goal from '../models/Goal.js';
import GoalContribution from '../models/GoalContribution.js';
import LinkedAccount from '../models/LinkedAccount.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import logger from '../utils/logger.js';

const FIXED_EXPENSE_ALIASES = {
  phone: ['att', 'at&t', 'verizon', 'tmobile', 't mobile', 'sprint', 'mobile'],
  internet: ['xfinity', 'comcast', 'spectrum', 'fios', 'frontier', 'cox', 'internet'],
  utilities: ['utility', 'electric', 'water', 'sewer', 'gas company', 'power'],
  rent: ['rent', 'property management', 'lease'],
  mortgage: ['mortgage', 'rocket mortgage', 'mr cooper', 'freedom mortgage', 'loan servicing'],
  insurance: ['insurance', 'geico', 'progressive', 'state farm', 'allstate'],
};

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLiabilityLinkedAccount(account) {
  const type = String(account?.accountType || '').toLowerCase();
  const subtype = String(account?.accountSubtype || '').toLowerCase();
  return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
}

function buildMonthString(date) {
  const parsedDate = new Date(date);
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
}

function getAliasesForFixedExpense(expenseName) {
  const normalizedName = normalizeText(expenseName);
  const aliases = [normalizedName];

  for (const [key, values] of Object.entries(FIXED_EXPENSE_ALIASES)) {
    if (normalizedName.includes(key)) aliases.push(...values);
  }

  return [...new Set(aliases.filter(Boolean))];
}

function getAliasesForExpenseRecord(expense) {
  const aliases = [
    ...getAliasesForFixedExpense(expense.name),
    ...((expense.merchantAliases || []).map(normalizeText)),
  ];
  return [...new Set(aliases.filter(Boolean))];
}

async function mirrorPaymentToLinkedLiabilities(payment) {
  const linkedGoals = await Goal.find({
    householdId: payment.householdId,
    linkedFixedExpenseId: String(payment.fixedExpenseId),
    isActive: true,
  });

  for (const goal of linkedGoals) {
    const account = goal.linkedAccountId
      ? await LinkedAccount.findById(goal.linkedAccountId).select('accountType accountSubtype').lean()
      : null;

    if (!isLiabilityLinkedAccount(account)) continue;

    const existingContribution = await GoalContribution.findOne({
      fixedExpensePaymentId: payment._id,
      goalId: goal._id,
    });
    if (existingContribution) continue;

    await GoalContribution.create({
      householdId: payment.householdId,
      goalId: goal._id,
      amount: Number(payment.amount),
      contributionDate: new Date(payment.paymentDate),
      source: 'fixed_expense_payment',
      fixedExpensePaymentId: payment._id,
      method: payment.method === 'online' ? 'bank' : (payment.method || 'other'),
      notes: payment.notes || 'Auto-linked from fixed expense payment',
    });

    goal.currentBalance = Math.max(0, Number(goal.currentBalance || 0) - Number(payment.amount));
    await goal.save();
  }
}

export async function createFixedExpensePaymentAndMirror({
  householdId,
  fixedExpenseId,
  amount,
  paymentDate,
  method,
  notes,
  source = 'manual',
  plaidTransactionId = null,
}) {
  if (plaidTransactionId) {
    const existingPayment = await FixedExpensePayment.findOne({ plaidTransactionId });
    if (existingPayment) {
      return { payment: existingPayment, mirrored: false, duplicate: true };
    }
  }

  const monthPaid = buildMonthString(paymentDate);
  const payment = await FixedExpensePayment.create({
    householdId,
    fixedExpenseId,
    amount: Number(amount),
    paymentDate: new Date(paymentDate),
    source,
    plaidTransactionId,
    method: method || 'online',
    notes: notes || '',
    monthPaid,
  });

  if (plaidTransactionId) {
    await PlaidTransaction.updateOne(
      { _id: plaidTransactionId, householdId },
      {
        isReconciled: true,
        reconciliationReason: 'fixed_expense_payment',
        reconciledAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  await mirrorPaymentToLinkedLiabilities(payment);
  return { payment, mirrored: true, duplicate: false };
}

export async function autoDetectFixedExpensePaymentFromPlaidTransaction(plaidTransaction) {
  if (!plaidTransaction || plaidTransaction.isPending || plaidTransaction.isDuplicate) {
    return null;
  }

  const amount = Number(plaidTransaction.amount || 0);
  if (amount <= 0) return null;

  const monthPaid = buildMonthString(plaidTransaction.date);
  const transactionText = normalizeText(`${plaidTransaction.merchant || ''} ${plaidTransaction.name || ''} ${plaidTransaction.description || ''}`);
  const fixedExpenses = await FixedExpense.find({ householdId: plaidTransaction.householdId, isActive: true }).lean();

  const existingPayments = await FixedExpensePayment.find({
    householdId: plaidTransaction.householdId,
    monthPaid,
  }).lean();

  const rankedMatches = fixedExpenses
    .map((expense) => {
      const expenseAmount = Number(expense.amount || 0);
      if (Math.abs(expenseAmount - amount) > 0.01) return null;

      const aliases = getAliasesForExpenseRecord(expense);
      const textMatch = aliases.some((alias) => transactionText.includes(alias));
      if (!textMatch) return null;

      const alreadyPaid = existingPayments
        .filter((payment) => String(payment.fixedExpenseId) === String(expense._id))
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

      if (alreadyPaid >= expenseAmount) return null;

      return {
        expense,
        score: aliases.reduce((score, alias) => score + (transactionText.includes(alias) ? alias.length : 0), 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  const match = rankedMatches[0];
  if (!match) return null;

  const result = await createFixedExpensePaymentAndMirror({
    householdId: plaidTransaction.householdId,
    fixedExpenseId: match.expense._id,
    amount,
    paymentDate: plaidTransaction.date,
    method: plaidTransaction.paymentMethod === 'in store' ? 'other' : 'online',
    notes: `Auto-detected from Plaid transaction: ${plaidTransaction.merchant || plaidTransaction.name}`,
    source: 'plaid_auto',
    plaidTransactionId: plaidTransaction._id,
  });

  logger.info('[FixedExpenseAutoPay] Auto-marked fixed expense as paid from Plaid transaction', {
    householdId: plaidTransaction.householdId,
    fixedExpenseId: match.expense._id,
    fixedExpenseName: match.expense.name,
    plaidTransactionId: plaidTransaction._id,
    amount,
  });

  return result;
}

export async function getFixedExpenseReviewCandidates(householdId, month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const [fixedExpenses, plaidTransactions, existingPayments] = await Promise.all([
    FixedExpense.find({ householdId, isActive: true }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $gt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    FixedExpensePayment.find({ householdId, monthPaid: month }).lean(),
  ]);

  const paidExpenseIds = new Set(existingPayments.map((payment) => String(payment.fixedExpenseId)));
  const usedTransactionIds = new Set(existingPayments.map((payment) => String(payment.plaidTransactionId)).filter(Boolean));

  return plaidTransactions.flatMap((transaction) => {
    if (usedTransactionIds.has(String(transaction._id))) return [];
    const amount = Number(transaction.amount || 0);
    const text = normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);

    return fixedExpenses
      .filter((expense) => !paidExpenseIds.has(String(expense._id)))
      .map((expense) => {
        const aliases = getAliasesForExpenseRecord(expense);
        const aliasMatch = aliases.some((alias) => text.includes(alias));
        if (!aliasMatch) return null;

        const expectedAmount = Number(expense.amount || 0);
        const amountDelta = Math.abs(expectedAmount - amount);
        const amountPct = expectedAmount > 0 ? amountDelta / expectedAmount : 1;
        if (amountPct === 0 || amountPct > 0.15) return null;

        return {
          fixedExpenseId: expense._id,
          fixedExpenseName: expense.name,
          expectedAmount,
          plaidTransactionId: transaction._id,
          transactionDate: transaction.date,
          transactionName: transaction.merchant || transaction.name,
          transactionAmount: amount,
          confidence: Math.max(0, Math.round((1 - amountPct) * 100)),
        };
      })
      .filter(Boolean);
  }).sort((left, right) => right.confidence - left.confidence);
}