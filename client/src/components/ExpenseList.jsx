import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import EditExpenseModal from './EditExpenseModal';

export default function ExpenseList({ householdId, entries = [], members = [], loading = false, refresh }){
  const { t, language } = useLanguage();
  const [editingEntry, setEditingEntry] = useState(null);
  console.log('[ExpenseList] render entries count:', entries.length, 'loading:', loading);

  const handleDelete = async (entry) => {
    const id = entry._id || entry.id;
    if (!id) return console.error('[ExpenseList] missing id for delete');
    if (!householdId) return console.error('[ExpenseList] missing householdId');
    if (!window.confirm(t(`Delete this expense?`, `¿Eliminar este gasto?`))) return;
    try {
      console.log('[ExpenseList] deleting', { id, householdId });
      await api.delete(`/expenses/${householdId}/${id}`);
      console.log('[ExpenseList] delete success', id);
      refresh && refresh();
    } catch (err) {
      console.error('[ExpenseList] delete error', err, err?.response?.data);
      alert(err?.response?.data?.error || t('Failed to delete', 'Error al eliminar'));
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
  };

  const handleSaveEdit = async (updates) => {
    const id = editingEntry._id || editingEntry.id;
    if (!id) return console.error('[ExpenseList] missing id for edit');
    if (!householdId) return console.error('[ExpenseList] missing householdId');

    try {
      console.log('[ExpenseList] patching', { id, householdId, updates });
      const res = await api.patch(`/expenses/${householdId}/${id}`, updates);
      console.log('[ExpenseList] patch response', res && res.data);
      setEditingEntry(null);
      refresh && refresh();
    } catch (err) {
      console.error('[ExpenseList] patch error', err, err?.response?.data);
      alert(err?.response?.data?.error || t('Failed to update', 'Error al actualizar'));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
      {loading ? (
        <div className="text-gray-500 dark:text-gray-400">{t('Loading…', 'Cargando…')}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('No expenses yet.', 'Sin gastos aún.')}</div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e, i) => {
            const key = e._id || e.id || i;
            const amountVal = Number(e.amount) || 0;
            // Use translated category if available and language is Spanish
            let categoryText = language === 'es' && e.category_es ? e.category_es : (e.category || 'Other');
            let descriptionText = language === 'es' && e.description_es ? e.description_es : (e.description || '');
            const dateText = e.date ? new Date(e.date).toLocaleString() : null;
            const contributorText = e.contributorName || 'Unknown';

            return (
              <li key={key} className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{categoryText} • <span className="text-orange-600 dark:text-orange-400">{contributorText}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{descriptionText} {dateText ? `• ${dateText}` : ''}</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">${amountVal.toFixed(2)}</div>
                  <button onClick={()=>handleEdit(e)} className="text-sm text-indigo-600">{t('Edit', 'Editar')}</button>
                  <button onClick={()=>handleDelete(e)} className="text-sm text-red-600">{t('Delete', 'Eliminar')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 text-right">
        <button onClick={() => { console.log('[ExpenseList] refresh clicked'); refresh && refresh(); }} className="text-sm text-indigo-600">{t('Refresh', 'Actualizar')}</button>
      </div>

      {editingEntry && (
        <EditExpenseModal
          expense={editingEntry}
          members={members}
          onSave={handleSaveEdit}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
