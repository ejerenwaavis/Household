/**
 * Linked Accounts Page
 * Displays all linked bank accounts and allows management
 */

import { useState, useEffect } from 'react';
import { Trash2, Check, RefreshCw, Eye, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import PlaidLink from '../components/PlaidLink';
import * as PlaidService from '../services/plaidService';
import { useAuth } from '../hooks/useAuth';

const LinkedAccountsPage = () => {
  const { token: authToken } = useAuth();
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshing, setRefreshing] = useState(null);
  const [showDetails, setShowDetails] = useState(null);

  /**
   * Fetch all linked accounts on component mount
   */
  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  /**
   * Clear success message after 5 seconds
   */
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  /**
   * Fetch linked accounts from backend
   */
  const fetchLinkedAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await PlaidService.getLinkedAccounts(authToken);
      setLinkedAccounts(response.linkedAccounts || []);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch linked accounts';
      console.error('[LinkedAccounts] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle successful bank account linking
   */
  const handleLinkSuccess = (data) => {
    console.log('[LinkedAccounts] Account linked successfully:', data);
    setSuccess(`✓ Successfully linked ${data.linkedAccounts.length} account(s)`);
    // Refresh the list after a short delay
    setTimeout(fetchLinkedAccounts, 1000);
  };

  /**
   * Handle Plaid Link exit
   */
  const handleLinkExit = (error, metadata) => {
    if (error) {
      console.warn('[LinkedAccounts] Link error:', error);
    }
  };

  /**
   * Refresh account balance
   */
  const handleRefreshBalance = async (accountId) => {
    try {
      setRefreshing(accountId);
      const response = await PlaidService.getAccountBalance(accountId, authToken);
      
      // Update the account in state
      setLinkedAccounts(accounts =>
        accounts.map(acc =>
          acc._id === accountId
            ? { ...acc, currentBalance: response.currentBalance, availableBalance: response.availableBalance }
            : acc
        )
      );
      setSuccess('✓ Balance refreshed');
    } catch (err) {
      setError('Failed to refresh balance');
    } finally {
      setRefreshing(null);
    }
  };

  /**
   * Set account as default
   */
  const handleSetDefault = async (accountId) => {
    try {
      await PlaidService.setDefaultAccount(accountId, authToken);
      
      // Update state
      setLinkedAccounts(accounts =>
        accounts.map(acc => ({
          ...acc,
          isDefault: acc._id === accountId
        }))
      );
      setSuccess('✓ Default account updated');
    } catch (err) {
      setError('Failed to set default account');
    }
  };

  /**
   * Unlink an account
   */
  const handleUnlink = async (accountId) => {
    if (!window.confirm('Are you sure you want to unlink this account? This will stop syncing transactions.')) {
      return;
    }

    try {
      setLoading(true);
      await PlaidService.unlinkAccount(accountId, authToken);
      
      // Remove from state
      setLinkedAccounts(accounts => accounts.filter(acc => acc._id !== accountId));
      setSuccess('✓ Account unlinked successfully');
    } catch (err) {
      setError('Failed to unlink account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">🏦 Bank Accounts</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage linked bank accounts and transactions</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg">
            {success}
          </div>
        )}

        {/* Link Account Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Account</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Connect your bank account to automatically sync transactions</p>
          <PlaidLink 
            onSuccess={handleLinkSuccess}
            onExit={handleLinkExit}
          />
        </div>

        {/* Linked Accounts */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Your Linked Accounts</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <svg className="w-12 h-12 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading accounts...</p>
            </div>
          ) : linkedAccounts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">No linked accounts yet. Connect your bank above to get started.</p>
            </div>
          ) : (
            linkedAccounts.map((account) => (
              <div key={account._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  {/* Account Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{account.accountName}</h3>
                        {account.isDefault && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {account.accountType} • {account.accountMask && `ends in ${account.accountMask}`}
                      </p>
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded text-xs font-semibold ${
                      account.syncStatus === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : account.syncStatus === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : account.syncStatus === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {account.syncStatus === 'active' ? '✓ Syncing' : account.syncStatus}
                    </div>
                  </div>

                  {/* Balance Information */}
                  <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        ${account.currentBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </p>
                    </div>
                    {account.availableBalance !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${account.availableBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                    )}
                    {account.creditLimit && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Credit Limit</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ${account.creditLimit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Last Sync Information */}
                  {account.lastSyncedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Last synced: {new Date(account.lastSyncedAt).toLocaleString()}
                    </p>
                  )}

                  {/* Error Message */}
                  {account.lastSyncError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded">
                      {account.lastSyncError}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRefreshBalance(account._id)}
                      disabled={refreshing === account._id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                      title="Refresh balance"
                    >
                      <RefreshCw size={16} className={refreshing === account._id ? 'animate-spin' : ''} />
                      {refreshing === account._id ? 'Syncing...' : 'Refresh'}
                    </button>

                    {!account.isDefault && (
                      <button
                        onClick={() => handleSetDefault(account._id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Set as default"
                      >
                        <Check size={16} />
                        Set Default
                      </button>
                    )}

                    <button
                      onClick={() => handleUnlink(account._id)}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50 ml-auto"
                      title="Unlink account"
                    >
                      <Trash2 size={16} />
                      Unlink
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">💡 About Bank Account Linking</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>✓ Secure connection using Plaid - your credentials are never shared</li>
            <li>✓ Transactions are synced automatically in real-time</li>
            <li>✓ Set a default account for quick access</li>
            <li>✓ Unlink anytime - no ongoing fees or commitments</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default LinkedAccountsPage;
