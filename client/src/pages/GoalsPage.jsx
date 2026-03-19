import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import GoalForm from '../components/GoalForm';
import GoalList from '../components/GoalList';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import SkeletonBlock from '../components/SkeletonBlock';

export default function GoalsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [totalMonthlyContribution, setTotalMonthlyContribution] = useState(0);
  const [totalMonthlyLiabilityPayment, setTotalMonthlyLiabilityPayment] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creatingLinkedId, setCreatingLinkedId] = useState(null);
  const [selectedExpenseByAccount, setSelectedExpenseByAccount] = useState({});

  const inferGoalType = (account) => {
    const subtype = String(account?.accountSubtype || '').toLowerCase();
    const type = String(account?.accountType || '').toLowerCase();

    if (subtype.includes('mortgage') || subtype.includes('loan') || type === 'loan') return 'Project';
    if (type === 'investment' || subtype.includes('ira') || subtype.includes('brokerage') || subtype.includes('401')) return 'Investment';
    if (subtype.includes('savings')) return 'Emergency';

    return 'Other';
  };

  const buildGoalNameFromAccount = (account) => {
    const subtype = String(account?.accountSubtype || '').toLowerCase();
    if (subtype.includes('mortgage')) return `${account.accountName} Mortgage`;
    if (subtype.includes('loan')) return `${account.accountName} Payoff`;
    return account.accountName;
  };

  const isLiabilityAccount = (account) => {
    const subtype = String(account?.accountSubtype || '').toLowerCase();
    const type = String(account?.accountType || '').toLowerCase();
    return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
  };

  const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const getExpenseOptionsForAccount = (account) => {
    if (!isLiabilityAccount(account)) return [];

    const accountText = normalizeText(`${account.accountName || ''} ${account.accountOfficialName || ''} ${account.accountSubtype || ''}`);
    const ranked = [...fixedExpenses].sort((left, right) => {
      const leftName = normalizeText(left.name);
      const rightName = normalizeText(right.name);
      const leftScore = (accountText.includes(leftName) || leftName.includes(accountText) ? 3 : 0) + (left.group === 'Housing' ? 2 : left.group === 'Debt' ? 1 : 0);
      const rightScore = (accountText.includes(rightName) || rightName.includes(accountText) ? 3 : 0) + (right.group === 'Housing' ? 2 : right.group === 'Debt' ? 1 : 0);
      return rightScore - leftScore;
    });

    return ranked;
  };

  const getSelectedExpenseForAccount = (account) => {
    const options = getExpenseOptionsForAccount(account);
    const selectedId = selectedExpenseByAccount[account._id];
    return options.find((expense) => String(expense._id) === String(selectedId)) || options[0] || null;
  };

  const fetchGoals = useCallback(async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      console.log('[GoalsPage] fetching goals for householdId:', user.householdId);
      const [goalsRes, acctRes, fixedRes] = await Promise.all([
        api.get(`/goals/${user.householdId}`),
        api.get('/plaid/linked-accounts').catch(() => ({ data: { linkedAccounts: [] } })),
        api.get(`/fixed-expenses/${user.householdId}`).catch(() => ({ data: { expenses: [] } })),
      ]);
      setGoals(goalsRes.data.goals || []);
      setTotalMonthlyContribution(goalsRes.data.totalMonthlyContribution || 0);
      setTotalMonthlyLiabilityPayment(goalsRes.data.totalMonthlyLiabilityPayment || 0);
      setLinkedAccounts(acctRes.data.linkedAccounts || []);
      setFixedExpenses(fixedRes.data.expenses || []);
    } catch (err) {
      console.error('[GoalsPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  useEffect(() => {
    if (!linkedAccounts.length || !fixedExpenses.length) return;
    setSelectedExpenseByAccount((current) => {
      const next = { ...current };
      for (const account of linkedAccounts) {
        if (next[account._id]) continue;
        const defaultExpense = getExpenseOptionsForAccount(account)[0];
        if (defaultExpense) next[account._id] = defaultExpense._id;
      }
      return next;
    });
  }, [linkedAccounts, fixedExpenses]);

  const handleCreated = () => {
    fetchGoals();
    setShowForm(false);
  };

  const savingsGoals = goals.filter((goal) => !goal.isLiabilityTracked);

  const handleCreateFromLinkedAccount = async (account) => {
    if (!user?.householdId) return;
    setCreatingLinkedId(account._id);
    try {
      await api.post(`/goals/${user.householdId}`, {
        name: buildGoalNameFromAccount(account),
        type: inferGoalType(account),
        monthlyContribution: Number(getSelectedExpenseForAccount(account)?.amount) || 0,
        target: isLiabilityAccount(account) ? (Number(account.currentBalance) || 0) : 0,
        currentBalance: Number(account.currentBalance) || 0,
        linkedAccountId: account._id,
      });
      await fetchGoals();
    } catch (err) {
      console.error('[GoalsPage] create linked goal error:', err);
      alert(err?.response?.data?.error || 'Failed to create linked goal');
    } finally {
      setCreatingLinkedId(null);
    }
  };

  const trackedAccountIds = new Set(
    (goals || []).map((goal) => goal.linkedAccountId).filter(Boolean)
  );

  const suggestedAccounts = (linkedAccounts || []).filter((account) => {
    if (!account?._id || trackedAccountIds.has(account._id)) return false;
    const subtype = String(account.accountSubtype || '').toLowerCase();
    const type = String(account.accountType || '').toLowerCase();

    return (
      type === 'investment' ||
      type === 'depository' ||
      subtype.includes('savings') ||
      subtype.includes('brokerage') ||
      subtype.includes('ira')
    );
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Goals & Funds', 'Metas y Fondos')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('Track your savings goals and financial targets.', 'Rastrea tus metas de ahorro y objetivos financieros.')}
          </p>
        </div>

        {showForm && (
          <GoalForm householdId={user?.householdId} linkedAccounts={linkedAccounts} onCreated={handleCreated} />
        )}

        <div className="mt-4 mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            {showForm ? t('Cancel', 'Cancelar') : t('+ Add Goal', '+ Agregar Objetivo')}
          </button>
        </div>

        {suggestedAccounts.length > 0 && (
          <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50/70 dark:bg-indigo-900/20 p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{t('Track Linked Accounts as Goals or Projects', 'Rastrea cuentas vinculadas como metas o proyectos')}</h2>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                  {t('Savings, mortgage, loan, and investment accounts can be tracked here and auto-synced from Plaid.', 'Las cuentas de ahorro, hipoteca, préstamo e inversión pueden rastrearse aquí y sincronizarse automáticamente desde Plaid.')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {suggestedAccounts.map((account) => (
                <div key={account._id} className="flex items-center justify-between gap-4 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-white/70 dark:bg-gray-800/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {account.accountName}
                      {account.accountMask ? ` ••${account.accountMask}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(account.accountSubtype || account.accountType || 'account')} · ${Number(account.currentBalance || 0).toFixed(2)}
                    </div>

                  </div>
                  <button
                    onClick={() => handleCreateFromLinkedAccount(account)}
                    disabled={creatingLinkedId === account._id}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creatingLinkedId === account._id
                      ? t('Creating…', 'Creando…')
                      : t('Track Here', 'Rastrear Aquí')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <SkeletonBlock className="h-5 w-40 rounded" />
                  <SkeletonBlock className="h-5 w-20 rounded" />
                </div>
                <SkeletonBlock className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <SkeletonBlock className="h-3 w-24 rounded" />
                  <SkeletonBlock className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GoalList
            householdId={user?.householdId}
            goals={savingsGoals}
            linkedAccounts={linkedAccounts}
            fixedExpenses={fixedExpenses}
            totalMonthlyContribution={totalMonthlyContribution}
            loading={loading}
            refresh={fetchGoals}
            mode="goal"
          />
        )}
      </div>
    </Layout>
  );
}
