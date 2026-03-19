/**
 * Duplicate Transaction Detection Service
 *
 * Scans recently-synced Plaid transactions for pairs that appear to be
 * duplicates: same household, amount within $0.01, date within 1 day,
 * and a similar merchant/name string. The later transaction is flagged
 * with isDuplicate=true and a reference to the original.
 *
 * Resolution options for the user:
 *   "keep"    – the pair is NOT a real duplicate; unmark the flag.
 *   "dismiss" – confirmed duplicate; permanently remove the flagged copy.
 */

import PlaidTransaction from '../models/PlaidTransaction.js';
import logger from '../utils/logger.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT_TOLERANCE = 0.01;
// Look back this many days when scanning for duplicates during a sync
const SCAN_WINDOW_DAYS = 60;

/**
 * Normalise a transaction name / merchant for comparison.
 * Strips punctuation, collapses whitespace, lowercases.
 */
function normaliseName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true when two name strings are similar enough to indicate the
 * same merchant/payee.  Uses a simple word-overlap Jaccard coefficient
 * with a fallback for short strings.
 */
function namesSimilar(a, b) {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // One is a substring of the other
  if (na.includes(nb) || nb.includes(na)) return true;
  // Jaccard similarity on word tokens
  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 && intersection / union >= 0.5;
}

/**
 * Scan transactions for `householdId` from the last SCAN_WINDOW_DAYS days,
 * flag any that look like duplicates, and return the count newly marked.
 *
 * Safe to call multiple times – already-flagged transactions are skipped.
 */
export async function detectAndMarkDuplicates(householdId) {
  const since = new Date(Date.now() - SCAN_WINDOW_DAYS * ONE_DAY_MS);

  // Fetch transactions sorted by date ascending so we can use a forward window
  const txns = await PlaidTransaction.find({
    householdId,
    date: { $gte: since },
  })
    .sort({ date: 1, _id: 1 })
    .lean();

  let marked = 0;

  for (let i = 0; i < txns.length; i++) {
    const a = txns[i];
    // Skip transactions that are already flagged as duplicates
    if (a.isDuplicate) continue;

    for (let j = i + 1; j < txns.length; j++) {
      const b = txns[j];
      // Dates are sorted ascending — once b is more than 1 day ahead of a, stop inner loop
      if (new Date(b.date) - new Date(a.date) > ONE_DAY_MS) break;
      if (b.isDuplicate) continue;

      // Amount must match within tolerance
      if (Math.abs(a.amount - b.amount) > AMOUNT_TOLERANCE) continue;

      // Name / merchant must be similar
      const aName = a.merchant || a.name;
      const bName = b.merchant || b.name;
      if (!namesSimilar(aName, bName)) continue;

      // b is a likely duplicate of a — mark it
      await PlaidTransaction.findByIdAndUpdate(b._id, {
        isDuplicate: true,
        isReconciled: false,
        reconciliationReason: 'duplicate_review',
        reconciledAt: null,
        originalTransactionId: a._id,
        updatedAt: new Date(),
      });
      marked++;
    }
  }

  if (marked > 0) {
    logger.info(`[DuplicateDetection] Marked ${marked} duplicate(s) for household ${householdId}`);
  }
  return marked;
}

/**
 * Resolve a duplicate transaction flagged by `detectAndMarkDuplicates`.
 *
 * @param {string} transactionId  MongoDB _id of the flagged (duplicate) transaction
 * @param {string} householdId    Must match the owning household (security guard)
 * @param {'keep'|'dismiss'} action
 *   keep    – unmark isDuplicate; user says it is actually a separate transaction
 *   dismiss – permanently remove the duplicate copy from the database
 */
export async function resolveDuplicate(transactionId, householdId, action) {
  if (action === 'keep') {
    const txn = await PlaidTransaction.findOneAndUpdate(
      { _id: transactionId, householdId },
      { isDuplicate: false, isReconciled: false, reconciliationReason: 'unreviewed', reconciledAt: null, originalTransactionId: null, updatedAt: new Date() },
      { new: true }
    );
    if (!txn) throw new Error('Transaction not found');
    return { action: 'kept', transactionId };
  }

  if (action === 'dismiss') {
    // Permanently delete the duplicate copy.
    // The original (originalTransactionId) is preserved.
    // Plaid's plaidTransactionId upsert logic prevents re-import.
    const txn = await PlaidTransaction.findOneAndDelete({ _id: transactionId, householdId });
    if (!txn) throw new Error('Transaction not found');
    return { action: 'dismissed', transactionId };
  }

  throw new Error('Invalid action. Use "keep" or "dismiss".');
}
