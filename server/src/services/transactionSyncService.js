/**
 * Transaction Sync Service
 * Fetches transactions from Plaid and stores them in the database
 * Runs as a background job on a schedule
 */

import cron from 'node-cron';
import PlaidService from './plaidService.js';
import LinkedAccount from '../models/LinkedAccount.js';
import PlaidTransaction from '../models/PlaidTransaction.js';
import * as CategorySuggestion from './categorySuggestionService.js';
import logger from '../utils/logger.js';

/**
 * Sync transactions for a specific linked account
 */
export async function syncAccountTransactions(linkedAccount) {
  try {
    const { _id, householdId, plaidAccessToken, plaidAccountId, lastSyncedAt } = linkedAccount;

    logger.info('[TransactionSync] Syncing account:', {
      accountId: _id,
      accountName: linkedAccount.accountName,
      previousSync: lastSyncedAt
    });

    // Calculate date range (from last sync or 30 days ago if first sync)
    const startDate = lastSyncedAt
      ? new Date(lastSyncedAt)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Fetch transactions from Plaid
    const response = await PlaidService.getTransactionsPaginated(
      plaidAccessToken,
      {
        accountIds: [plaidAccountId],
        startDate,
        endDate: new Date(),
      }
    );

    if (!response?.transactions) {
      logger.warn('[TransactionSync] No transactions returned from Plaid for account:', _id);
      return { synced: 0, duplicates: 0, errors: 0 };
    }

    const transactions = response.transactions;
    logger.info('[TransactionSync] Fetched transactions:', {
      accountId: _id,
      count: transactions.length
    });

    let synced = 0;
    let duplicates = 0;
    let errors = 0;

    // Process each transaction
    for (const txn of transactions) {
      try {
        // Check if transaction already exists (duplicate)
        const existingTxn = await PlaidTransaction.findOne({
          householdId,
          plaidTransactionId: txn.transaction_id
        });

        if (existingTxn) {
          logger.debug('[TransactionSync] Duplicate transaction skipped:', {
            plaidTransactionId: txn.transaction_id
          });
          duplicates++;
          continue;
        }

        // Get category suggestion
        const suggestions = await CategorySuggestion.suggestCategory(txn, householdId);
        const topSuggestion = suggestions[0];

        // Create new transaction record
        const newTransaction = await PlaidTransaction.create({
          householdId,
          userId: linkedAccount.userId,
          linkedAccountId: _id,
          plaidTransactionId: txn.transaction_id,
          plaidAccountId,
          
          // Transaction details
          date: new Date(txn.date),
          amount: txn.amount,
          name: txn.name,
          merchant: txn.merchant_name,
          description: txn.merchant_name || txn.name,
          isPending: txn.pending,
          paymentMethod: txn.payment_method,
          
          // Categories
          primaryCategory: txn.personal_finance_category?.primary,
          detailedCategory: txn.personal_finance_category?.detailed,
          userCategory: topSuggestion?.category, // Auto-suggested category
          
          // Status
          syncedAt: new Date(),
          isReconciled: false
        });

        synced++;
        logger.debug('[TransactionSync] Transaction saved with category:', {
          plaidTransactionId: txn.transaction_id,
          amount: txn.amount,
          name: txn.name,
          suggestedCategory: topSuggestion?.category,
          confidence: topSuggestion?.confidence
        });
      } catch (err) {
        logger.error('[TransactionSync] Error saving transaction:', {
          plaidTransactionId: txn.transaction_id,
          error: err.message
        });
        errors++;
      }
    }

    // Update linked account sync metadata
    await LinkedAccount.updateOne(
      { _id },
      {
        lastSyncedAt: new Date(),
        syncStatus: 'active',
        transactionCount: await PlaidTransaction.countDocuments({
          householdId,
          linkedAccountId: _id
        })
      }
    );

    logger.info('[TransactionSync] Sync complete for account:', {
      accountId: _id,
      synced,
      duplicates,
      errors
    });

    return { synced, duplicates, errors };
  } catch (error) {
    logger.error('[TransactionSync] Error syncing account:', error);
    
    // Mark account as errored
    await LinkedAccount.updateOne(
      { _id: linkedAccount._id },
      {
        syncStatus: 'error',
        lastSyncError: error.message
      }
    );

    throw error;
  }
}

/**
 * Sync all active linked accounts
 */
export async function syncAllTransactions() {
  try {
    logger.info('[TransactionSync] Starting global transaction sync...');
    
    const startTime = Date.now();

    // Get all active linked accounts
    const linkedAccounts = await LinkedAccount.find({
      isActive: true,
      syncStatus: { $ne: 'suspended' }
    });

    if (linkedAccounts.length === 0) {
      logger.info('[TransactionSync] No linked accounts to sync');
      return { total: 0, results: [] };
    }

    logger.info('[TransactionSync] Syncing', linkedAccounts.length, 'accounts...');

    const results = [];
    let totalSynced = 0;

    // Sync each account sequentially to avoid rate limiting
    for (const account of linkedAccounts) {
      try {
        const result = await syncAccountTransactions(account);
        results.push({
          accountId: account._id,
          accountName: account.accountName,
          ...result
        });
        totalSynced += result.synced;
      } catch (err) {
        logger.error('[TransactionSync] Failed to sync account:', {
          accountId: account._id,
          error: err.message
        });
        results.push({
          accountId: account._id,
          accountName: account.accountName,
          synced: 0,
          duplicates: 0,
          errors: 1,
          error: err.message
        });
      }

      // Small delay between syncs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    logger.info('[TransactionSync] Global sync complete:', {
      total: linkedAccounts.length,
      totalSynced,
      duration: `${duration}s`
    });

    return { total: linkedAccounts.length, results };
  } catch (error) {
    logger.error('[TransactionSync] Global transaction sync failed:', error);
    throw error;
  }
}

/**
 * Initialize background sync job
 * Runs every 15 minutes
 */
export function initializeTransactionSyncJob() {
  try {
    // Schedule sync every 15 minutes
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('[TransactionSync] Running scheduled transaction sync...');
        await syncAllTransactions();
      } catch (err) {
        logger.error('[TransactionSync] Scheduled sync failed:', err.message);
      }
    });

    logger.info('[TransactionSync] Background sync job initialized (every 15 minutes)');
    return job;
  } catch (error) {
    logger.error('[TransactionSync] Failed to initialize sync job:', error);
    throw error;
  }
}

export default {
  syncAccountTransactions,
  syncAllTransactions,
  initializeTransactionSyncJob
};
