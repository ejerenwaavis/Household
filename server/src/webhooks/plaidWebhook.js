/**
 * Plaid Webhook Handler
 * Processes real-time updates from Plaid about linked accounts and transactions
 */

import PlaidService from '../services/plaidService.js';
import LinkedAccount from '../models/LinkedAccount.js';
import logger from '../utils/logger.js';

/**
 * Handle Plaid webhook events
 * Plaid sends various events: TRANSACTIONS_UPDATE, ITEM_ERROR, etc.
 */
export async function handlePlaidWebhook(req, res) {
  try {
    const { webhook_type, webhook_code, item_id } = req.body;

    logger.info('[PlaidWebhook] Received webhook', {
      webhookType: webhook_type,
      webhookCode: webhook_code,
      itemId: item_id
    });

    // Find the linked account
    const linkedAccount = await LinkedAccount.findOne({
      plaidItemId: item_id
    });

    if (!linkedAccount) {
      console.warn('[PlaidWebhook] Item not found:', item_id);
      return res.json({ processed: false, reason: 'Item not found' });
    }

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(req.body, linkedAccount);
        break;

      case 'ITEM':
        await handleItemWebhook(req.body, linkedAccount);
        break;

      case 'AUTH':
        await handleAuthWebhook(req.body, linkedAccount);
        break;

      case 'IDENTITY':
        await handleIdentityWebhook(req.body, linkedAccount);
        break;

      case 'INVESTMENTS':
        await handleInvestmentsWebhook(req.body, linkedAccount);
        break;

      default:
        logger.warn('[PlaidWebhook] Unknown webhook type:', webhook_type);
    }

    res.json({ processed: true });
  } catch (error) {
    logger.error('[PlaidWebhook] Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle TRANSACTIONS webhook
 * Notifies when new transactions are added, modified, or removed
 */
async function handleTransactionsWebhook(data, linkedAccount) {
  const { webhook_code, initial_update_complete, new_transactions, removed_transactions, modified_transactions } = data;

  logger.info('[PlaidWebhook] Transactions update', {
    accountId: linkedAccount._id,
    webhookCode,
    newTransactions: new_transactions || 0,
    removedTransactions: removed_transactions || 0,
    modifiedTransactions: modified_transactions || 0
  });

  try {
    if (webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      // New transactions available to sync
      // Queue a sync job for this account
      linkedAccount.syncStatus = 'pending';
      linkedAccount.updatedAt = new Date();
      await linkedAccount.save();

      logger.info('[PlaidWebhook] Queued transaction sync for account:', linkedAccount._id);
    }

    if (webhook_code === 'INITIAL_UPDATE_COMPLETE') {
      // Initial transaction sync completed
      linkedAccount.syncStatus = 'active';
      linkedAccount.lastSyncedAt = new Date();
      await linkedAccount.save();

      logger.info('[PlaidWebhook] Initial sync complete for account:', linkedAccount._id);
    }

    if (webhook_code === 'DEFAULT_UPDATE') {
      // Regular update available
      logger.info('[PlaidWebhook] Regular transaction update available');
    }
  } catch (error) {
    logger.error('[PlaidWebhook] Error handling transactions webhook:', error);
    throw error;
  }
}

/**
 * Handle ITEM webhook
 * Notifies about item-level events: errors, login required, etc.
 */
async function handleItemWebhook(data, linkedAccount) {
  const { webhook_code, error: itemError } = data;

  logger.warn('[PlaidWebhook] Item webhook', {
    accountId: linkedAccount._id,
    webhookCode,
    error: itemError
  });

  try {
    if (webhook_code === 'ERROR') {
      // Item has an error (e.g., requires re-authentication)
      linkedAccount.syncStatus = 'error';
      linkedAccount.lastSyncError = itemError?.error_message || 'Unknown error';
      await linkedAccount.save();

      logger.error('[PlaidWebhook] Item error:', {
        accountId: linkedAccount._id,
        error: itemError
      });
    }

    if (webhook_code === 'WEBHOOK_UPDATE_ACKNOWLEDGED') {
      // Webhook acknowledged
      logger.info('[PlaidWebhook] Webhook acknowledged for item:', linkedAccount.plaidItemId);
    }

    if (webhook_code === 'PENDING_EXPIRATION') {
      // Link token is expiring soon
      logger.warn('[PlaidWebhook] Item pending expiration:', linkedAccount._id);
    }
  } catch (error) {
    logger.error('[PlaidWebhook] Error handling item webhook:', error);
    throw error;
  }
}

/**
 * Handle AUTH webhook
 * Notifies when auth data (account/routing numbers) is available
 */
async function handleAuthWebhook(data, linkedAccount) {
  const { webhook_code } = data;

  logger.info('[PlaidWebhook] Auth data available', {
    accountId: linkedAccount._id,
    webhookCode
  });

  // Auth data is now available for retrieval
  // Could queue a job to retrieve and store auth data
}

/**
 * Handle IDENTITY webhook
 * Notifies when identity data is available
 */
async function handleIdentityWebhook(data, linkedAccount) {
  const { webhook_code } = data;

  logger.info('[PlaidWebhook] Identity data available', {
    accountId: linkedAccount._id,
    webhookCode
  });

  // Identity data is now available for retrieval
}

/**
 * Handle INVESTMENTS webhook
 * Notifies about investment account updates
 */
async function handleInvestmentsWebhook(data, linkedAccount) {
  const { webhook_code } = data;

  logger.info('[PlaidWebhook] Investments update', {
    accountId: linkedAccount._id,
    webhookCode
  });

  // Investment holdings/transactions are available
}

export default handlePlaidWebhook;
