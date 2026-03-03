import { Router } from 'express';
import { createHash } from 'crypto';
import { authMiddleware, householdAuthMiddleware } from '../middleware/auth.js';
import BankTransaction from '../models/BankTransaction.js';

const router = Router({ mergeParams: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a raw date string (MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD) to "YYYY-MM-DD".
 * Returns null if the string can't be parsed.
 */
function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // MM/DD/YYYY or M/D/YYYY or M-D-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Build a deterministic SHA-256 dedup hash.
 * Two transactions with the same date, amount (to the cent), and normalised
 * description in the same household are considered identical.
 */
function makeHash(householdId, dateISO, amount, description) {
  const amtCents = Math.round((Number(amount) || 0) * 100);
  const descNorm = (description || '').toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 120);
  return createHash('sha256')
    .update(`${householdId}|${dateISO || ''}|${amtCents}|${descNorm}`)
    .digest('hex');
}

// ── GET /:householdId  — fetch saved transactions (optionally filtered by month) ──

router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month, type, limit = 1000 } = req.query;

    const query = { householdId };
    if (month)  query.month = month;
    if (type)   query.type  = type;

    const transactions = await BankTransaction.find(query)
      .sort({ dateISO: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ transactions, count: transactions.length });
  } catch (err) {
    next(err);
  }
});

// ── POST /:householdId/import  — bulk import with SHA-256 deduplication ────────

router.post('/:householdId/import', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { transactions = [] } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required and must not be empty' });
    }

    // Enrich each incoming transaction with hash + normalised date
    const enriched = transactions.map(t => {
      const dateISO  = normalizeDate(t.date);
      const month    = dateISO ? dateISO.substring(0, 7) : '';
      const hash     = makeHash(householdId, dateISO, t.amount, t.description);
      return {
        householdId,
        date:        t.date        || '',
        dateISO:     dateISO ? new Date(`${dateISO}T12:00:00Z`) : null,
        month,
        description: t.description || '',
        amount:      Number(t.amount) || 0,
        type:        t.type        || 'debit',
        category:    t.category    || 'Other',
        bank:        t.bank        || '',
        hash,
        source:      t.source      || 'csv',
        importedBy:  req.user.userId,
      };
    });

    // Find which hashes already exist in this household
    const hashes   = enriched.map(t => t.hash);
    const existing = await BankTransaction.find({ householdId, hash: { $in: hashes } })
      .select('hash').lean();
    const existingSet = new Set(existing.map(e => e.hash));

    const toInsert   = enriched.filter(t => !existingSet.has(t.hash));
    const duplicates = enriched.length - toInsert.length;

    if (toInsert.length > 0) {
      await BankTransaction.insertMany(toInsert, { ordered: false }).catch(err => {
        // Tolerate duplicate-key errors from concurrent imports (race condition safety)
        if (err.code === 11000) return;
        const hasNonDupeError = err.writeErrors?.some(e => e.code !== 11000);
        if (hasNonDupeError || !err.writeErrors) throw err;
      });
    }

    console.log(`[bankTxn import] householdId=${householdId} imported=${toInsert.length} duplicates=${duplicates}`);
    res.json({ imported: toInsert.length, duplicates, total: enriched.length });
  } catch (err) {
    console.error('[bankTxn import] error:', err);
    next(err);
  }
});

// ── DELETE /:householdId/:id  — remove a single saved transaction ─────────────

router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const doc = await BankTransaction.findOneAndDelete({ _id: id, householdId });
    if (!doc) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
