/**
 * Recurring Transaction Detection Service
 *
 * Scans the last N months of PlaidTransactions for a household and identifies
 * transactions that appear to recur monthly (e.g. subscriptions, rent, loan payments).
 *
 * A transaction is considered recurring when:
 *  - The same merchant/description appears in at least RECURRENCE_MIN_MONTHS consecutive months
 *  - The amounts are within AMOUNT_VARIANCE_PCT of each other
 *
 * Returns a list of detected recurring patterns with:
 *  - merchant / description
 *  - estimated monthly amount (median)
 *  - confidence (0–1)
 *  - occurrences array
 */

import PlaidTransaction from '../models/PlaidTransaction.js';
import logger from '../utils/logger.js';

const SCAN_MONTHS = 3;
const RECURRENCE_MIN_MONTHS = 2;    // must appear in at least this many months
const AMOUNT_VARIANCE_PCT = 0.15;   // allow 15% variance in amount

function normalizeLabel(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Given a list of transactions, group them by a normalized merchant/description label.
 * Returns a Map of label → list of { month, amount } occurrences.
 */
function groupByLabel(transactions) {
  const groups = new Map();
  for (const txn of transactions) {
    const label = normalizeLabel(txn.merchant || txn.name || txn.description || '');
    if (!label || label.length < 3) continue;

    const existing = groups.get(label) || [];
    existing.push({
      _id: txn._id,
      month: txn.date ? String(txn.date).substring(0, 7) : null,
      amount: Math.abs(Number(txn.amount) || 0),
      date: txn.date,
      merchant: txn.merchant || txn.name || txn.description,
      category: txn.userCategory || txn.primaryCategory || 'Other',
    });
    groups.set(label, existing);
  }
  return groups;
}

/**
 * Detect recurring transaction patterns for a household.
 * @param {string} householdId
 * @param {number} [scanMonths=3]  How many months of history to scan.
 * @returns {Promise<Array>}       Sorted list of recurring patterns (highest confidence first).
 */
export async function detectRecurringTransactions(householdId, scanMonths = SCAN_MONTHS) {
  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - scanMonths);

    const transactions = await PlaidTransaction.find({
      householdId,
      date: { $gte: cutoff },
      isInternalTransferNeutralized: { $ne: true },
      isDuplicate: false,
    })
      .select('_id date amount name merchant description userCategory primaryCategory')
      .lean();

    if (!transactions.length) return [];

    const groups = groupByLabel(transactions);
    const recurring = [];

    for (const [label, occurrences] of groups.entries()) {
      // Group occurrences by month
      const byMonth = {};
      for (const occ of occurrences) {
        if (!occ.month) continue;
        if (!byMonth[occ.month]) byMonth[occ.month] = [];
        byMonth[occ.month].push(occ);
      }

      const months = Object.keys(byMonth).sort();
      if (months.length < RECURRENCE_MIN_MONTHS) continue;

      // Take one representative per month (smallest to avoid duplicates/fees)
      const monthlyAmounts = months.map((m) => Math.min(...byMonth[m].map((o) => o.amount)));
      const medianAmount = median(monthlyAmounts);

      // Check amount consistency
      const allClose = monthlyAmounts.every(
        (amt) => Math.abs(amt - medianAmount) / (medianAmount || 1) <= AMOUNT_VARIANCE_PCT
      );
      if (!allClose) continue;

      const confidence = Math.min(0.5 + (months.length / scanMonths) * 0.5, 1.0);

      // Pick best representation from the most recent month
      const latestMonth = months[months.length - 1];
      const representative = byMonth[latestMonth][0];

      recurring.push({
        label,
        merchant: representative.merchant,
        category: representative.category,
        estimatedMonthlyAmount: parseFloat(medianAmount.toFixed(2)),
        monthsDetected: months.length,
        confidence: parseFloat(confidence.toFixed(2)),
        occurrences: months.map((m) => ({
          month: m,
          amount: parseFloat(Math.min(...byMonth[m].map((o) => o.amount)).toFixed(2)),
          transactionId: byMonth[m][0]._id,
          date: byMonth[m][0].date,
        })),
      });
    }

    // Sort by confidence desc, then amount desc
    recurring.sort((a, b) => b.confidence - a.confidence || b.estimatedMonthlyAmount - a.estimatedMonthlyAmount);

    logger.info('[RecurringTxn] Detection complete:', { householdId, found: recurring.length });
    return recurring;
  } catch (error) {
    logger.error('[RecurringTxn] Detection failed:', error);
    throw error;
  }
}
