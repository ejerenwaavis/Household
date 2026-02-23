import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import EditFixedExpenseModal from './EditFixedExpenseModal';

export default function FixedExpenseList({ householdId, byGroup = {}, total = 0, loading = false, refresh }){
  const { t, language } = useLanguage();
  const [editingExpense, setEditingExpense] = useState(null);
  console.log('[FixedExpenseList] render byGroup:', Object.keys(byGroup), 'total:', total, 'loading:', loading);

  const handleDelete = async (expense) => {
    const id = expense._id || expense.id;
    if (!id) return console.error('[FixedExpenseList] missing id for delete');
    if (!householdId) return console.error('[FixedExpenseList] missing householdId');
    if (!window.confirm(t(`Delete "${expense.name}"?`, `¿Eliminar "${expense.name}"?`))) return;
    try {
      console.log('[FixedExpenseList] deleting', { id, householdId });
      await api.delete(`/fixed-expenses/${householdId}/${id}`);
      console.log('[FixedExpenseList] delete success', id);
      refresh && refresh();
    } catch (err) {
      console.error('[FixedExpenseList] delete error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
  };

  const handleSaveEdit = async (updates) => {
    const id = editingExpense._id || editingExpense.id;
    if (!id) return console.error('[FixedExpenseList] missing id for edit');
    if (!householdId) return console.error('[FixedExpenseList] missing householdId');

    try {
      console.log('[FixedExpenseList] patching', { id, householdId, updates });
      const res = await api.patch(`/fixed-expenses/${householdId}/${id}`, updates);
      console.log('[FixedExpenseList] patch response', res && res.data);
      setEditingExpense(null);
      refresh && refresh();
    } catch (err) {
      console.error('[FixedExpenseList] patch error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to update');
    }
  };

  const categoryColors = {
    'Housing': 'text-blue-600',
    'Utilities': 'text-yellow-600',
    'Insurance': 'text-orange-600',
    'Auto': 'text-purple-600',
    'Family': 'text-pink-600',
    'Food': 'text-green-600',
    'Savings': 'text-teal-600',
    'Debt': 'text-red-600',
    'Bills': 'text-indigo-600',
    'Entertainment': 'text-violet-600',
    'Other': 'text-gray-600',
  };

  if (loading) {
    return <div className="text-gray-500">{t('Loading…', 'Cargando…')}</div>;
  }

  if (Object.keys(byGroup).length === 0) {
    return <div className="text-sm text-gray-500">{t('No fixed expenses yet.', 'Sin gastos fijos aún.')}</div>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(byGroup).map(([group, expenses]) => {
        const groupTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const colorClass = categoryColors[group] || 'text-gray-600';
        return (
          <div key={group}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium ${colorClass}`}>{group}</h3>
              <span className="text-sm font-semibold text-gray-700">${groupTotal.toFixed(2)}</span>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-2">
              {expenses.map((e) => {
                const key = e._id || e.id;
                // Use translated name if available and language is Spanish
                const displayName = language === 'es' && e.name_es ? e.name_es : e.name;
                return (
                  <div key={key} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{displayName}</div>
                      <div className="text-xs text-gray-400">
                        {t('Frequency', 'Frecuencia')}: <span className="capitalize">{t(e.frequency, e.frequency === 'weekly' ? 'Semanal' : e.frequency === 'biweekly' ? 'Quincenal' : 'Mensual')}</span>
                        {e.dueDay && ` • ${t('Due', 'Vence')}: ${t('Day', 'Día')} ${e.dueDay}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-semibold text-gray-800">${Number(e.amount || 0).toFixed(2)}</div>
                      <button onClick={()=>handleEdit(e)} className="text-sm text-indigo-600">{t('Edit', 'Editar')}</button>
                      <button onClick={()=>handleDelete(e)} className="text-sm text-red-600">{t('Delete', 'Eliminar')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-6 border border-red-100 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-600">{t('Total Monthly Fixed Expenses', 'Total de Gastos Fijos Mensuales')}</div>
            <div className="text-3xl font-bold text-red-600">${total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="text-right mt-4">
        <button onClick={() => { console.log('[FixedExpenseList] refresh clicked'); refresh && refresh(); }} className="text-sm text-indigo-600">{t('Refresh', 'Actualizar')}</button>
      </div>

      {editingExpense && (
        <EditFixedExpenseModal
          expense={editingExpense}
          onSave={handleSaveEdit}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}
