import FixedExpensePayment from '../models/FixedExpensePayment.js';
import LinkedAccount from '../models/LinkedAccount.js';
import { isLikelySyncedIncomeTransaction } from './unifiedIncomeService.js';

const RECONCILIATION_LABELS = {
  manual_review: 'Reviewed manually',
  fixed_expense_payment: 'Matched to fixed expense payment',
  synced_income: 'Matched as synced income',
  duplicate_review: 'Needs duplicate review',
  categorized_unreviewed: 'Category suggested - needs review',
  unreviewed: 'Needs review',
};

export function getAutoReconciliationState(transaction, linkedAccount, options = {}) {
  if (transaction?.isDuplicate) {
    return {
      isReconciled: false,
      reconciliationReason: 'duplicate_review',
      reconciledAt: null,
    };
  }

  if (options.hasFixedExpensePayment) {
    return {
      isReconciled: true,
      reconciliationReason: 'fixed_expense_payment',
      reconciledAt: transaction?.reconciledAt || new Date(),
    };
  }

  if (linkedAccount && isLikelySyncedIncomeTransaction(transaction, linkedAccount)) {
    return {
      isReconciled: true,
      reconciliationReason: 'synced_income',
      reconciledAt: transaction?.reconciledAt || new Date(),
    };
  }

  return {
    isReconciled: false,
    reconciliationReason: transaction?.userCategory ? 'categorized_unreviewed' : 'unreviewed',
    reconciledAt: null,
  };
}

export function buildReconciliationDetails(transaction, linkedAccount, options = {}) {
  const storedReason = transaction?.reconciliationReason;
  let reason = storedReason;
  let isReconciled = Boolean(transaction?.isReconciled);

  if (!reason) {
    const derived = getAutoReconciliationState(transaction, linkedAccount, options);
    reason = derived.reconciliationReason;
    isReconciled = derived.isReconciled;
  }

  if (!isReconciled && transaction?.isDuplicate) {
    reason = 'duplicate_review';
  }

  const label = RECONCILIATION_LABELS[reason] || (isReconciled ? 'Reconciled' : 'Needs review');
  return {
    reason,
    label,
    isAuto: reason === 'fixed_expense_payment' || reason === 'synced_income',
    needsReview: !isReconciled,
  };
}

export async function buildTransactionEnrichment(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const linkedAccountIds = [...new Set(transactions.map((transaction) => String(transaction.linkedAccountId)).filter(Boolean))];
  const transactionIds = transactions.map((transaction) => transaction._id);

  const [linkedAccounts, fixedExpensePayments] = await Promise.all([
    LinkedAccount.find({ _id: { $in: linkedAccountIds } }).select('accountType accountSubtype accountName').lean(),
    FixedExpensePayment.find({ plaidTransactionId: { $in: transactionIds } }).select('plaidTransactionId fixedExpenseId').lean(),
  ]);

  const linkedAccountMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const fixedExpenseTxnIds = new Set(fixedExpensePayments.map((payment) => String(payment.plaidTransactionId)));

  return transactions.map((transaction) => ({
    ...transaction,
    reconciliationDetails: buildReconciliationDetails(
      transaction,
      linkedAccountMap.get(String(transaction.linkedAccountId)) || null,
      { hasFixedExpensePayment: fixedExpenseTxnIds.has(String(transaction._id)) }
    ),
  }));
}