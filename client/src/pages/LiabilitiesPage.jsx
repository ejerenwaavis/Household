import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import GoalList from '../components/GoalList';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import SkeletonBlock from '../components/SkeletonBlock';

export default function LiabilitiesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [liabilityPaymentStatus, setLiabilityPaymentStatus] = useState({ totalPlanned: 0, totalPaid: 0, totalRemaining: 0, byGoalId: {} });
  const [liabilitySummary, setLiabilitySummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creatingLinkedId, setCreatingLinkedId] = useState(null);
  const [selectedExpenseByAccount, setSelectedExpenseByAccount] = useState({});

  const currentMonth = (() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  })();

  const isLiabilityAccount = (account) => {
    const subtype = String(account?.accountSubtype || '').toLowerCase();
    const type = String(account?.accountType || '').toLowerCase();
    return type === 'loan' || subtype.includes('mortgage') || subtype.includes('loan');
  };

  const normalizeText = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const inferGoalType = () => 'Project';

  const buildGoalNameFromAccount = (account) => {
    const subtype = String(account?.accountSubtype || '').toLowerCase();
    if (subtype.includes('mortgage')) return `${account.accountName} Mortgage`;
    if (subtype.includes('loan')) return `${account.accountName} Payoff`;
    return `${account.accountName} Liability`;
  };

  const getExpenseOptionsForAccount = (account) => {
    if (!isLiabilityAccount(account)) return [];

    const accountText = normalizeText(`${account.accountName || ''} ${account.accountOfficialName || ''} ${account.accountSubtype || ''}`);
    return [...fixedExpenses].sort((left, right) => {
      const leftName = normalizeText(left.name);
      const rightName = normalizeText(right.name);
      const leftScore = (accountText.includes(leftName) || leftName.includes(accountText) ? 3 : 0) + (left.group === 'Housing' ? 2 : left.group === 'Debt' ? 1 : 0);
      const rightScore = (accountText.includes(rightName) || rightName.includes(accountText) ? 3 : 0) + (right.group === 'Housing' ? 2 : right.group === 'Debt' ? 1 : 0);
      return rightScore - leftScore;
    });
  };

  const getSelectedExpenseForAccount = (account) => {
    const options = getExpenseOptionsForAccount(account);
    const selectedId = selectedExpenseByAccount[account._id];
    return options.find((expense) => String(expense._id) === String(selectedId)) || options[0] || null;
  };

  const fetchLiabilities = useCallback(async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      const [goalsRes, acctRes, fixedRes] = await Promise.all([
        api.get(`/goals/${user.householdId}/liability-report?month=${currentMonth}`),
        api.get('/plaid/linked-accounts').catch(() => ({ data: { linkedAccounts: [] } })),
        api.get(`/fixed-expenses/${user.householdId}`).catch(() => ({ data: { expenses: [] } })),
      ]);
      const liabilityGoals = goalsRes.data.liabilities || [];
      setGoals(liabilityGoals);
      setLinkedAccounts(acctRes.data.linkedAccounts || []);
      setFixedExpenses(fixedRes.data.expenses || []);
      setLiabilitySummary(goalsRes.data.summary || null);

      const byGoalId = {};
      liabilityGoals.forEach((goal) => {
        const planned = Number(goal.payoffMetrics?.scheduledPayment ?? goal.monthlyContribution) || 0;
        const paid = Number(goal.payoffMetrics?.thisMonthPaid) || 0;
        const remaining = Number(goal.payoffMetrics?.remainingThisMonth) || 0;
        byGoalId[goal._id] = { planned, paid, remaining, outstanding: -remaining };
      });

      setLiabilityPaymentStatus({
        totalPlanned: Number(goalsRes.data.summary?.totalScheduledPayment) || 0,
        totalPaid: Number(goalsRes.data.summary?.totalPaidThisMonth) || 0,
        totalRemaining: Number(goalsRes.data.summary?.totalRemainingThisMonth) || 0,
        byGoalId,
      });
    } catch (err) {
      console.error('[LiabilitiesPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => { fetchLiabilities(); }, [fetchLiabilities]);

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

  const trackedAccountIds = new Set(goals.map((goal) => goal.linkedAccountId).filter(Boolean));
  const suggestedAccounts = linkedAccounts.filter((account) => account?._id && isLiabilityAccount(account) && !trackedAccountIds.has(account._id));

  const handleCreateFromLinkedAccount = async (account) => {
    if (!user?.householdId) return;
    setCreatingLinkedId(account._id);
    try {
      await api.post(`/goals/${user.householdId}`, {
        name: buildGoalNameFromAccount(account),
        type: inferGoalType(account),
        monthlyContribution: Number(getSelectedExpenseForAccount(account)?.amount) || 0,
        target: Number(account.currentBalance) || 0,
        currentBalance: Number(account.currentBalance) || 0,
        linkedAccountId: account._id,
        linkedFixedExpenseId: getSelectedExpenseForAccount(account)?._id || null,
      });
      await fetchLiabilities();
    } catch (err) {
      console.error('[LiabilitiesPage] create linked liability error:', err);
      alert(err?.response?.data?.error || 'Failed to create tracked liability');
    } finally {
      setCreatingLinkedId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Liabilities', 'Pasivos')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('Track mortgages, loans, and other payoff balances separately from savings goals.', 'Rastrea hipotecas, préstamos y otros saldos por pagar por separado de las metas de ahorro.')}
          </p>
        </div>

        {suggestedAccounts.length > 0 && (
          <div className="mb-6 rounded-2xl border border-orange-200 dark:border-orange-700 bg-orange-50/70 dark:bg-orange-900/20 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-orange-900 dark:text-orange-200">{t('Track Linked Liabilities', 'Rastrear pasivos vinculados')}</h2>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                {t('Mortgage and loan accounts can be tracked here with live balance sync and monthly payment defaults from fixed expenses.', 'Las cuentas de hipoteca y préstamo pueden rastrearse aquí con sincronización de saldo y pagos mensuales predeterminados desde gastos fijos.')}
              </p>
            </div>

            <div className="space-y-3">
              {suggestedAccounts.map((account) => (
                <div key={account._id} className="flex items-center justify-between gap-4 rounded-xl border border-orange-100 dark:border-orange-800 bg-white/70 dark:bg-gray-800/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {account.accountName}
                      {account.accountMask ? ` ••${account.accountMask}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {(account.accountSubtype || account.accountType || 'account')} · ${Number(account.currentBalance || 0).toFixed(2)}
                    </div>

                    <div className="mt-2 flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-orange-800 dark:text-orange-300">
                        {t('Use fixed expense as monthly payment', 'Usar gasto fijo como pago mensual')}
                      </label>
                      <select
                        value={selectedExpenseByAccount[account._id] || ''}
                        onChange={(e) => setSelectedExpenseByAccount((current) => ({ ...current, [account._id]: e.target.value }))}
                        className="max-w-sm rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-orange-700 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <option value="">{t('No fixed expense selected', 'Sin gasto fijo seleccionado')}</option>
                        {getExpenseOptionsForAccount(account).map((expense) => (
                          <option key={expense._id} value={expense._id}>
                            {expense.name} · ${Number(expense.amount || 0).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCreateFromLinkedAccount(account)}
                    disabled={creatingLinkedId === account._id}
                    className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {creatingLinkedId === account._id ? t('Creating…', 'Creando…') : t('Track Here', 'Rastrear Aquí')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
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
          <>
            {liabilitySummary && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">{t('Remaining Balance', 'Saldo Restante')}</div>
                  <div className="mt-1 text-2xl font-bold text-orange-700">${Number(liabilitySummary.totalRemainingBalance || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-green-600">{t('Paid Down', 'Pagado')}</div>
                  <div className="mt-1 text-2xl font-bold text-green-700">${Number(liabilitySummary.totalPaidDown || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">{t('Payoff Progress', 'Progreso de Pago')}</div>
                  <div className="mt-1 text-2xl font-bold text-blue-700">{Number(liabilitySummary.overallPayoffPercent || 0)}%</div>
                </div>
                <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">{t('Paid This Month', 'Pagado Este Mes')}</div>
                  <div className="mt-1 text-2xl font-bold text-purple-700">${Number(liabilitySummary.totalPaidThisMonth || 0).toFixed(2)}</div>
                </div>
              </div>
            )}

            <GoalList
              householdId={user?.householdId}
              goals={goals}
              linkedAccounts={linkedAccounts}
              fixedExpenses={fixedExpenses}
              totalMonthlyLiabilityPayment={Number(liabilityPaymentStatus.totalPlanned || 0)}
              liabilityPaymentStatus={liabilityPaymentStatus.byGoalId}
              loading={loading}
              refresh={fetchLiabilities}
              mode="liability"
            />
          </>
        )}
      </div>
    </Layout>
  );
}