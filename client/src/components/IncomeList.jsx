import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import EditIncomeModal from './EditIncomeModal';

export default function IncomeList({ householdId, entries = [], members = [], loading = false, refresh }){
  const { t, language } = useLanguage();
  const [editingEntry, setEditingEntry] = useState(null);
  console.log('[IncomeList] render entries count:', entries.length, 'loading:', loading, 'householdId:', householdId);

  const handleDelete = async (entry) => {
    const id = entry._id || entry.id;
    if (!id) return console.error('[IncomeList] missing id for delete');
    if (!householdId) return console.error('[IncomeList] missing householdId for delete');
    if (!window.confirm(t('Delete this income entry?', '\u00bfEliminar esta entrada de ingreso?'))) return;
    try {
      console.log('[IncomeList] deleting', { id, householdId });
      await api.delete(`/income/${householdId}/${id}`);
      console.log('[IncomeList] delete success', id);
      refresh && refresh();
    } catch (err) {
      console.error('[IncomeList] delete error', err, err?.response?.data);
      alert(err?.response?.data?.error || t('Failed to delete', 'Error al eliminar'));
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
  };

  const handleSaveEdit = async (updates) => {
    const id = editingEntry._id || editingEntry.id;
    if (!id) return console.error('[IncomeList] missing id for edit');
    if (!householdId) return console.error('[IncomeList] missing householdId for edit');

    try {
      console.log('[IncomeList] patching', { id, householdId, updates });
      const res = await api.patch(`/income/${householdId}/${id}`, updates);
      console.log('[IncomeList] patch response', res && res.data);
      setEditingEntry(null);
      refresh && refresh();
    } catch (err) {
      console.error('[IncomeList] patch error', err, err?.response?.data);
      alert(err?.response?.data?.error || t('Failed to update', 'Error al actualizar'));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
      {loading ? (
        <div className="text-gray-500 dark:text-gray-400">{t('Loading…', 'Cargando…')}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">{t('No income entries yet.', 'Sin entradas de ingresos aún.')}</div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e, i) => {
            const key = e._id || e.id || i;
            // Determine amount safely from possible shapes
            let amountVal = 0;
            if (typeof e.amount === 'number') amountVal = e.amount;
            else if (typeof e.dailyAmount === 'number') amountVal = e.dailyAmount;
            else if (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown.length) {
              // sum daily breakdown amounts (fallback)
              amountVal = e.dailyBreakdown.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            }

            // Determine source, date, and contributor name from various shapes
            let sourceText = e.source || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.source) || 'Manual';
            let contributorText = e.contributorName || 'Unknown';
            const dateText = e.date || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.date) || null;
            
            // Use translated text if available
            if (language === 'es') {
              if (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.source_es) {
                sourceText = e.dailyBreakdown[0].source_es;
              }
              if (e.contributorName_es) {
                contributorText = e.contributorName_es;
              }
            }

            return (
              <li key={key} className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{sourceText} • <span className="text-indigo-600 dark:text-indigo-400">{contributorText}</span></div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{e.description || ''} {dateText ? `• ${new Date(dateText).toLocaleString()}` : ''}</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">${Number(amountVal || 0).toFixed(2)}</div>
                  <button onClick={()=>handleEdit(e)} className="text-sm text-indigo-600">{t('Edit', 'Editar')}</button>
                  <button onClick={()=>handleDelete(e)} className="text-sm text-red-600">{t('Delete', 'Eliminar')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 text-right">
        <button onClick={() => { console.log('[IncomeList] refresh clicked'); refresh && refresh(); }} className="text-sm text-indigo-600">{t('Refresh', 'Actualizar')}</button>
      </div>

      {editingEntry && (
        <EditIncomeModal
          income={editingEntry}
          members={members}
          onSave={handleSaveEdit}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
