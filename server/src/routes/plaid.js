/**
 * Plaid Integration Routes
 * Handles bank account linking, token exchange, and account management via Plaid
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import PlaidService from '../services/plaidService.js';
import LinkedAccount from '../models/LinkedAccount.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import User from '../models/User.js';
import { handlePlaidWebhook } from '../webhooks/plaidWebhook.js';
import { syncAllTransactions, syncAccountTransactions } from '../services/transactionSyncService.js';
import { resolveDuplicate, detectAndMarkDuplicates } from '../services/duplicateDetectionService.js';

const router = Router();

/**
 * POST /plaid/create-link-token
 * Create a link token for starting the Plaid Link flow
 * User needs this token to securely connect their bank account
 */
router.post('/create-link-token', authMiddleware, async (req, res, next) => {
  try {
    const { userId, householdId } = req.user;

    // Require passkey OR MFA before allowing bank linking
    const user = await User.findOne({ userId });
    const has2FA = user?.mfaEnabled || (user?.passkeys?.length > 0);
    if (!has2FA) {
      return res.status(403).json({
        error: '2FA_REQUIRED',
        message: 'A passkey or authenticator-app (2FA) is required before linking a bank account.',
      });
    }

    console.log('[Plaid Route] Creating link token for user:', { userId, householdId });

    const { linkToken, expiration } = await PlaidService.createLinkToken(userId, householdId);

    res.json({
      linkToken,
      expiration,
      message: 'Link token created successfully'
    });
  } catch (error) {
    console.error('[Plaid Route] Error creating link token:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_LINK_TOKEN_ERROR'
    });
  }
});

/**
 * POST /plaid/exchange-token
 * Exchange the public token (from Plaid Link) for an access token
 * This completes the account linking process
 */
router.post('/exchange-token', authMiddleware, async (req, res, next) => {
  try {
    const { publicToken, metadata } = req.body;
    const { userId, householdId } = req.user;

    if (!publicToken) {
      return res.status(400).json({ error: 'Public token is required' });
    }

    console.log('[Plaid Route] Exchanging public token for user:', { userId, householdId });

    // Exchange public token for access token and item ID
    const { accessToken, itemId } = await PlaidService.exchangePublicToken(publicToken);

    // Fetch accounts for this item
    const accounts = await PlaidService.getAccounts(accessToken);
    console.log('[Plaid Route] Retrieved accounts:', accounts.length);

    // Store linked accounts in database (upsert to handle re-linking the same institution)
    const linkedAccounts = [];
    
    for (const account of accounts) {
      const linkedAccount = await LinkedAccount.findOneAndUpdate(
        { householdId, plaidItemId: itemId, plaidAccountId: account.accountId },
        {
          $set: {
            userId,
            plaidAccessToken: accessToken, // TODO: Encrypt in production
            plaidInstitutionId: metadata?.institution?.institution_id,
            plaidAccountId: account.accountId,
            accountName: account.name,
            accountOfficialName: account.officialName,
            accountType: account.type,
            accountSubtype: account.subtype,
            accountMask: account.mask,
            currentBalance: account.balances.current,
            availableBalance: account.balances.available,
            creditLimit: account.balances.limit,
            currencyCode: account.balances.isoCurrencyCode,
            isActive: true,
            syncStatus: 'pending',
            updatedAt: new Date(),
          },
          $setOnInsert: { linkedAt: new Date() },
        },
        { upsert: true, new: true }
      );

      linkedAccounts.push({
        _id: linkedAccount._id,
        accountName: linkedAccount.accountName,
        accountType: linkedAccount.accountType,
        accountMask: linkedAccount.accountMask,
        currentBalance: linkedAccount.currentBalance,
      });
    }

    console.log('[Plaid Route] Linked accounts created:', linkedAccounts.length);

    res.status(201).json({
      itemId,
      linkedAccounts,
      message: `Successfully linked ${accounts.length} account(s)`
    });
  } catch (error) {
    console.error('[Plaid Route] Error exchanging token:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_EXCHANGE_ERROR'
    });
  }
});

/**
 * GET /plaid/linked-accounts
 * Get all linked accounts for the household
 */
router.get('/linked-accounts', authMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.user;

    const linkedAccounts = await LinkedAccount.find({
      householdId,
      isActive: true
    }).sort({ linkedAt: -1 });

    res.json({
      linkedAccounts,
      count: linkedAccounts.length
    });
  } catch (error) {
    console.error('[Plaid Route] Error fetching linked accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /plaid/account-balance/:accountId
 * Get current balance for a linked account from Plaid
 */
router.get('/account-balance/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { householdId } = req.user;

    const linkedAccount = await LinkedAccount.findOne({
      _id: accountId,
      householdId
    });

    if (!linkedAccount) {
      return res.status(404).json({ error: 'Linked account not found' });
    }

    // Get real-time balance from Plaid
    const balances = await PlaidService.getBalance(linkedAccount.plaidAccessToken, [linkedAccount.plaidAccountId]);

    if (balances.length === 0) {
      return res.status(400).json({ error: 'Unable to fetch balance from Plaid' });
    }

    const balance = balances[0];

    // Update our record
    linkedAccount.currentBalance = balance.balances.current;
    linkedAccount.availableBalance = balance.balances.available;
    linkedAccount.creditLimit = balance.balances.limit;
    linkedAccount.updatedAt = new Date();
    await linkedAccount.save();

    res.json({
      accountName: linkedAccount.accountName,
      currentBalance: balance.balances.current,
      availableBalance: balance.balances.available,
      creditLimit: balance.balances.limit,
      currencyCode: balance.balances.iso_currency_code,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('[Plaid Route] Error fetching balance:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_BALANCE_ERROR'
    });
  }
});

/**
 * DELETE /plaid/unlink/:accountId
 * Remove a linked account (unlink from Plaid)
 */
router.delete('/unlink/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { householdId } = req.user;

    const linkedAccount = await LinkedAccount.findOne({
      _id: accountId,
      householdId
    });

    if (!linkedAccount) {
      return res.status(404).json({ error: 'Linked account not found' });
    }

    // Remove from Plaid
    await PlaidService.removeItem(linkedAccount.plaidAccessToken);

    // Mark as inactive in database instead of deleting
    linkedAccount.isActive = false;
    linkedAccount.syncStatus = 'suspended';
    await linkedAccount.save();

    console.log('[Plaid Route] Account unlinked:', { accountId, householdId });

    res.json({
      message: 'Account successfully unlinked',
      accountId
    });
  } catch (error) {
    console.error('[Plaid Route] Error unlinking account:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_UNLINK_ERROR'
    });
  }
});

/**
 * GET /plaid/sync-status/:accountId
 * Get sync status and item information for a linked account
 */
router.get('/sync-status/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { householdId } = req.user;

    const linkedAccount = await LinkedAccount.findOne({
      _id: accountId,
      householdId
    });

    if (!linkedAccount) {
      return res.status(404).json({ error: 'Linked account not found' });
    }

    // Get item status from Plaid
    const itemStatus = await PlaidService.getItemStatus(linkedAccount.plaidAccessToken);

    res.json({
      accountName: linkedAccount.accountName,
      syncStatus: linkedAccount.syncStatus,
      lastSyncedAt: linkedAccount.lastSyncedAt,
      transactionCount: linkedAccount.transactionCount,
      itemStatus,
      lastSyncError: linkedAccount.lastSyncError
    });
  } catch (error) {
    console.error('[Plaid Route] Error fetching sync status:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_SYNC_ERROR'
    });
  }
});

/**
 * POST /plaid/set-default/:accountId
 * Set an account as the default for the household
 */
router.post('/set-default/:accountId', authMiddleware, async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { householdId } = req.user;

    // Clear all existing defaults for this household
    await LinkedAccount.updateMany(
      { householdId },
      { isDefault: false }
    );

    // Set the selected account as default
    const linkedAccount = await LinkedAccount.findOneAndUpdate(
      { _id: accountId, householdId },
      { isDefault: true, updatedAt: new Date() },
      { new: true }
    );

    if (!linkedAccount) {
      return res.status(404).json({ error: 'Linked account not found' });
    }

    res.json({
      message: 'Default account updated',
      accountName: linkedAccount.accountName
    });
  } catch (error) {
    console.error('[Plaid Route] Error setting default account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /plaid/transactions
 * Get transactions for all linked accounts (paginated)
 */
router.get('/transactions', authMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.user;
    const { accountId, month, limit = 50, offset = 0, isReconciled, isDuplicate } = req.query;

    console.log('[Plaid Route] Fetching transactions', { householdId, accountId, month, limit, offset });

    // Build filter
    const filter = { householdId };
    if (accountId) {
      filter.linkedAccountId = accountId;
    }
    if (month) {
      // Filter by month (YYYY-MM format)
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    }
    if (isReconciled !== undefined) {
      filter.isReconciled = isReconciled === 'true';
    }
    if (isDuplicate !== undefined) {
      filter.isDuplicate = isDuplicate === 'true';
    }

    // Get total count
    const total = await PlaidTransaction.countDocuments(filter);

    // Get paginated transactions
    const transactions = await PlaidTransaction.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    res.json({
      transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('[Plaid Route] Error fetching transactions:', error);
    res.status(400).json({ 
      error: error.message,
      code: 'PLAID_TRANSACTIONS_ERROR'
    });
  }
});

/**
 * GET /plaid/transactions/:transactionId
 * Get a specific transaction
 */
router.get('/transactions/:transactionId', authMiddleware, async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { householdId } = req.user;

    const transaction = await PlaidTransaction.findOne({
      _id: transactionId,
      householdId
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('[Plaid Route] Error fetching transaction:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /plaid/transactions/:transactionId
 * Update transaction (categorization, reconciliation, etc.)
 */
router.patch('/transactions/:transactionId', authMiddleware, async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const { householdId } = req.user;
    const { userCategory, isReconciled, reconcilationNotes } = req.body;

    const transaction = await PlaidTransaction.findOneAndUpdate(
      { _id: transactionId, householdId },
      {
        ...(userCategory && { userCategory }),
        ...(isReconciled !== undefined && { isReconciled }),
        ...(reconcilationNotes && { reconcilationNotes }),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      message: 'Transaction updated',
      transaction
    });
  } catch (error) {
    console.error('[Plaid Route] Error updating transaction:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /plaid/transactions-summary
 * Get transaction summary/statistics
 */
router.get('/transactions-summary', authMiddleware, async (req, res, next) => {
  try {
    const { householdId } = req.user;
    const { month } = req.query;

    const filter = { householdId };
    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0, 23, 59, 59);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    // Get aggregated statistics
    const summary = await PlaidTransaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$primaryCategory',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
          avg: { $avg: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ summary });
  } catch (error) {
    console.error('[Plaid Route] Error fetching summary:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /plaid/sync-now
 * Manually trigger a full transaction sync for all linked accounts
 */
router.post('/sync-now', authMiddleware, async (req, res) => {
  try {
    const { householdId } = req.user;
    const accounts = await LinkedAccount.find({ householdId, isActive: true });
    if (accounts.length === 0) {
      return res.json({ message: 'No linked accounts to sync', synced: 0 });
    }
    let totalSynced = 0, totalErrors = 0;
    for (const account of accounts) {
      try {
        const result = await syncAccountTransactions(account);
        totalSynced += result.synced || 0;
      } catch (e) {
        totalErrors++;
      }
    }
    res.json({ message: `Sync complete`, synced: totalSynced, errors: totalErrors, accounts: accounts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /plaid/update-all-webhooks
 * One-time admin operation: registers the webhook URL with every existing Plaid item
 * so Plaid sends real-time transaction events to this server.
 * Restricted to household owners.
 */
router.post('/update-all-webhooks', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Owner role required' });
    }

    const webhookUrl = process.env.PLAID_WEBHOOK_URL ||
      `${process.env.API_URL || 'https://api.aceddivision.com'}/api/plaid/webhook`;

    // Unique access tokens — multiple DB accounts can share one Plaid item
    const allAccounts = await LinkedAccount.find({ isActive: true }).lean();
    const seen = new Set();
    const unique = allAccounts.filter(a => {
      if (seen.has(a.plaidAccessToken)) return false;
      seen.add(a.plaidAccessToken);
      return true;
    });

    const results = [];
    for (const account of unique) {
      try {
        await PlaidService.updateItemWebhook(account.plaidAccessToken, webhookUrl);
        results.push({ itemId: account.plaidItemId, accountName: account.accountName, status: 'updated' });
      } catch (err) {
        results.push({ itemId: account.plaidItemId, accountName: account.accountName, status: 'error', error: err.message });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const errors  = results.filter(r => r.status === 'error').length;

    console.log('[Plaid] Webhook backfill complete:', { webhookUrl, updated, errors });
    res.json({ webhookUrl, total: unique.length, updated, errors, results });
  } catch (error) {
    console.error('[Plaid] Error updating all webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /plaid/duplicates
 * Returns all transactions flagged as duplicates for the household,
 * along with the original transaction they were matched against.
 */
router.get('/duplicates', authMiddleware, async (req, res) => {
  try {
    const { householdId } = req.user;

    const duplicates = await PlaidTransaction.find({ householdId, isDuplicate: true })
      .sort({ date: -1 })
      .lean();

    // Attach original transaction data so the UI can show what it matched against
    const originalIds = duplicates
      .map(d => d.originalTransactionId)
      .filter(Boolean);

    const originals = await PlaidTransaction.find({ _id: { $in: originalIds } }).lean();
    const originalsMap = Object.fromEntries(originals.map(o => [String(o._id), o]));

    const enriched = duplicates.map(d => ({
      ...d,
      originalTransaction: d.originalTransactionId
        ? (originalsMap[String(d.originalTransactionId)] || null)
        : null,
    }));

    res.json({ duplicates: enriched, count: enriched.length });
  } catch (error) {
    console.error('[Plaid Route] Error fetching duplicates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /plaid/transactions/:transactionId/resolve-duplicate
 * Resolve a flagged duplicate transaction.
 * Body: { action: 'keep' | 'dismiss' }
 *   keep    – unmark; user says the two transactions are genuinely distinct
 *   dismiss – delete the duplicate copy permanently
 */
router.post('/transactions/:transactionId/resolve-duplicate', authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { householdId } = req.user;
    const { action } = req.body;

    if (!['keep', 'dismiss'].includes(action)) {
      return res.status(400).json({ error: 'action must be "keep" or "dismiss"' });
    }

    const result = await resolveDuplicate(transactionId, householdId, action);
    res.json({ message: 'Duplicate resolved', ...result });
  } catch (error) {
    console.error('[Plaid Route] Error resolving duplicate:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /plaid/webhook
 * Webhook endpoint for Plaid real-time updates
 * Receives notifications about transactions, account changes, and errors
 * NOTE: Does NOT require authentication - Plaid sends directly to this endpoint
 */
router.post('/webhook', async (req, res, next) => {
  try {
    console.log('[Plaid Webhook] Received webhook event:', {
      type: req.body.webhook_type,
      code: req.body.webhook_code,
      itemId: req.body.item_id
    });

    // Validate webhook is from Plaid (in production, verify signature)
    // For now, we trust that Plaid is sending to our private endpoint
    
    await handlePlaidWebhook(req, res);
  } catch (error) {
    console.error('[Plaid Webhook] Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
