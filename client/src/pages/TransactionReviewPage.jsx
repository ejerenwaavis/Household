import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, CheckCircle, Circle, Filter, ChevronLeft, ChevronRight, Tag, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import * as TransactionService from '../services/transactionService';
import * as PlaidServiceApi from '../services/plaidService';

const CATEGORIES = [
  'Groceries', 'Gas', 'Dining Out', 'Medical', 'Entertainment',
  'Shopping', 'Utilities', 'Transportation', 'Travel',
  'Business Services', 'Personal', 'Other'
];

const PAGE_SIZE = 25;

const TransactionReviewPage = () => {
  const { token: authToken } = useAuth();

  // Data state
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterReconciled, setFilterReconciled] = useState('all'); // 'all', 'yes', 'no'

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null); // transactionId being edited
  const [updatingIds, setUpdatingIds] = useState(new Set());

  // ── Fetch linked accounts on mount ────────────────────────
  useEffect(() => {
    PlaidServiceApi.getLinkedAccounts(authToken)
      .then(r => setLinkedAccounts(r.linkedAccounts || []))
      .catch(() => {});
  }, [authToken]);

  // ── Fetch transactions when filters/page change ───────────
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        month: selectedMonth,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      };
      if (selectedAccount) params.accountId = selectedAccount;
      if (filterReconciled === 'yes') params.isReconciled = true;
      if (filterReconciled === 'no') params.isReconciled = false;

      const data = await TransactionService.getTransactions(params, authToken);
      setTransactions(data.transactions || []);
      setTotalCount(data.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [authToken, selectedAccount, selectedMonth, filterReconciled, currentPage]);

  // ── Fetch category summary ─────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const params = { month: selectedMonth };
      if (selectedAccount) params.accountId = selectedAccount;
      const data = await TransactionService.getTransactionsSummary(params, authToken);
      setSummary(data.summary || []);
    } catch {
      // Non-critical – fail silently
    } finally {
      setSummaryLoading(false);
    }
  }, [authToken, selectedAccount, selectedMonth]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [fetchTransactions, fetchSummary]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedAccount, selectedMonth, filterReconciled]);

  // ── Update category ────────────────────────────────────────
  const handleCategoryChange = async (transactionId, newCategory) => {
    try {
      setUpdatingIds(s => new Set(s).add(transactionId));
      await TransactionService.updateTransaction(transactionId, { userCategory: newCategory }, authToken);
      setTransactions(txns =>
        txns.map(t => t._id === transactionId ? { ...t, userCategory: newCategory } : t)
      );
      setEditingCategory(null);
    } catch {
      setError('Failed to update category');
    } finally {
      setUpdatingIds(ids => { const s = new Set(ids); s.delete(transactionId); return s; });
    }
  };

  // ── Toggle reconciled ───────────────────────────────────────
  const handleToggleReconciled = async (txn) => {
    const newValue = !txn.isReconciled;
    try {
      setUpdatingIds(s => new Set(s).add(txn._id));
      await TransactionService.updateTransaction(txn._id, { isReconciled: newValue }, authToken);
      setTransactions(txns =>
        txns.map(t => t._id === txn._id ? { ...t, isReconciled: newValue } : t)
      );
      // Refresh summary counts
      fetchSummary();
    } catch {
      setError('Failed to update reconciliation status');
    } finally {
      setUpdatingIds(ids => { const s = new Set(ids); s.delete(txn._id); return s; });
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const reconciledCount = transactions.filter(t => t.isReconciled).length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">📊 Review Transactions</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Review, categorize, and reconcile synced bank transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/linked-accounts"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              🏦 Manage Accounts
            </Link>
            <button
              onClick={() => { fetchTransactions(); fetchSummary(); }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ── No accounts CTA ─────────────────────────────────── */}
        {linkedAccounts.length === 0 && !loading && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center mb-6">
            <p className="text-blue-700 dark:text-blue-300 font-semibold text-lg mb-2">No linked accounts yet</p>
            <p className="text-blue-600 dark:text-blue-400 text-sm mb-4">Connect a bank account to start syncing transactions automatically.</p>
            <Link to="/linked-accounts" className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Link Bank Account →
            </Link>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>

            {/* Month */}
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />

            {/* Account */}
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Accounts</option>
              {linkedAccounts.map(acc => (
                <option key={acc._id} value={acc._id}>{acc.accountName} ••{acc.accountMask}</option>
              ))}
            </select>

            {/* Reconciled */}
            <select
              value={filterReconciled}
              onChange={e => setFilterReconciled(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="no">Unreconciled</option>
              <option value="yes">Reconciled</option>
            </select>

            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {totalCount} transaction{totalCount !== 1 ? 's' : ''}
              {transactions.length > 0 && ` · ${reconciledCount} reconciled`}
            </span>
          </div>
        </div>

        {/* ── Category Summary Cards ───────────────────────────── */}
        {summary.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
              Spending by Category — {selectedMonth}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {summary.slice(0, 8).map(cat => (
                <div key={cat._id || 'uncategorized'} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cat._id || 'Uncategorized'}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    ${Math.abs(cat.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.count} txn{cat.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transaction List ─────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw size={36} className="animate-spin text-blue-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <FileText size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No transactions found</p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                {linkedAccounts.length > 0 ? 'Try adjusting your filters or wait for the next sync.' : 'Link a bank account to start syncing.'}
              </p>
            </div>
          ) : (
            <>
              {/* Header Row */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                <div className="col-span-1 text-center">✓</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-4">Merchant / Description</div>
                <div className="col-span-3">Category</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              {transactions.map(txn => {
                const isUpdating = updatingIds.has(txn._id);
                const isEditing = editingCategory === txn._id;
                const amount = txn.amount || 0;
                const isDebit = amount > 0;
                const displayCategory = txn.userCategory || txn.primaryCategory || '—';

                return (
                  <div
                    key={txn._id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
                      txn.isReconciled ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    } ${isUpdating ? 'opacity-60' : ''}`}
                  >
                    {/* Reconcile checkbox */}
                    <div className="col-span-1 flex justify-center">
                      <button
                        onClick={() => handleToggleReconciled(txn)}
                        disabled={isUpdating}
                        title={txn.isReconciled ? 'Mark as unreconciled' : 'Mark as reconciled'}
                        className="transition-transform hover:scale-110"
                      >
                        {txn.isReconciled
                          ? <CheckCircle size={18} className="text-green-500" />
                          : <Circle size={18} className="text-gray-300 dark:text-gray-600" />
                        }
                      </button>
                    </div>

                    {/* Date */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {txn.isPending && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                      )}
                    </div>

                    {/* Merchant / Description */}
                    <div className="col-span-4 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {txn.merchant || txn.name}
                      </p>
                      {txn.merchant && txn.name !== txn.merchant && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{txn.name}</p>
                      )}
                    </div>

                    {/* Category */}
                    <div className="col-span-3">
                      {isEditing ? (
                        <select
                          autoFocus
                          defaultValue={txn.userCategory || txn.primaryCategory || ''}
                          onChange={e => handleCategoryChange(txn._id, e.target.value)}
                          onBlur={() => setEditingCategory(null)}
                          className="w-full text-xs border border-blue-400 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none"
                        >
                          <option value="">— Select —</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingCategory(txn._id)}
                          className="flex items-center gap-1.5 group text-left"
                          title="Click to change category"
                          disabled={isUpdating}
                        >
                          <Tag size={13} className="text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {displayCategory}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="col-span-2 text-right">
                      <p className={`text-sm font-semibold ${isDebit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {isDebit ? '-' : '+'}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage + 1} of {totalPages} · {totalCount} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 0 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages - 1 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Info Footer ──────────────────────────────────────── */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 How Reconciliation Works</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>✓ Transactions sync automatically every 15 minutes from linked accounts</li>
            <li>✓ Click the <strong>circle icon</strong> to mark a transaction as reconciled</li>
            <li>✓ Click a <strong>category label</strong> to change the category for better insights</li>
            <li>✓ Pending transactions are highlighted — they'll post within 1-3 business days</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default TransactionReviewPage;

