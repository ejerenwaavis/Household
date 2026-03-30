import FixedExpense from '../models/FixedExpense.js';
import FixedExpensePayment from '../models/FixedExpensePayment.js';
import FixedExpenseMatchFeedback from '../models/FixedExpenseMatchFeedback.js';
import Goal from '../models/Goal.js';
import GoalContribution from '../models/GoalContribution.js';
import BankTransaction from '../models/BankTransaction.js';
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

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function getTransferHint(transactionType, transaction) {
  if (!transaction) return false;
  if (transactionType === 'bank') {
    return Boolean(
      transaction.isInternalTransferNeutralized
      || transaction.transferId
      || transaction.transferScope === 'same-household'
    );
  }

  return Boolean(
    transaction.transferDirection === 'in'
    || transaction.transferDirection === 'out'
    || transaction.transferScope === 'same-household'
  );
}

function getTransactionText(transactionType, transaction) {
  if (transactionType === 'bank') {
    return normalizeText(transaction.description || transaction.normalizedDescription || '');
  }
  return normalizeText(`${transaction.merchant || ''} ${transaction.name || ''} ${transaction.description || ''}`);
}

function getTransactionDate(transactionType, transaction) {
  return transactionType === 'bank'
    ? toDate(transaction.dateISO || transaction.date)
    : toDate(transaction.date);
}

function getTransactionLabel(transactionType, transaction) {
  if (transactionType === 'bank') return transaction.description || transaction.accountName || 'Uploaded transaction';
  return transaction.merchant || transaction.name || transaction.description || 'Plaid transaction';
}

function getDueDateDistanceDays(dueDay, transactionDate) {
  if (!dueDay || !transactionDate) return null;
  const txDay = transactionDate.getUTCDate();
  const due = Number(dueDay);
  if (!Number.isFinite(due) || due <= 0 || due > 31) return null;
  return Math.abs(txDay - due);
}

function computeConfidence({ expectedAmount, amount, aliasHitCount, dueDateDistanceDays, historyBonus = 0 }) {
  const amountDelta = Math.abs(expectedAmount - amount);
  const amountPct = expectedAmount > 0 ? amountDelta / expectedAmount : 1;

  const amountScore = clamp(1 - amountPct, 0, 1);
  const aliasScore = aliasHitCount > 0 ? clamp(aliasHitCount / 3, 0, 1) : 0;
  const dueDateScore = dueDateDistanceDays == null ? 0.5 : clamp(1 - (dueDateDistanceDays / 10), 0, 1);

  const baseScore = (amountScore * 0.6) + (aliasScore * 0.3) + (dueDateScore * 0.1);
  return clamp(Math.round((baseScore * 100) + historyBonus), 0, 99);
}

async function getFeedbackBonusByExpense(householdId) {
  const feedbackRows = await FixedExpenseMatchFeedback.find({ householdId })
    .select('fixedExpenseId decision')
    .lean();

  const bonusMap = new Map();
  for (const row of feedbackRows) {
    const key = String(row.fixedExpenseId);
    const current = bonusMap.get(key) || { confirmed: 0, rejected: 0 };
    if (row.decision === 'confirmed') current.confirmed += 1;
    if (row.decision === 'rejected') current.rejected += 1;
    bonusMap.set(key, current);
  }

  const resolved = new Map();
  for (const [expenseId, stats] of bonusMap.entries()) {
    const total = stats.confirmed + stats.rejected;
    if (total === 0) {
      resolved.set(expenseId, 0);
      continue;
    }

    const bias = (stats.confirmed - stats.rejected) / total;
    resolved.set(expenseId, Math.round(clamp(bias * 5, -5, 5)));
  }

  return resolved;
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
  sourceTransactionType = null,
  sourceTransactionId = null,
}) {
  const resolvedSourceTransactionType = sourceTransactionType || (plaidTransactionId ? 'plaid' : null);
  const resolvedSourceTransactionId = sourceTransactionId || plaidTransactionId || null;

  if (plaidTransactionId) {
    const existingPayment = await FixedExpensePayment.findOne({ plaidTransactionId });
    if (existingPayment) {
      return { payment: existingPayment, mirrored: false, duplicate: true };
    }
  }

  if (resolvedSourceTransactionType && resolvedSourceTransactionId) {
    const existingPayment = await FixedExpensePayment.findOne({
      householdId,
      sourceTransactionType: resolvedSourceTransactionType,
      sourceTransactionId: resolvedSourceTransactionId,
    });
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
    sourceTransactionType: resolvedSourceTransactionType,
    sourceTransactionId: resolvedSourceTransactionId,
    method: method || 'online',
    notes: notes || '',
    monthPaid,
  });

  if (resolvedSourceTransactionType === 'plaid' && resolvedSourceTransactionId) {
    await PlaidTransaction.updateOne(
      { _id: resolvedSourceTransactionId, householdId },
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
    sourceTransactionType: 'plaid',
    sourceTransactionId: plaidTransaction._id,
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

export async function recordFixedExpenseMatchFeedback({
  householdId,
  fixedExpenseId,
  transactionType,
  transactionId,
  decision,
  confidence = 0,
  reason = '',
  features = {},
  createdBy = '',
}) {
  if (!householdId || !fixedExpenseId || !transactionType || !transactionId || !decision) {
    return null;
  }

  return FixedExpenseMatchFeedback.create({
    householdId,
    fixedExpenseId,
    transactionType,
    transactionId,
    decision,
    confidence,
    reason,
    features: {
      amountDeltaPct: features.amountDeltaPct ?? null,
      aliasMatched: Boolean(features.aliasMatched),
      dueDateDistanceDays: features.dueDateDistanceDays ?? null,
      merchantHitCount: Number(features.merchantHitCount || 0),
    },
    createdBy,
  });
}

function buildCandidatesFromTransaction({
  transaction,
  transactionType,
  fixedExpenses,
  paidExpenseIds,
  historyBonusByExpense,
}) {
  if (getTransferHint(transactionType, transaction)) return [];

  const amount = Number(transaction.amount || 0);
  if (amount <= 0) return [];

  const text = getTransactionText(transactionType, transaction);
  const transactionDate = getTransactionDate(transactionType, transaction);

  return fixedExpenses
    .filter((expense) => !paidExpenseIds.has(String(expense._id)))
    .map((expense) => {
      const aliases = getAliasesForExpenseRecord(expense);
      const aliasHits = aliases.filter((alias) => text.includes(alias));
      if (aliasHits.length === 0) return null;

      const expectedAmount = Number(expense.amount || 0);
      const amountDelta = Math.abs(expectedAmount - amount);
      const amountPct = expectedAmount > 0 ? amountDelta / expectedAmount : 1;
      if (amountPct > 0.15) return null;

      const dueDateDistanceDays = getDueDateDistanceDays(expense.dueDay, transactionDate);
      const confidence = computeConfidence({
        expectedAmount,
        amount,
        aliasHitCount: aliasHits.length,
        dueDateDistanceDays,
        historyBonus: historyBonusByExpense.get(String(expense._id)) || 0,
      });

      return {
        fixedExpenseId: expense._id,
        fixedExpenseName: expense.name,
        expectedAmount,
        transactionType,
        transactionId: transaction._id,
        transactionDate,
        transactionName: getTransactionLabel(transactionType, transaction),
        transactionAmount: amount,
        confidence,
        reasons: {
          aliasHitCount: aliasHits.length,
          amountDeltaPct: amountPct,
          dueDateDistanceDays,
        },
      };
    })
    .filter(Boolean);
}

export async function getFixedExpenseReviewCandidates(householdId, month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const [fixedExpenses, plaidTransactions, bankTransactions, existingPayments, historyBonusByExpense] = await Promise.all([
    FixedExpense.find({ householdId, isActive: true }).lean(),
    PlaidTransaction.find({
      householdId,
      amount: { $gt: 0 },
      isPending: { $ne: true },
      isDuplicate: { $ne: true },
      date: { $gte: startDate, $lte: endDate },
    }).lean(),
    BankTransaction.find({
      householdId,
      type: 'debit',
      sourceType: 'bank',
      month,
      duplicateOfPlaid: { $ne: true },
    }).lean(),
    FixedExpensePayment.find({ householdId, monthPaid: month }).lean(),
    getFeedbackBonusByExpense(householdId),
  ]);

  const paidExpenseIds = new Set(existingPayments.map((payment) => String(payment.fixedExpenseId)));
  const usedTransactionKeys = new Set(
    existingPayments
      .filter((payment) => payment.sourceTransactionType && payment.sourceTransactionId)
      .map((payment) => `${payment.sourceTransactionType}:${String(payment.sourceTransactionId)}`)
  );

  for (const payment of existingPayments) {
    if (payment.plaidTransactionId) {
      usedTransactionKeys.add(`plaid:${String(payment.plaidTransactionId)}`);
    }
  }

  const plaidCandidates = plaidTransactions.flatMap((transaction) => {
    if (usedTransactionKeys.has(`plaid:${String(transaction._id)}`)) return [];
    return buildCandidatesFromTransaction({
      transaction,
      transactionType: 'plaid',
      fixedExpenses,
      paidExpenseIds,
      historyBonusByExpense,
    });
  });

  const bankCandidates = bankTransactions.flatMap((transaction) => {
    if (usedTransactionKeys.has(`bank:${String(transaction._id)}`)) return [];
    return buildCandidatesFromTransaction({
      transaction,
      transactionType: 'bank',
      fixedExpenses,
      paidExpenseIds,
      historyBonusByExpense,
    });
  });

  return [...plaidCandidates, ...bankCandidates]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 100);
}
