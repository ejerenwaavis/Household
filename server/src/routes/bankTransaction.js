import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import { authMiddleware, householdAuthMiddleware } from '../middleware/auth.js';
import BankTransaction from '../models/BankTransaction.js';
import ManualBankAccount from '../models/ManualBankAccount.js';
import LinkedAccount from '../models/LinkedAccount.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import CardStatement from '../models/CardStatement.js';
import CreditCard from '../models/CreditCard.js';
import { getMonthResetCutoff } from '../services/monthWorkspaceService.js';

const router = Router({ mergeParams: true });

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(raw) {
  if (!raw) return null;
  const source = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(source)) return source.substring(0, 10);

  const numeric = source.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${year}-${numeric[1].padStart(2, '0')}-${numeric[2].padStart(2, '0')}`;
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().substring(0, 10);
}

function buildAccountIdentityKey(bankName = '', accountMask = '', accountName = '') {
  const normalizedBank = normalizeText(bankName) || 'uploaded-bank';
  const normalizedAccount = normalizeText(accountName) || 'account';
  const mask = String(accountMask || '').slice(-4);
  return `${normalizedBank}|${mask || normalizedAccount}`;
}

function makeHash(householdId, accountIdentityKey, dateISO, amount, description) {
  const amountCents = Math.round((Number(amount) || 0) * 100);
  const descriptionKey = normalizeText(description).substring(0, 140);
  return createHash('sha256')
    .update(`${householdId}|${accountIdentityKey}|${dateISO || ''}|${amountCents}|${descriptionKey}`)
    .digest('hex');
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2);
}

function scoreTextMatch(left = '', right = '') {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(leftTokens.length, rightTokens.length);
}

function descriptionsComparable(left = '', right = '') {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  return scoreTextMatch(normalizedLeft, normalizedRight) >= 0.6;
}

function looksLikePlaidDuplicate(transaction, plaidTransaction) {
  const importedDate = transaction.dateISO ? new Date(transaction.dateISO) : null;
  const plaidDate = plaidTransaction?.date ? new Date(plaidTransaction.date) : null;
  if (!importedDate || !plaidDate) return false;

  const dayDiff = Math.abs(importedDate.getTime() - plaidDate.getTime());
  if (dayDiff > 2 * 24 * 60 * 60 * 1000) return false;
  if (Math.abs((Number(transaction.amount) || 0) - Math.abs(Number(plaidTransaction.amount) || 0)) > 0.01) return false;

  return descriptionsComparable(
    transaction.description,
    plaidTransaction.merchant || plaidTransaction.name || plaidTransaction.description || ''
  );
}

function previewLinkedMatch(group, linkedAccounts = []) {
  const mask = String(group.accountMask || '').slice(-4);
  const bankName = group.bankName || '';
  const accountName = group.accountName || '';

  let best = null;
  let bestScore = 0;
  for (const account of linkedAccounts) {
    let score = 0;
    if (mask && String(account.accountMask || '') === mask) score += 10;
    score += scoreTextMatch(bankName, account.accountName || '') * 4;
    score += scoreTextMatch(bankName, account.accountOfficialName || '') * 4;
    score += scoreTextMatch(accountName, account.accountName || '') * 6;
    score += scoreTextMatch(accountName, account.accountOfficialName || '') * 6;
    if (score > bestScore) {
      best = account;
      bestScore = score;
    }
  }
  return bestScore >= 6 ? best : null;
}

async function upsertManualAccount({ householdId, userId, linkedAccountId, bankName, accountName, accountMask, accountIdentityKey, sourceDocumentCount }) {
  const normalizedBankName = normalizeText(bankName) || 'uploaded-bank';
  const update = {
    userId,
    bankName: bankName || 'Uploaded Bank',
    bankNameNormalized: normalizedBankName,
    accountName: accountName || '',
    accountMask: String(accountMask || '').slice(-4),
    accountIdentityKey,
    linkedAccountId: linkedAccountId || null,
    lastImportedAt: new Date(),
    updatedAt: new Date(),
  };

  const setOnInsert = {
    householdId,
    createdAt: new Date(),
    transactionCount: 0,
  };

  const inc = sourceDocumentCount ? { sourceDocumentCount } : {};

  return ManualBankAccount.findOneAndUpdate(
    { householdId, accountIdentityKey },
    {
      $set: update,
      $setOnInsert: setOnInsert,
      $inc: inc,
    },
    { upsert: true, new: true }
  );
}

async function enrichTransactions(transactions) {
  const linkedIds = [...new Set(transactions.map((transaction) => String(transaction.linkedAccountId || '')).filter(Boolean))];
  const manualIds = [...new Set(transactions.map((transaction) => String(transaction.manualAccountId || '')).filter(Boolean))];

  const [linkedAccounts, manualAccounts] = await Promise.all([
    linkedIds.length > 0 ? LinkedAccount.find({ _id: { $in: linkedIds } }).select('accountName accountOfficialName accountMask').lean() : [],
    manualIds.length > 0 ? ManualBankAccount.find({ _id: { $in: manualIds } }).select('bankName accountName accountMask linkedAccountId').lean() : [],
  ]);

  const linkedMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));
  const manualMap = new Map(manualAccounts.map((account) => [String(account._id), account]));

  return transactions.map((transaction) => ({
    ...transaction,
    linkedAccount: transaction.linkedAccountId ? linkedMap.get(String(transaction.linkedAccountId)) || null : null,
    manualAccount: transaction.manualAccountId ? manualMap.get(String(transaction.manualAccountId)) || null : null,
  }));
}

router.get('/:householdId/accounts', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const manualAccounts = await ManualBankAccount.find({ householdId })
      .sort({ updatedAt: -1 })
      .lean();

    const linkedAccountIds = manualAccounts.map((account) => account.linkedAccountId).filter(Boolean);
    const linkedAccounts = linkedAccountIds.length > 0
      ? await LinkedAccount.find({ _id: { $in: linkedAccountIds } }).select('accountName accountMask').lean()
      : [];
    const linkedMap = new Map(linkedAccounts.map((account) => [String(account._id), account]));

    res.json({
      accounts: manualAccounts.map((account) => ({
        ...account,
        linkedAccount: account.linkedAccountId ? linkedMap.get(String(account.linkedAccountId)) || null : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:householdId', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { month, type, sourceType, creditCardId, limit = 500 } = req.query;
    const resetCutoff = month ? await getMonthResetCutoff(householdId, month) : null;

    const query = { householdId };
    if (month) query.month = month;
    if (type) query.type = type;
    if (sourceType) query.sourceType = sourceType;
    if (creditCardId) query.creditCardId = creditCardId;
    if (resetCutoff) query.createdAt = { $gte: resetCutoff };

    const transactions = await BankTransaction.find(query)
      .sort({ dateISO: -1, importedAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ transactions: await enrichTransactions(transactions), count: transactions.length });
  } catch (error) {
    next(error);
  }
});

router.post('/:householdId/import', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { transactions = [], transactionGroups = [], creditCardId = null } = req.body;

    if ((!Array.isArray(transactions) || transactions.length === 0) && (!Array.isArray(transactionGroups) || transactionGroups.length === 0)) {
      return res.status(400).json({ error: 'Provide transactions or transactionGroups to import.' });
    }

    const isCreditCardImport = Boolean(creditCardId);
    const linkedAccounts = isCreditCardImport
      ? []
      : await LinkedAccount.find({ householdId, isActive: true })
        .select('accountName accountOfficialName accountMask')
        .lean();

    const normalizedGroups = (transactionGroups.length > 0 ? transactionGroups : [{
      bankName: transactions[0]?.bank || 'Uploaded Bank',
      accountMask: transactions[0]?.accountMask || '',
      accountName: transactions[0]?.accountName || '',
      sourceFiles: [...new Set(transactions.map((transaction) => transaction.sourceDocumentName || transaction.bank || '').filter(Boolean))],
      transactions,
    }]).map((group) => {
      const bankName = group.bankName || group.bank || transactions[0]?.bank || 'Uploaded Bank';
      const accountMask = String(group.accountMask || transactions[0]?.accountMask || '').slice(-4);
      const accountName = group.accountName || '';
      const accountIdentityKey = buildAccountIdentityKey(bankName, accountMask, accountName);
      return {
        ...group,
        bankName,
        accountMask,
        accountName,
        accountIdentityKey,
        sourceFiles: Array.isArray(group.sourceFiles) ? group.sourceFiles.filter(Boolean) : [],
        transactions: Array.isArray(group.transactions) ? group.transactions : [],
      };
    }).filter((group) => group.transactions.length > 0);

    const manualAccountsByKey = new Map(
      (isCreditCardImport ? [] : await ManualBankAccount.find({ householdId }).lean())
        .map((account) => [account.accountIdentityKey, account])
    );

    const preparedTransactions = [];
    let matchedLinkedAccounts = 0;
    let createdManualAccounts = 0;

    for (const group of normalizedGroups) {
      let linkedAccount = null;
      let manualAccount = null;

      if (!isCreditCardImport) {
        linkedAccount = previewLinkedMatch(group, linkedAccounts);
        if (linkedAccount) matchedLinkedAccounts += 1;

        if (!linkedAccount) {
          manualAccount = manualAccountsByKey.get(group.accountIdentityKey) || null;
          if (!manualAccount) {
            manualAccount = await upsertManualAccount({
              householdId,
              userId: req.user.userId,
              linkedAccountId: null,
              bankName: group.bankName,
              accountName: group.accountName,
              accountMask: group.accountMask,
              accountIdentityKey: group.accountIdentityKey,
              sourceDocumentCount: group.sourceFiles.length || 1,
            });
            manualAccountsByKey.set(group.accountIdentityKey, manualAccount);
            createdManualAccounts += 1;
          }
        }
      }

      for (const transaction of group.transactions) {
        const dateISO = normalizeDate(transaction.date);
        const month = dateISO ? dateISO.substring(0, 7) : '';
        const normalizedDescription = normalizeText(transaction.description);
        const hash = makeHash(householdId, group.accountIdentityKey, dateISO, transaction.amount, transaction.description);

        preparedTransactions.push({
          householdId,
          linkedAccountId: linkedAccount?._id || null,
          manualAccountId: manualAccount?._id || null,
          date: transaction.date || '',
          dateISO: dateISO ? new Date(`${dateISO}T12:00:00Z`) : null,
          month,
          description: transaction.description || '',
          normalizedDescription,
          amount: Number(transaction.amount) || 0,
          type: transaction.type || 'debit',
          category: transaction.category || 'Other',
          bank: group.bankName,
          accountName: group.accountName || '',
          accountMask: group.accountMask || '',
          accountIdentityKey: group.accountIdentityKey,
          hash,
          transferId: transaction.transferId || null,
          transferMeta: transaction.transferMeta || null,
          source: transaction.source || 'csv',
          sourceType: isCreditCardImport ? 'credit_card' : 'bank',
          creditCardId: isCreditCardImport ? creditCardId : null,
          sourceDocumentNames: [...new Set([...(group.sourceFiles || []), transaction.sourceDocumentName].filter(Boolean))],
          importedBy: req.user.userId,
        });
      }
    }

    const existingHashes = new Set(
      (await BankTransaction.find({ householdId, hash: { $in: preparedTransactions.map((transaction) => transaction.hash) } })
        .select('hash')
        .lean())
        .map((transaction) => transaction.hash)
    );

    const toInsert = [];
    let duplicateBankTransactions = 0;
    let duplicatePlaidTransactions = 0;

    for (const transaction of preparedTransactions) {
      if (existingHashes.has(transaction.hash)) {
        duplicateBankTransactions += 1;
        continue;
      }

      if (transaction.linkedAccountId && transaction.sourceType === 'bank') {
        const candidatePlaidTransactions = await PlaidTransaction.find({
          householdId,
          linkedAccountId: transaction.linkedAccountId,
          date: transaction.dateISO
            ? {
                $gte: new Date(transaction.dateISO.getTime() - 2 * 24 * 60 * 60 * 1000),
                $lte: new Date(transaction.dateISO.getTime() + 2 * 24 * 60 * 60 * 1000),
              }
            : undefined,
          amount: {
            $gte: -Math.abs(Number(transaction.amount) || 0) - 0.01,
            $lte: Math.abs(Number(transaction.amount) || 0) + 0.01,
          },
        }).select('date amount name merchant description').lean();

        const plaidDuplicate = candidatePlaidTransactions.find((candidate) => looksLikePlaidDuplicate(transaction, candidate));
        if (plaidDuplicate) {
          duplicatePlaidTransactions += 1;
          continue;
        }
      }

      toInsert.push(transaction);
    }

    let insertedDocs = [];
    if (toInsert.length > 0) {
      insertedDocs = await BankTransaction.insertMany(toInsert, { ordered: false }).catch((error) => {
        if (error.code === 11000) return [];
        const hasNonDuplicateError = error.writeErrors?.some((writeError) => writeError.code !== 11000);
        if (hasNonDuplicateError || !error.writeErrors) throw error;
        return error.insertedDocs || [];
      });
    }

    if (creditCardId && toInsert.length > 0) {
      const creditCard = await CreditCard.findById(creditCardId).lean();
      if (creditCard) {
        const debitTotalsByMonth = {};
        toInsert.filter((transaction) => transaction.type !== 'credit').forEach((transaction) => {
          if (!transaction.month) return;
          debitTotalsByMonth[transaction.month] = (debitTotalsByMonth[transaction.month] || 0) + transaction.amount;
        });

        await Promise.all(Object.entries(debitTotalsByMonth).map(async ([month, statementBalance]) => {
          const statementDate = new Date(`${month}-15T12:00:00Z`);
          await CardStatement.findOneAndUpdate(
            { householdId, cardId: creditCardId, month },
            {
              $setOnInsert: {
                householdId,
                cardId: creditCardId,
                month,
                statementDate,
                statementName: `${creditCard.cardName} - ${month}`,
                currentBalance: creditCard.currentBalance,
              },
              $set: { statementBalance },
            },
            { upsert: true }
          );
        }));
      }
    }

    if (!isCreditCardImport) {
      const insertedByManualAccount = insertedDocs.reduce((acc, doc) => {
        if (!doc.manualAccountId) return acc;
        const key = String(doc.manualAccountId);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      await Promise.all(Object.entries(insertedByManualAccount).map(([manualAccountId, count]) => (
        ManualBankAccount.findByIdAndUpdate(manualAccountId, {
          $inc: { transactionCount: count },
          $set: { lastImportedAt: new Date(), updatedAt: new Date() },
        })
      )));
    }

    res.json({
      imported: toInsert.length,
      duplicateBankTransactions,
      duplicatePlaidTransactions,
      total: preparedTransactions.length,
      matchedLinkedAccounts,
      createdManualAccounts,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const transaction = await BankTransaction.findOneAndDelete({ _id: id, householdId });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.manualAccountId) {
      await ManualBankAccount.findByIdAndUpdate(transaction.manualAccountId, {
        $inc: { transactionCount: -1 },
        $set: { updatedAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:householdId/:id', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const { category, assignedFixedExpenseId } = req.body;

    const transaction = await BankTransaction.findOne({ _id: id, householdId });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (typeof category === 'string' && category.trim()) {
      transaction.category = category.trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedFixedExpenseId')) {
      if (
        assignedFixedExpenseId === null
        || (typeof assignedFixedExpenseId === 'string' && (
          assignedFixedExpenseId.trim() === ''
          || assignedFixedExpenseId.trim().toLowerCase() === 'none'
        ))
      ) {
        transaction.assignedFixedExpenseId = null;
      } else {
        transaction.assignedFixedExpenseId = assignedFixedExpenseId;
      }
    }

    transaction.updatedAt = new Date();
    await transaction.save();

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});

// Find transfer candidates for a given amount/date (used by review UI)
router.get('/:householdId/transfer-candidates', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { amount, date, excludeId } = req.query;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const numeric = Math.abs(Number(amount) || 0);
    const dayWindow = 1;
    const dateISO = date ? new Date(date) : null;
    const dateQuery = dateISO ? {
      $gte: new Date(dateISO.getTime() - dayWindow * 24 * 60 * 60 * 1000),
      $lte: new Date(dateISO.getTime() + dayWindow * 24 * 60 * 60 * 1000),
    } : undefined;

    const docs = await BankTransaction.find({
      householdId,
      _id: { $ne: excludeId },
      amount: { $gte: numeric - 0.01, $lte: numeric + 0.01 },
    })
      .where('dateISO').equals(dateQuery ? dateQuery : undefined)
      .sort({ dateISO: -1 })
      .limit(50)
      .lean();

    // Filter to opposite type clients typically done on client-side, but return full set
    res.json({ candidates: docs });
  } catch (error) {
    next(error);
  }
});

// Link two transactions as a transfer
router.post('/:householdId/:id/link-transfer', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const { targetTransactionId, notes } = req.body;
    if (!targetTransactionId) return res.status(400).json({ error: 'targetTransactionId required' });

    const left = await BankTransaction.findOne({ _id: id, householdId });
    const right = await BankTransaction.findOne({ _id: targetTransactionId, householdId });
    if (!left || !right) return res.status(404).json({ error: 'Transaction(s) not found' });

    const transferId = randomUUID();
    const transferMetaLeft = {
      fromAccountIdentityKey: left.accountIdentityKey || left.accountIdentityKey,
      toAccountIdentityKey: right.accountIdentityKey || right.accountIdentityKey,
      matchedBy: 'manual',
      matchedAt: new Date(),
      notes: notes || '',
    };
    const transferMetaRight = {
      fromAccountIdentityKey: left.accountIdentityKey || left.accountIdentityKey,
      toAccountIdentityKey: right.accountIdentityKey || right.accountIdentityKey,
      matchedBy: 'manual',
      matchedAt: new Date(),
      notes: notes || '',
    };

    await Promise.all([
      BankTransaction.findByIdAndUpdate(left._id, { transferId, transferMeta: transferMetaLeft }),
      BankTransaction.findByIdAndUpdate(right._id, { transferId, transferMeta: transferMetaRight }),
    ]);

    res.json({ success: true, transferId });
  } catch (error) {
    next(error);
  }
});

// Unlink a transfer (by transaction id)
router.post('/:householdId/:id/unlink-transfer', authMiddleware, householdAuthMiddleware, async (req, res, next) => {
  try {
    const { householdId, id } = req.params;
    const tx = await BankTransaction.findOne({ _id: id, householdId }).lean();
    if (!tx || !tx.transferId) return res.status(404).json({ error: 'Transfer not found on transaction' });

    const transferId = tx.transferId;
    await BankTransaction.updateMany({ householdId, transferId }, { $set: { transferId: null, transferMeta: null } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
