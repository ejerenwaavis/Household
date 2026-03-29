import { useState, useEffect } from 'react';
import { Trash2, Check, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import Layout from '../components/Layout';
import PlaidLink from '../components/PlaidLink';
import * as PlaidService from '../services/plaidService';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import SkeletonBlock from '../components/SkeletonBlock';

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSuggestedClassification(account) {
  const text = normalizeText(`${account.accountName || ''} ${account.accountOfficialName || ''}`);

  if (text.includes('mortgage')) {
    return { accountType: 'loan', accountSubtype: 'mortgage', destination: 'liability', label: 'Suggested: mortgage liability' };
  }
  if (text.includes('student')) {
    return { accountType: 'loan', accountSubtype: 'student loan', destination: 'liability', label: 'Suggested: student loan liability' };
  }
  if (text.includes('auto')) {
    return { accountType: 'loan', accountSubtype: 'auto loan', destination: 'liability', label: 'Suggested: auto loan liability' };
  }
  if (text.includes('personal loan')) {
    return { accountType: 'loan', accountSubtype: 'personal loan', destination: 'liability', label: 'Suggested: personal loan liability' };
  }
  if (text.includes('line of credit') || text.includes('heloc')) {
    return { accountType: 'loan', accountSubtype: 'line of credit', destination: 'liability', label: 'Suggested: line of credit liability' };
  }
  if (text.includes('credit') || text.includes('card') || text.includes('visa') || text.includes('mastercard') || text.includes('amex') || text.includes('discover')) {
    return { accountType: 'credit', accountSubtype: 'credit card', destination: 'creditCard', label: 'Suggested: credit card' };
  }
  if (text.includes('brokerage')) {
    return { accountType: 'investment', accountSubtype: 'brokerage', destination: 'goal', label: 'Suggested: investment account' };
  }
  if (text.includes('ira')) {
    return { accountType: 'investment', accountSubtype: 'ira', destination: 'goal', label: 'Suggested: IRA / investment account' };
  }
  if (text.includes('money market')) {
    return { accountType: 'depository', accountSubtype: 'money market', destination: 'goal', label: 'Suggested: money market savings' };
  }
  if (text.includes('savings')) {
    return { accountType: 'depository', accountSubtype: 'savings', destination: 'goal', label: 'Suggested: savings goal/fund account' };
  }
  if (text.includes('checking')) {
    return { accountType: 'depository', accountSubtype: 'checking', destination: 'cash', label: 'Suggested: checking account' };
  }

  return {
    accountType: account.accountType || 'other',
    accountSubtype: account.accountSubtype || 'other',
    destination: 'review',
    label: 'Suggestion: review assignment manually',
  };
}

function destinationLabel(destination) {
  if (destination === 'liability') return 'Recommended destination: Liability';
  if (destination === 'creditCard') return 'Recommended destination: Credit Card';
  if (destination === 'goal') return 'Recommended destination: Goal / Project';
  if (destination === 'cash') return 'Recommended destination: Keep as cash account';
  return 'Recommended destination: Manual review';
}

function inferGoalPayload(account, fixedExpenseId = null) {
  const suggestion = inferSuggestedClassification(account);
  const currentBalance = Number(account.currentBalance) || 0;

  if (suggestion.destination === 'liability') {
    return {
      name: account.accountName,
      type: 'Project',
      monthlyContribution: 0,
      target: currentBalance,
      currentBalance,
      linkedAccountId: account._id,
      linkedFixedExpenseId: fixedExpenseId,
    };
  }

  if (suggestion.accountType === 'investment') {
    return {
      name: account.accountName,
      type: 'Investment',
      monthlyContribution: 0,
      target: 0,
      currentBalance,
      linkedAccountId: account._id,
      linkedFixedExpenseId: fixedExpenseId,
    };
  }

  return {
    name: account.accountName,
    type: suggestion.accountSubtype === 'savings' || suggestion.accountSubtype === 'money market' ? 'Emergency' : 'Other',
    monthlyContribution: 0,
    target: 0,
    currentBalance,
    linkedAccountId: account._id,
    linkedFixedExpenseId: fixedExpenseId,
  };
}

function inferCreditCardPayload(account) {
  const currentBalance = Number(account.currentBalance) || 0;
  const creditLimit = Number(account.creditLimit) || currentBalance + (Number(account.availableBalance) || 0);

  return {
    cardName: account.accountOfficialName || account.accountName,
    holder: 'Plaid Sync',
    originalBalance: currentBalance,
    currentBalance,
    minPayment: 0,
    plannedExtraPayment: 0,
    interestRate: 0,
    creditLimit,
    dueDay: null,
    linkedBankName: account.accountName,
    linkedAccountId: account._id,
  };
}

function sanitizeAssignmentSettings(settings, changedField = null) {
  const next = { ...settings };

  if (changedField === 'goalId' && next.goalId) {
    next.creditCardId = '';
  }

  if (changedField === 'creditCardId' && next.creditCardId) {
    next.goalId = '';
    next.linkedFixedExpenseId = '';
  }

  if (!next.goalId) {
    next.linkedFixedExpenseId = '';
  }

  return next;
}

export default function LinkedAccountsPage() {
  const { token: authToken, user } = useAuth();
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [manualAccounts, setManualAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [refreshing, setRefreshing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [goals, setGoals] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [accountSettings, setAccountSettings] = useState({});
  const [savingSettingsId, setSavingSettingsId] = useState(null);
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [creatingForAccountId, setCreatingForAccountId] = useState(null);

  const ACCOUNT_TYPES = ['depository', 'credit', 'investment', 'loan', 'other'];
  const ACCOUNT_SUBTYPES = ['checking', 'savings', 'money market', 'credit card', 'cash management', 'brokerage', 'ira', 'mortgage', 'auto loan', 'student loan', 'personal loan', 'line of credit', 'other'];

  useEffect(() => {
    fetchLinkedAccounts();
  }, []);

  useEffect(() => {
    fetchManualAccounts();
  }, [user?.householdId]);

  useEffect(() => {
    fetchAssignmentTargets();
  }, [user?.householdId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const nextSettings = {};
    for (const account of linkedAccounts) {
      const linkedGoal = goals.find((goal) => String(goal.linkedAccountId) === String(account._id));
      const linkedCard = creditCards.find((card) => String(card.linkedAccountId) === String(account._id));
      nextSettings[account._id] = {
        accountType: account.accountType || 'other',
        accountSubtype: account.accountSubtype || 'other',
        goalId: linkedGoal?._id || '',
        creditCardId: linkedCard?._id || '',
        linkedFixedExpenseId: linkedGoal?.linkedFixedExpenseId || '',
      };
    }
    setAccountSettings(nextSettings);
  }, [linkedAccounts, goals, creditCards]);

  const showToast = (message) => {
    setToast(message);
  };

  const fetchLinkedAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await PlaidService.getLinkedAccounts(authToken);
      setLinkedAccounts(response.linkedAccounts || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch linked accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchManualAccounts = async () => {
    if (!user?.householdId) return;

    try {
      const response = await api.get(`/bank-transactions/${user.householdId}/accounts`);
      setManualAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('[LinkedAccounts] Manual account fetch error:', err);
      setManualAccounts([]);
    }
  };

  const fetchAssignmentTargets = async () => {
    if (!user?.householdId) return;
    try {
      const [goalsRes, cardsRes, fixedRes] = await Promise.all([
        api.get(`/goals/${user.householdId}`).catch(() => ({ data: { goals: [] } })),
        api.get(`/credit-cards/${user.householdId}`).catch(() => ({ data: { cards: [] } })),
        api.get(`/fixed-expenses/${user.householdId}`).catch(() => ({ data: { expenses: [] } })),
      ]);
      setGoals(goalsRes.data.goals || []);
      setCreditCards((cardsRes.data.cards || []).filter((card) => !String(card._id).startsWith('linked-')));
      setFixedExpenses(fixedRes.data.expenses || []);
    } catch (err) {
      console.error('[LinkedAccounts] Failed to fetch assignment targets:', err);
    }
  };

  const handleLinkSuccess = (data) => {
    showToast(`Linked ${data.linkedAccounts.length} account${data.linkedAccounts.length !== 1 ? 's' : ''}`);
    setTimeout(() => {
      fetchLinkedAccounts();
      fetchAssignmentTargets();
      fetchManualAccounts();
    }, 1000);
  };

  const handleRefreshBalance = async (accountId) => {
    try {
      setRefreshing(accountId);
      const response = await PlaidService.getAccountBalance(accountId, authToken);
      setLinkedAccounts((accounts) => accounts.map((account) => (
        account._id === accountId
          ? { ...account, currentBalance: response.currentBalance, availableBalance: response.availableBalance, creditLimit: response.creditLimit }
          : account
      )));
      showToast('Balance refreshed');
    } catch {
      setError('Failed to refresh balance');
    } finally {
      setRefreshing(null);
    }
  };

  const handleSetDefault = async (accountId) => {
    try {
      await PlaidService.setDefaultAccount(accountId, authToken);
      setLinkedAccounts((accounts) => accounts.map((account) => ({ ...account, isDefault: account._id === accountId })));
      showToast('Default account updated');
    } catch {
      setError('Failed to set default account');
    }
  };

  const handleSyncTransactions = async () => {
    try {
      setSyncing(true);
      setError(null);
      const { data } = await api.post('/plaid/sync-now');
      showToast(`Synced ${data.synced} new transaction${data.synced !== 1 ? 's' : ''}`);
      await fetchLinkedAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async (accountId) => {
    if (!window.confirm('Are you sure you want to unlink this account? This will stop syncing transactions.')) {
      return;
    }

    try {
      setLoading(true);
      await PlaidService.unlinkAccount(accountId, authToken);
      setLinkedAccounts((accounts) => accounts.filter((account) => account._id !== accountId));
      showToast('Account unlinked');
    } catch {
      setError('Failed to unlink account');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (accountId, field, value) => {
    setAccountSettings((current) => ({
      ...current,
      [accountId]: sanitizeAssignmentSettings(
        {
          ...(current[accountId] || {}),
          [field]: value,
        },
        field
      ),
    }));
  };

  const handleApplySuggestion = (account) => {
    const suggestion = inferSuggestedClassification(account);
    setAccountSettings((current) => ({
      ...current,
      [account._id]: sanitizeAssignmentSettings({
        ...(current[account._id] || {}),
        accountType: suggestion.accountType,
        accountSubtype: suggestion.accountSubtype,
      }),
    }));
    showToast('Suggested classification applied');
  };

  const handleSaveSettings = async (account) => {
    if (!user?.householdId) return;
    const settings = sanitizeAssignmentSettings(accountSettings[account._id] || {});

    try {
      setSavingSettingsId(account._id);
      await PlaidService.updateLinkedAccount(account._id, {
        accountType: settings.accountType,
        accountSubtype: settings.accountSubtype,
      }, authToken);

      const currentlyLinkedGoal = goals.find((goal) => String(goal.linkedAccountId) === String(account._id));
      const currentlyLinkedCard = creditCards.find((card) => String(card.linkedAccountId) === String(account._id));

      if (settings.goalId) {
        await api.patch(`/goals/${user.householdId}/${settings.goalId}`, {
          linkedAccountId: account._id,
          linkedFixedExpenseId: settings.linkedFixedExpenseId || null,
        });
      } else if (currentlyLinkedGoal) {
        await api.patch(`/goals/${user.householdId}/${currentlyLinkedGoal._id}`, {
          linkedAccountId: null,
          linkedFixedExpenseId: null,
        });
      }

      if (settings.creditCardId) {
        await api.patch(`/credit-cards/${user.householdId}/${settings.creditCardId}`, {
          linkedAccountId: account._id,
          linkedBankName: account.accountName,
        });
      } else if (currentlyLinkedCard) {
        await api.patch(`/credit-cards/${user.householdId}/${currentlyLinkedCard._id}`, {
          linkedAccountId: null,
        });
      }

      await fetchLinkedAccounts();
      await fetchAssignmentTargets();
      setExpandedAccountId(null);
      showToast('Account settings saved');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save account settings');
    } finally {
      setSavingSettingsId(null);
    }
  };

  const handleCreateGoal = async (account, mode = 'goal') => {
    if (!user?.householdId) return;
    const settings = sanitizeAssignmentSettings(accountSettings[account._id] || {});
    try {
      setCreatingForAccountId(account._id);
      const payload = inferGoalPayload(account, mode === 'liability' ? (settings.linkedFixedExpenseId || null) : null);
      const response = await api.post(`/goals/${user.householdId}`, payload);
      await fetchAssignmentTargets();
      await fetchLinkedAccounts();
      setExpandedAccountId(account._id);
      setAccountSettings((current) => ({
        ...current,
        [account._id]: sanitizeAssignmentSettings({
          ...(current[account._id] || {}),
          goalId: response.data.goal?._id || '',
          creditCardId: '',
        }),
      }));
      showToast(mode === 'liability' ? 'Liability created from linked account' : 'Goal created from linked account');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create goal from account');
    } finally {
      setCreatingForAccountId(null);
    }
  };

  const handleCreateCreditCard = async (account) => {
    if (!user?.householdId) return;
    try {
      setCreatingForAccountId(account._id);
      const response = await api.post(`/credit-cards/${user.householdId}`, inferCreditCardPayload(account));
      await fetchAssignmentTargets();
      await fetchLinkedAccounts();
      setExpandedAccountId(account._id);
      setAccountSettings((current) => ({
        ...current,
        [account._id]: sanitizeAssignmentSettings({
          ...(current[account._id] || {}),
          goalId: '',
          creditCardId: response.data._id || '',
          linkedFixedExpenseId: '',
        }, 'creditCardId'),
      }));
      showToast('Credit card created from linked account');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create credit card from account');
    } finally {
      setCreatingForAccountId(null);
    }
  };

  const getAssignmentSummary = (account) => {
    const linkedGoal = goals.find((goal) => String(goal.linkedAccountId) === String(account._id));
    const linkedCard = creditCards.find((card) => String(card.linkedAccountId) === String(account._id));
    if (linkedGoal && linkedGoal.isLiabilityTracked) return `Assigned to liability: ${linkedGoal.name}`;
    if (linkedGoal) return `Assigned to goal/project: ${linkedGoal.name}`;
    if (linkedCard) return `Assigned to credit card: ${linkedCard.cardName}`;
    return 'Not assigned yet';
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {toast && (
          <div className="fixed top-4 right-4 z-50 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 text-sm font-medium text-gray-800 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-100">
            {toast}
          </div>
        )}

        <div className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">🏦 Bank Accounts</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage linked bank accounts, account classification, routing into goals, liabilities, or credit cards, and manually uploaded statement accounts.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <a href="/transactions/review" className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium">
                Upload Transactions →
              </a>
              {linkedAccounts.length > 0 && (
                <button
                  onClick={handleSyncTransactions}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Transactions'}
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Account</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Connect your bank account to automatically sync transactions</p>
          <PlaidLink onSuccess={handleLinkSuccess} onExit={() => {}} />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Your Linked Accounts</h2>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center gap-4">
                  <SkeletonBlock className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-5 w-48 rounded" />
                    <SkeletonBlock className="h-3 w-32 rounded" />
                    <SkeletonBlock className="h-3 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : linkedAccounts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-lg">No linked accounts yet. Connect your bank above to get started.</p>
            </div>
          ) : (
            linkedAccounts.map((account) => {
              const suggestion = inferSuggestedClassification(account);
              const settings = accountSettings[account._id] || {};
              const linkedGoal = goals.find((goal) => String(goal.linkedAccountId) === String(account._id));
              const linkedCard = creditCards.find((card) => String(card.linkedAccountId) === String(account._id));
              const isExpanded = expandedAccountId === account._id;

              return (
                <div key={account._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4 gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{account.accountName}</h3>
                          {account.isDefault && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">DEFAULT</span>
                          )}
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            {account.accountType || 'other'} / {account.accountSubtype || 'other'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {account.accountOfficialName || account.accountName}
                          {account.accountMask ? ` • ends in ${account.accountMask}` : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-200">
                            <Sparkles size={12} /> {suggestion.label}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 border border-indigo-200">
                            {destinationLabel(suggestion.destination)}
                          </span>
                          <span className="text-gray-500">{getAssignmentSummary(account)}</span>
                        </div>
                      </div>

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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 py-4 border-t border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${Number(account.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      {typeof account.availableBalance !== 'undefined' && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                          <p className="text-2xl font-bold text-green-600">${Number(account.availableBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      {account.creditLimit ? (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Credit Limit</p>
                          <p className="text-2xl font-bold text-blue-600">${Number(account.creditLimit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Institution</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{account.institutionName || 'Plaid linked'}</p>
                        </div>
                      )}
                    </div>

                    {account.lastSyncedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Last synced: {new Date(account.lastSyncedAt).toLocaleString()}</p>
                    )}

                    {account.lastSyncError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded">
                        {account.lastSyncError}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleRefreshBalance(account._id)}
                        disabled={refreshing === account._id}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={16} className={refreshing === account._id ? 'animate-spin' : ''} />
                        {refreshing === account._id ? 'Syncing...' : 'Refresh'}
                      </button>

                      {!account.isDefault && (
                        <button
                          onClick={() => handleSetDefault(account._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Check size={16} />
                          Set Default
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedAccountId(isExpanded ? null : account._id)}
                        className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors"
                      >
                        {linkedGoal || linkedCard ? 'Assign / Reassign' : 'Assign'}
                      </button>

                      <button
                        onClick={() => handleUnlink(account._id)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50 ml-auto"
                      >
                        <Trash2 size={16} />
                        Unlink
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assignment Workspace</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Override classification, assign to an existing target, or create a new one directly from this linked account.</div>
                          </div>
                          <button onClick={() => handleApplySuggestion(account)} className="text-sm text-indigo-600 hover:text-indigo-700">
                            Apply Suggested Type
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Account Type</label>
                            <select
                              value={settings.accountType || account.accountType || 'other'}
                              onChange={(e) => handleSettingChange(account._id, 'accountType', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Account Subtype</label>
                            <select
                              value={settings.accountSubtype || account.accountSubtype || 'other'}
                              onChange={(e) => handleSettingChange(account._id, 'accountSubtype', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              {ACCOUNT_SUBTYPES.map((subtype) => <option key={subtype} value={subtype}>{subtype}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Assign to Goal / Project</label>
                            <select
                              value={settings.goalId || ''}
                              onChange={(e) => handleSettingChange(account._id, 'goalId', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="">None</option>
                              {goals.map((goal) => <option key={goal._id} value={goal._id}>{goal.name}</option>)}
                            </select>
                            {settings.creditCardId && (
                              <p className="mt-1 text-xs text-amber-600">Selecting a goal/project clears the credit card assignment automatically.</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Assign to Credit Card</label>
                            <select
                              value={settings.creditCardId || ''}
                              onChange={(e) => handleSettingChange(account._id, 'creditCardId', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="">None</option>
                              {creditCards.map((card) => <option key={card._id} value={card._id}>{card.cardName}</option>)}
                            </select>
                            {settings.goalId && (
                              <p className="mt-1 text-xs text-amber-600">Selecting a credit card clears the goal/project assignment automatically.</p>
                            )}
                          </div>

                          {(suggestion.destination === 'liability' || settings.goalId) && (
                            <div className="md:col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">Linked Fixed Expense for Liability Payments</label>
                              <select
                                value={settings.linkedFixedExpenseId || ''}
                                onChange={(e) => handleSettingChange(account._id, 'linkedFixedExpenseId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                <option value="">None</option>
                                {fixedExpenses.map((expense) => <option key={expense._id} value={expense._id}>{expense.name} · ${Number(expense.amount || 0).toFixed(2)}</option>)}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleCreateGoal(account, 'goal')}
                            disabled={creatingForAccountId === account._id}
                            className="px-4 py-2 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 disabled:opacity-50"
                          >
                            Create Goal
                          </button>
                          <button
                            onClick={() => handleCreateGoal(account, 'liability')}
                            disabled={creatingForAccountId === account._id}
                            className="px-4 py-2 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                          >
                            Create Liability
                          </button>
                          <button
                            onClick={() => handleCreateCreditCard(account)}
                            disabled={creatingForAccountId === account._id}
                            className="px-4 py-2 rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200 disabled:opacity-50"
                          >
                            Create Credit Card
                          </button>

                          <button
                            onClick={() => handleSaveSettings(account)}
                            disabled={savingSettingsId === account._id}
                            className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {savingSettingsId === account._id ? 'Saving...' : 'Save Settings'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {manualAccounts.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Manually Added from Uploads</h2>
            {manualAccounts.map((account) => (
              <div key={account._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{account.bankName}</h3>
                      {account.accountMask && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded">••{account.accountMask}</span>
                      )}
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">Manual Upload</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {account.accountName || 'Uploaded account'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{account.transactionCount || 0} imported transactions</span>
                      <span>{account.sourceDocumentCount || 0} uploaded files</span>
                      {account.lastImportedAt && <span>Last import: {new Date(account.lastImportedAt).toLocaleString()}</span>}
                    </div>
                    {account.linkedAccount && (
                      <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                        Matched to linked account: {account.linkedAccount.accountName}{account.linkedAccount.accountMask ? ` ••${account.linkedAccount.accountMask}` : ''}
                      </p>
                    )}
                  </div>

                  <a href="/transactions/review" className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-sm font-medium self-start">
                    Upload More Statements
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">About Bank Account Linking</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>Secure connection using Plaid - your credentials are never shared</li>
            <li>Transactions are synced automatically in real-time</li>
            <li>Override account type/subtype when Plaid classification needs correction</li>
            <li>Route linked accounts into goals, liabilities, or credit cards from one place</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
