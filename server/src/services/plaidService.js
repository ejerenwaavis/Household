/**
 * Plaid Service
 * Handles all interactions with Plaid API for bank account linking and transaction syncing
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export class PlaidService {
  /**
   * Create a link token for Plaid Link flow
   * User needs this to securely connect their bank account
   */
  static async createLinkToken(userId, householdId) {
    try {
      console.log('[Plaid] Creating link token for user:', { userId, householdId });

      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Household Budget Manager',
        language: 'en',
        // Only request transactions permission (can expand later)
        products: ['transactions'],
        country_codes: ['US', 'CA', 'GB'],
        // Can also add webhook_url here if needed
      });

      console.log('[Plaid] Link token created:', response.data.link_token);
      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      console.error('[Plaid] Error creating link token:', error);
      throw new Error(`Failed to create Plaid link token: ${error.message}`);
    }
  }

  /**
   * Exchange public token for access token
   * After user completes bank linking in Plaid Link, exchange public token for access token
   */
  static async exchangePublicToken(publicToken) {
    try {
      console.log('[Plaid] Exchanging public token for access token');

      const response = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;

      console.log('[Plaid] Token exchange successful:', { itemId });

      return {
        accessToken,
        itemId,
      };
    } catch (error) {
      console.error('[Plaid] Error exchanging public token:', error);
      throw new Error(`Failed to exchange Plaid token: ${error.message}`);
    }
  }

  /**
   * Get linked bank accounts for an item
   */
  static async getAccounts(accessToken) {
    try {
      console.log('[Plaid] Fetching accounts for item');

      const response = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      const accounts = response.data.accounts.map(account => ({
        accountId: account.account_id,
        name: account.name,
        officialName: account.official_name,
        type: account.type, // 'depository', 'credit', 'investment', etc.
        subtype: account.subtype, // 'checking', 'savings', 'credit card', etc.
        mask: account.mask,
        balances: {
          available: account.balances.available,
          current: account.balances.current,
          limit: account.balances.limit,
          isoCurrencyCode: account.balances.iso_currency_code,
        },
      }));

      console.log('[Plaid] Accounts retrieved:', accounts.length);
      return accounts;
    } catch (error) {
      console.error('[Plaid] Error fetching accounts:', error);
      throw new Error(`Failed to fetch Plaid accounts: ${error.message}`);
    }
  }

  /**
   * Get transactions for linked accounts
   * Supports date range filtering and pagination
   */
  static async getTransactions(accessToken, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days by default
        endDate = new Date(),
        accountIds = null, // null = all accounts
      } = options;

      console.log('[Plaid] Fetching transactions', {
        startDate,
        endDate,
        accountIds: accountIds ? accountIds.length : 'all',
      });

      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          include_personal_finance_category: true,
          account_ids: accountIds,
        },
      });

      const transactions = response.data.transactions.map(txn => ({
        transactionId: txn.transaction_id,
        accountId: txn.account_id,
        amount: txn.amount,
        isoCurrencyCode: txn.iso_currency_code,
        date: txn.date,
        name: txn.name,
        merchant: txn.merchant_name,
        category: txn.personal_finance_category?.primary,
        subcategory: txn.personal_finance_category?.detailed,
        pending: txn.pending,
        paymentMethod: txn.payment_method,
        transactionCode: txn.transaction_code,
      }));

      console.log('[Plaid] Transactions retrieved:', transactions.length);

      return {
        transactions,
        totalTransactions: response.data.total_transactions,
        hasMore: transactions.length < response.data.total_transactions,
      };
    } catch (error) {
      console.error('[Plaid] Error fetching transactions:', error);
      throw new Error(`Failed to fetch Plaid transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction details with pagination
   * Useful for paginated loading of historical transactions
   */
  static async getTransactionsPaginated(accessToken, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days by default
        endDate = new Date(),
        accountIds = null,
        offset = 0,
        limit = 100,
      } = options;

      console.log('[Plaid] Fetching paginated transactions', { offset, limit });

      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        options: {
          include_personal_finance_category: true,
          account_ids: accountIds,
          offset,
          count: limit,
        },
      });

      return {
        transactions: response.data.transactions,
        offset: response.data.offset || offset,
        limit: response.data.count || limit,
        totalTransactions: response.data.total_transactions,
        hasMore: (offset + response.data.transactions.length) < response.data.total_transactions,
      };
    } catch (error) {
      console.error('[Plaid] Error fetching paginated transactions:', error);
      throw new Error(`Failed to fetch paginated transactions: ${error.message}`);
    }
  }

  /**
   * Get item status and related data coverage
   */
  static async getItemStatus(accessToken) {
    try {
      console.log('[Plaid] Fetching item status');

      const response = await plaidClient.itemGet({
        access_token: accessToken,
      });

      const item = response.data.item;

      return {
        itemId: item.item_id,
        institutionId: item.institution_id,
        lastSuccessfulUpdate: item.updated_at,
        lastFailedUpdate: item.error?.timestamp,
        error: item.error ? {
          errorType: item.error.error_type,
          errorCode: item.error.error_code,
          errorMessage: item.error.error_message,
          displayMessage: item.error.display_message,
        } : null,
        products: item.available_products,
        billedProducts: item.billed_products,
      };
    } catch (error) {
      console.error('[Plaid] Error fetching item status:', error);
      throw new Error(`Failed to fetch item status: ${error.message}`);
    }
  }

  /**
   * Remove item (unlink account)
   */
  static async removeItem(accessToken) {
    try {
      console.log('[Plaid] Removing item');

      await plaidClient.itemRemove({
        access_token: accessToken,
      });

      console.log('[Plaid] Item removed successfully');
      return true;
    } catch (error) {
      console.error('[Plaid] Error removing item:', error);
      throw new Error(`Failed to remove Plaid item: ${error.message}`);
    }
  }

  /**
   * Validate webhook token (verify webhook authenticity)
   */
  static async validateWebhookToken(webhookToken) {
    try {
      console.log('[Plaid] Validating webhook token');

      const response = await plaidClient.webhookVerificationKeyGet({
        key_id: webhookToken.header_jwt, // Contains key ID in JWT header
      });

      console.log('[Plaid] Webhook token validated');
      return response.data;
    } catch (error) {
      console.error('[Plaid] Error validating webhook:', error);
      throw new Error(`Failed to validate webhook: ${error.message}`);
    }
  }

  /**
   * Get balance information for accounts
   * Real-time balance data
   */
  static async getBalance(accessToken, accountIds = null) {
    try {
      console.log('[Plaid] Fetching balance information');

      const response = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
        options: {
          account_ids: accountIds,
        },
      });

      return response.data.accounts;
    } catch (error) {
      console.error('[Plaid] Error fetching balance:', error);
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  /**
   * Create audit log entry for Plaid operations
   */
  static logOperation(operation, data, status = 'success', error = null) {
    const logEntry = {
      timestamp: new Date(),
      operation,
      data,
      status,
      error: error ? error.message : null,
    };

    console.log(`[Plaid ${operation}]`, logEntry);
    return logEntry;
  }
}

export default PlaidService;
