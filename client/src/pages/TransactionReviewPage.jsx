/**
 * Transaction Review & Reconciliation Page
 * Displays synced transactions from Plaid and allows user review/categorization
 */

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Eye, Edit2, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as PlaidService from '../services/plaidService';
import * as TransactionService from '../services/transactionService';

const CATEGORIES = [
  'Groceries', 'Gas', 'Dining Out', 'Entertainment', 'Shopping',
  'Medical', 'Bills & Utilities', 'Transportation', 'Travel',
  'Business Services', 'Personal', 'Other'
];

const TransactionReviewPage = () => {
  const { authToken } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [editingId, setEditingId] = useState(null);
  const [summary, setSummary] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 25; // Transactions per page

  /**
   * Get default month (YYYY-MM format)
   */
  function getDefaultMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Fetch linked accounts and initial transactions
   */
  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  /**
   * Fetch transactions when account, month, or page changes
   */
  useEffect(() => {
    if (linkedAccounts.length > 0) {
      fetchTransactions();
      fetchTransactionsSummary();
    }
  }, [selectedAccount, selectedMonth, page]);

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
   * Fetch linked accounts
   */
  const fetchLinkedAccounts = async () => {
    try {
      const response = await PlaidService.getLinkedAccounts(authToken);
      setLinkedAccounts(response.linkedAccounts || []);
    } catch (err) {
      console.error('[TransactionReview] Error fetching accounts:', err);
    }
  };

  /**
   * Fetch transactions
   */
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        month: selectedMonth,
        limit: LIMIT,
        offset: page * LIMIT
      };

      if (selectedAccount !== 'all') {
        params.accountId = selectedAccount;
      }

      const response = await TransactionService.getTransactions(params, authToken);
      setTransactions(response.transactions || []);
      setHasMore(response.pagination?.hasMore || false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch transactions';
      console.error('[TransactionReview] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch transaction summary for current filter
   */
  const fetchTransactionsSummary = async () => {
    try {
      const params = { month: selectedMonth };
      const response = await TransactionService.getTransactionsSummary(params, authToken);
      setSummary(response.summary || []);
    } catch (err) {
      console.error('[TransactionReview] Error fetching summary:', err);
    }
  };

  /**
   * Reconcile transaction
   */
  const handleReconcile = async (transactionId) => {
    try {
      await TransactionService.updateTransaction(
        transactionId,
        { isReconciled: true },
        authToken
      );

      setTransactions(txns =>
        txns.map(txn =>
          txn._id === transactionId ? { ...txn, isReconciled: true } : txn
        )
      );
      setSuccess('✓ Transaction reconciled');
    } catch (err) {
      setError('Failed to reconcile transaction');
    }
  };

  /**
   * Update transaction category
   */
  const handleUpdateCategory = async (transactionId, newCategory) => {
    try {
      await TransactionService.updateTransaction(
        transactionId,
        { userCategory: newCategory },
        authToken
      );

      setTransactions(txns =>
        txns.map(txn =>
          txn._id === transactionId ? { ...txn, userCategory: newCategory } : txn
        )
      );
      setEditingId(null);
      setSuccess('✓ Category updated');
    } catch (err) {
      setError('Failed to update transaction');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 Review Transactions</h1>
          <p className="text-gray-600">Review synced transactions and categorize them</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  setPage(0);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Accounts</option>
                {linkedAccounts.map(account => (
                  <option key={account._id} value={account._id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setPage(0);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Transaction Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transactions
              </label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-medium">
                {transactions.length} found
              </div>
            </div>
          </div>
        </div>

        {/* Category Summary */}
        {summary.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Category Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">{item._id || 'Uncategorized'}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${Math.abs(item.total).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.count} transaction{item.count !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 animate-spin text-blue-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-600 mt-4">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 text-lg">No transactions found for this period.</p>
            </div>
          ) : (
            <>
              {transactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow ${
                    transaction.isReconciled ? 'border-l-4 border-green-500' : 'border-l-4 border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Reconciliation Status */}
                    <div className="flex-shrink-0">
                      {transaction.isReconciled ? (
                        <CheckCircle size={24} className="text-green-500" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                      )}
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{transaction.name}</h3>
                        <p className={`text-lg font-bold ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Date</p>
                          <p>{new Date(transaction.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Category</p>
                          {editingId === transaction._id ? (
                            <div className="flex gap-2">
                              <select
                                defaultValue={transaction.userCategory || transaction.primaryCategory}
                                onChange={(e) => handleUpdateCategory(transaction._id, e.target.value)}
                                className="flex-1 px-2 py-1 border border-blue-500 rounded text-xs"
                                onBlur={() => setEditingId(null)}
                                autoFocus
                              >
                                <option value="">Select...</option>
                                {CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <p>{transaction.userCategory || transaction.primaryCategory || 'Uncategorized '}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Merchant</p>
                          <p>{transaction.merchant || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500">Status</p>
                          <p className={transaction.isPending ? 'text-yellow-600 font-semibold' : 'text-gray-600'}>
                            {transaction.isPending ? 'Pending' : 'Posted'}
                          </p>
                        </div>
                      </div>

                      {transaction.description && (
                        <p className="text-xs text-gray-500 mt-2">{transaction.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(editingId === transaction._id ? null : transaction._id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit category"
                      >
                        <Edit2 size={18} />
                      </button>

                      {!transaction.isReconciled && (
                        <button
                          onClick={() => handleReconcile(transaction._id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Mark as reconciled"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>

                <p className="text-gray-600 text-sm">
                  Page {page + 1} • Showing {transactions.length} transactions
                </p>

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionReviewPage;
