/**
 * Plaid Integration Routes
 * Handles bank account linking, token exchange, and account management via Plaid
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import PlaidService from '../services/plaidService.js';
import LinkedAccount from '../models/LinkedAccount.js';
import User from '../models/User.js';

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

export default router;
