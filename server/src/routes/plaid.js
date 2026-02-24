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

const router = Router();

/**
 * POST /plaid/create-link-token
 * Create a link token for starting the Plaid Link flow
 * User needs this token to securely connect their bank account
 */
router.post('/create-link-token', authMiddleware, async (req, res, next) => {
  try {
    const { userId, householdId } = req.user;

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

    // Store linked accounts in database
    const linkedAccounts = [];
    
    for (const account of accounts) {
      const linkedAccount = await LinkedAccount.create({
        householdId,
        userId,
        plaidItemId: itemId,
        plaidAccessToken: accessToken, // TODO: Encrypt in production
        plaidInstitutionId: metadata?.institution?.institution_id,
        accountId: account.accountId,
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
      });

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
    const { accountId, month, limit = 50, offset = 0 } = req.query;

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
