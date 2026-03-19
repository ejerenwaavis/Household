import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import EditGoalModal from './EditGoalModal';
import AddGoalContributionModal from './AddGoalContributionModal';

const typeColors = {
  Emergency: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-700',
    bar: 'bg-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
  },
  Project: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    bar: 'bg-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  },
  Investment: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-200 dark:border-teal-700',
    bar: 'bg-teal-500',
    badge: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
  },
  Other: {
    bg: 'bg-gray-50 dark:bg-gray-700/50',
    border: 'border-gray-200 dark:border-gray-600',
    bar: 'bg-gray-400',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  },
};

const typeLabel = (t, tp) =>
  t(tp, tp === 'Emergency' ? 'Emergencia' : tp === 'Project' ? 'Proyecto' : tp === 'Investment' ? 'Inversión' : 'Otro');

export default function GoalList({ householdId, goals = [], linkedAccounts = [], fixedExpenses = [], totalMonthlyContribution = 0, totalMonthlyLiabilityPayment = 0, liabilityPaymentStatus = {}, loading = false, refresh, mode = 'goal' }) {
  const { t } = useLanguage();
  const [editingGoal, setEditingGoal] = useState(null);
  const [addingFundsTo, setAddingFundsTo] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  const formatCurrency = (amount) => {
    const numericAmount = Number(amount) || 0;
    const absoluteValue = Math.abs(numericAmount).toFixed(2);
    return numericAmount < 0 ? `-$${absoluteValue}` : `$${absoluteValue}`;
  };

  const handleDelete = async (goal) => {
    const id = goal._id || goal.id;
    if (!window.confirm(t(`Delete "${goal.name}"?`, `¿Eliminar "${goal.name}"?`))) return;
    try {
      await api.delete(`/goals/${householdId}/${id}`);
      refresh && refresh();
    } catch (err) {
      console.error('[GoalList] delete error:', err);
      alert(err?.response?.data?.error || t('Failed to delete', 'Error al eliminar'));
    }
  };

  const handleSaveEdit = async (updates) => {
    const id = editingGoal._id || editingGoal.id;
    try {
      await api.patch(`/goals/${householdId}/${id}`, updates);
      setEditingGoal(null);
      refresh && refresh();
    } catch (err) {
      console.error('[GoalList] patch error:', err);
      alert(err?.response?.data?.error || t('Failed to update', 'Error al actualizar'));
    }
  };

  const handleAddFundsToGoal = (goal) => {
    setAddingFundsTo(goal);
  };

  const handleSaveContribution = async (contributionData) => {
    if (!householdId || !addingFundsTo) return console.error('[GoalList] missing householdId or goal');
    try {
      const goalId = addingFundsTo._id || addingFundsTo.id;
      console.log('[GoalList] creating contribution', { goalId, ...contributionData });
      await api.post(`/goal-contributions/${householdId}/${goalId}`, contributionData);
      setAddingFundsTo(null);
      refresh && refresh();
    } catch (err) {
      console.error('[GoalList] contribution error', err);
      alert(err?.response?.data?.error || t('Failed to add contribution', 'Error al agregar fondos'));
    }
  };

  const handleSyncBalance = async (goal) => {
    const id = goal._id || goal.id;
    setSyncingId(id);
    try {
      await api.post(`/goals/${householdId}/${id}/sync-balance`);
      refresh && refresh();
    } catch (err) {
      console.error('[GoalList] sync-balance error:', err);
      alert(err?.response?.data?.error || t('Sync failed', 'Error al sincronizar'));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteContribution = async (goal, payment) => {
    if (!householdId || !payment?.canDelete) return;
    if (!window.confirm(t('Delete this payment entry?', '¿Eliminar este registro de pago?'))) return;
    try {
      const goalId = goal._id || goal.id;
      await api.delete(`/goal-contributions/${householdId}/${goalId}/${payment._id}`);
      refresh && refresh();
    } catch (err) {
      console.error('[GoalList] delete contribution error:', err);
      alert(err?.response?.data?.error || t('Failed to delete payment', 'Error al eliminar el pago'));
    }
  };

  if (loading) {
    return <div className="text-gray-500">{t('Loading…', 'Cargando…')}</div>;
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-3">{mode === 'liability' ? '🏠' : '🎯'}</div>
        <div className="text-sm">
          {mode === 'liability'
            ? t('No liabilities tracked yet. Link or add your first loan account.', 'Aún no hay deudas rastreadas. Vincula o agrega tu primera cuenta de préstamo.')
            : t('No goals yet. Add your first savings goal!', 'Sin objetivos aún. ¡Agrega tu primer objetivo de ahorro!')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const key = goal._id || goal.id;
        const colors = typeColors[goal.type] || typeColors.Other;
        const progress = goal.progressPercent != null
          ? goal.progressPercent
          : (goal.target > 0 ? Math.min(100, Math.round((goal.currentBalance / goal.target) * 100)) : null);
        const isLiabilityTracked = Boolean(goal.isLiabilityTracked);
        const paymentStatus = liabilityPaymentStatus[goal._id] || null;
        const payoffMetrics = goal.payoffMetrics || null;

        // Find the live linked account record (from Plaid-synced list)
        const linkedAcct = goal.linkedAccountId
          ? (goal.linkedAccount || linkedAccounts.find(a => a._id === goal.linkedAccountId))
          : null;
        const isSyncing = syncingId === key;

        return (
          <div key={key} className={`rounded-2xl p-5 border shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
            goal.type === 'Emergency'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
              : goal.type === 'Project'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
              : goal.type === 'Investment'
              ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                    {typeLabel(t, goal.type)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isLiabilityTracked ? t('Monthly payment', 'Pago mensual') : t('Monthly contribution', 'Aportación mensual')}:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">${Number(goal.monthlyContribution || 0).toFixed(2)}</span>
                </div>
                {isLiabilityTracked && paymentStatus && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('Paid this month', 'Pagado este mes')}: <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(paymentStatus.paid || 0)}</span>
                    {' · '}
                    {t('Remaining this month', 'Restante este mes')}: <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(-(Number(paymentStatus.remaining) || 0))}</span>
                  </div>
                )}

                {/* Linked bank account chip */}
                {linkedAcct && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-full px-2.5 py-0.5">
                      🏦 {linkedAcct.institutionName || linkedAcct.accountName}
                      {linkedAcct.accountMask ? ` ••${linkedAcct.accountMask}` : ''}
                      {linkedAcct.accountSubtype ? ` · ${linkedAcct.accountSubtype}` : ''}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('Bank balance', 'Saldo bancario')}:{' '}
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        ${(Number(linkedAcct.currentBalance) || 0).toFixed(2)}
                      </span>
                    </span>
                    <button
                      onClick={() => handleSyncBalance(goal)}
                      disabled={isSyncing}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 disabled:opacity-50 underline underline-offset-2 transition-colors"
                    >
                      {isSyncing ? t('Syncing…', 'Sincronizando…') : t('Sync Balance', 'Sincronizar saldo')}
                    </button>
                    {isLiabilityTracked && goal.linkedFixedExpenseName && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        {t('Linked payment', 'Pago vinculado')}: {goal.linkedFixedExpenseName}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                  onClick={() => handleAddFundsToGoal(goal)}
                  className="text-sm text-green-600 hover:text-green-700 transition-colors"
                >
                  {isLiabilityTracked ? t('Record Payment', 'Registrar Pago') : t('Add Funds', 'Agregar Fondos')}
                </button>
                <button
                  onClick={() => setEditingGoal(goal)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  {t('Edit', 'Editar')}
                </button>
                <button
                  onClick={() => handleDelete(goal)}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  {t('Delete', 'Eliminar')}
                </button>
              </div>
            </div>

            {isLiabilityTracked && payoffMetrics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-white/60 dark:bg-gray-700/40 px-3 py-2 border border-orange-100 dark:border-orange-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('Remaining Balance', 'Saldo Restante')}</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(payoffMetrics.remainingBalance || 0)}</div>
                  </div>
                  <div className="rounded-xl bg-white/60 dark:bg-gray-700/40 px-3 py-2 border border-green-100 dark:border-green-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('Paid Down', 'Pagado')}</div>
                    <div className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(payoffMetrics.paidDown || 0)}</div>
                  </div>
                  <div className="rounded-xl bg-white/60 dark:bg-gray-700/40 px-3 py-2 border border-blue-100 dark:border-blue-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('Payoff Progress', 'Progreso de Pago')}</div>
                    <div className="font-semibold text-blue-700 dark:text-blue-400">{Number(payoffMetrics.payoffPercent || 0)}%</div>
                  </div>
                  <div className="rounded-xl bg-white/60 dark:bg-gray-700/40 px-3 py-2 border border-purple-100 dark:border-purple-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('Est. Payoff', 'Pago Estimado')}</div>
                    <div className="font-semibold text-purple-700 dark:text-purple-400">
                      {payoffMetrics.estimatedPayoffDate ? new Date(payoffMetrics.estimatedPayoffDate).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>

                {Array.isArray(goal.paymentHistory) && goal.paymentHistory.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-700/30 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                      {t('Recent Payment History', 'Historial Reciente de Pagos')}
                    </div>
                    <div className="space-y-2">
                      {goal.paymentHistory.slice(0, 3).map((payment) => (
                        <div key={payment._id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 dark:text-gray-200">
                              {payment.fixedExpenseName || t('Liability Payment', 'Pago de Pasivo')}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {payment.paymentSourceLabel || payment.source} · {payment.contributionDate ? new Date(payment.contributionDate).toLocaleDateString() : '—'}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(payment.amount || 0)}</div>
                            {payment.canDelete && (
                              <button
                                onClick={() => handleDeleteContribution(goal, payment)}
                                className="text-xs text-red-600 hover:text-red-700 transition-colors"
                              >
                                {t('Delete', 'Eliminar')}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : goal.target > 0 ? (
              <div>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                  <span>
                    ${Number(goal.currentBalance || 0).toFixed(2)} {isLiabilityTracked ? t('remaining', 'restante') : t('saved', 'guardado')}
                  </span>
                  <span>
                    {isLiabilityTracked ? t('starting balance', 'saldo inicial') : t('of', 'de')} ${Number(goal.target).toFixed(2)} &bull; {progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden border border-gray-200 dark:border-gray-600">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${colors.bar}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-500 dark:text-gray-400">{t('Current Balance', 'Saldo Actual')}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  ${Number(goal.currentBalance || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Total monthly contributions summary */}
      {mode !== 'liability' && (
        <div className="bg-gradient-to-r from-teal-50 dark:from-teal-900/30 to-green-50 dark:to-green-900/30 rounded-2xl p-5 border border-teal-100 dark:border-teal-700/50 mt-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {t('Total Monthly Savings Contributions', 'Total de Aportaciones Mensuales de Ahorro')}
            </div>
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
            {formatCurrency(totalMonthlyContribution || 0)}
            </div>
          </div>
        </div>
      )}

      {(mode === 'liability' || Number(totalMonthlyLiabilityPayment || 0) > 0) && (
        <div className="bg-gradient-to-r from-orange-50 dark:from-orange-900/30 to-red-50 dark:to-red-900/30 rounded-2xl p-5 border border-orange-100 dark:border-orange-700/50 mt-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {t('Total Monthly Liability Payments', 'Total de Pagos Mensuales de Deuda')}
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totalMonthlyLiabilityPayment || 0)}
            </div>
          </div>
        </div>
      )}

      <div className="text-right">
        <button
          onClick={() => refresh && refresh()}
          className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {t('Refresh', 'Actualizar')}
        </button>
      </div>

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          linkedAccounts={linkedAccounts}
          fixedExpenses={fixedExpenses}
          onSave={handleSaveEdit}
          onClose={() => setEditingGoal(null)}
        />
      )}

      {addingFundsTo && (
        <AddGoalContributionModal
          goal={addingFundsTo}
          householdId={householdId}
          onSave={handleSaveContribution}
          onClose={() => setAddingFundsTo(null)}
        />
      )}
    </div>
  );
}
