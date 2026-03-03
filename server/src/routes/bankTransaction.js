import { Router } from 'express';
import { createHash } from 'crypto';
import { authMiddleware, householdAuthMiddleware } from '../middleware/auth.js';
import BankTransaction from '../models/BankTransaction.js';
import CreditCard from '../models/CreditCard.js';
import CardStatement from '../models/CardStatement.js';
import PaymentSuggestion from '../models/PaymentSuggestion.js';

const router = Router({ mergeParams: true });

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

/**
 * Returns true when a bank transaction description plausibly matches a card.
 * Matches card name, holder, or the card's linkedBankName keyword.
 */
function looksLikePayment(txnDesc, card) {
  const desc = txnDesc.toLowerCase();
  const cardNameWords = card.cardName.toLowerCase().split(/\s+/);
  // Require at least one meaningful word (>3 chars) from the card name to appear
  const nameMatch = cardNameWords.some(w => w.length > 3 && desc.includes(w));
  if (nameMatch) return true;
  if (card.linkedBankName) {
    const bankWords = card.linkedBankName.toLowerCase().split(/\s+/);
    return bankWords.some(w => w.length > 3 && desc.includes(w));
  }
  return false;
}

// â”€â”€ GET /:householdId  â€” fetch saved transactions (optionally filtered by month) â”€â”€

router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month, type, sourceType, creditCardId, limit = 1000 } = req.query;

    const query = { householdId };
    if (month)        query.month = month;
    if (type)         query.type  = type;
    if (sourceType)   query.sourceType = sourceType;
    if (creditCardId) query.creditCardId = creditCardId;

    const transactions = await BankTransaction.find(query)
      .sort({ dateISO: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ transactions, count: transactions.length });
  } catch (err) {
    next(err);
  }
});

// â”€â”€ POST /:householdId/import  â€” bulk import with SHA-256 deduplication â”€â”€â”€â”€â”€â”€â”€â”€

router.post('/:householdId/import', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { transactions = [], creditCardId = null } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required and must not be empty' });
    }

    const isCreditCard = !!creditCardId;

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
        sourceType:  isCreditCard ? 'credit_card' : 'bank',
        creditCardId: isCreditCard ? creditCardId : null,
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

    let inserted = [];
    if (toInsert.length > 0) {
      inserted = await BankTransaction.insertMany(toInsert, { ordered: false }).catch(err => {
        // Tolerate duplicate-key errors from concurrent imports (race condition safety)
        if (err.code === 11000) return [];
        const hasNonDupeError = err.writeErrors?.some(e => e.code !== 11000);
        if (hasNonDupeError || !err.writeErrors) throw err;
        return err.insertedDocs || [];
      });
    }

    console.log(`[bankTxn import] householdId=${householdId} imported=${toInsert.length} duplicates=${duplicates} creditCard=${creditCardId || 'none'}`);

    let suggestions = 0;
    let statementsUpserted = 0;

    if (isCreditCard && toInsert.length > 0) {
      // â”€â”€ Phase 4: Auto-generate / update CardStatement from CC rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Group inserted debit rows by month, sum amounts
      const debitsByMonth = {};
      toInsert.filter(t => t.type !== 'credit').forEach(t => {
        if (!t.month) return;
        debitsByMonth[t.month] = (debitsByMonth[t.month] || 0) + t.amount;
      });

      const card = await CreditCard.findById(creditCardId).lean();
      if (card) {
        for (const [month, totalAmount] of Object.entries(debitsByMonth)) {
          try {
            const statDate = new Date(`${month}-15T12:00:00Z`);
            await CardStatement.findOneAndUpdate(
              { householdId, cardId: creditCardId, month },
              {
                $setOnInsert: {
                  householdId,
                  cardId: creditCardId,
                  month,
                  statementDate: statDate,
                  statementName: `${card.cardName} - ${month}`,
                  currentBalance: card.currentBalance,
                },
                $set: { statementBalance: totalAmount },
              },
              { upsert: true, new: true }
            );
            statementsUpserted++;
          } catch (e) {
            console.warn(`[bankTxn import] CardStatement upsert failed for ${month}:`, e.message);
          }
        }
      }
    } else if (!isCreditCard && toInsert.length > 0) {
      // â”€â”€ Phase 2: Detect potential credit card payments in bank statement rows â”€
      const cards = await CreditCard.find({ householdId, isActive: true }).lean();
      const linkedCards = cards.filter(c => c.linkedBankName || c.cardName);

      if (linkedCards.length > 0) {
        const debitRows = toInsert.filter(t => t.type !== 'credit');

        for (const txn of debitRows) {
          for (const card of linkedCards) {
            if (!looksLikePayment(txn.description, card)) continue;

            // Don't suggest if a DebtPayment already exists for this card/month/amount
            const alreadySuggested = await PaymentSuggestion.exists({
              householdId,
              cardId: card._id,
              status: { $in: ['pending', 'confirmed'] },
              amount: txn.amount,
              month: txn.month,
            });
            if (alreadySuggested) continue;

            // Find the BankTransaction doc we just inserted (to get its _id)
            const btDoc = inserted.find ? inserted.find(d => d.hash === txn.hash) : null;
            const bankTransactionId = btDoc?._id || null;
            if (!bankTransactionId) continue;

            try {
              await PaymentSuggestion.create({
                householdId,
                bankTransactionId,
                cardId: card._id,
                cardName: card.cardName,
                amount: txn.amount,
                date: txn.date,
                month: txn.month,
                description: txn.description,
              });
              suggestions++;
            } catch (e) {
              if (e.code !== 11000) console.warn('[bankTxn] suggestion create failed:', e.message);
            }
          }
        }
      }
    }

    res.json({
      imported: toInsert.length,
      duplicates,
      total: enriched.length,
      suggestions,
      statementsUpserted,
    });
  } catch (err) {
    console.error('[bankTxn import] error:', err);
    next(err);
  }
});

// â”€â”€ DELETE /:householdId/:id  â€” remove a single saved transaction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
