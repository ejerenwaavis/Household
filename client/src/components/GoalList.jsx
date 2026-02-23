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

export default function GoalList({ householdId, goals = [], totalMonthlyContribution = 0, loading = false, refresh }) {
  const { t } = useLanguage();
  const [editingGoal, setEditingGoal] = useState(null);
  const [addingFundsTo, setAddingFundsTo] = useState(null);

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

  if (loading) {
    return <div className="text-gray-500">{t('Loading…', 'Cargando…')}</div>;
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-3">🎯</div>
        <div className="text-sm">{t('No goals yet. Add your first savings goal!', 'Sin objetivos aún. ¡Agrega tu primer objetivo de ahorro!')}</div>
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
                  {t('Monthly contribution', 'Aportación mensual')}:{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">${Number(goal.monthlyContribution || 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                  onClick={() => handleAddFundsToGoal(goal)}
                  className="text-sm text-green-600 hover:text-green-700 transition-colors"
                >
                  {t('Add Funds', 'Agregar Fondos')}
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

            {goal.target > 0 ? (
              <div>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                  <span>
                    ${Number(goal.currentBalance || 0).toFixed(2)} {t('saved', 'guardado')}
                  </span>
                  <span>
                    {t('of', 'de')} ${Number(goal.target).toFixed(2)} &bull; {progress}%
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
      <div className="bg-gradient-to-r from-teal-50 dark:from-teal-900/30 to-green-50 dark:to-green-900/30 rounded-2xl p-5 border border-teal-100 dark:border-teal-700/50 mt-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {t('Total Monthly Contributions', 'Total de Aportaciones Mensuales')}
          </div>
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
            ${Number(totalMonthlyContribution || 0).toFixed(2)}
          </div>
        </div>
      </div>

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
