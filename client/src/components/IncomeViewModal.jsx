import React from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

/** Resolve the true dollar amount from any Income document shape */
function resolveAmount(e) {
  if (typeof e.weeklyTotal === 'number' && e.weeklyTotal > 0) return e.weeklyTotal;
  if (typeof e.amount === 'number') return e.amount;
  if (typeof e.dailyAmount === 'number') return e.dailyAmount;
  if (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown.length) {
    return e.dailyBreakdown.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  }
  return 0;
}

export default function IncomeViewModal({ title, entries = [], members = [], householdId, onRefresh, onClose }) {
  const { t } = useLanguage();

  const handleDelete = async (entry) => {
    const id = entry._id || entry.id;
    if (!id || !householdId) {
      alert('Cannot delete: missing entry ID or household.');
      return;
    }
    if (!window.confirm(t('Delete this income entry?', '¿Eliminar esta entrada de ingreso?'))) return;
    try {
      await api.delete(`/income/${householdId}/${id}`);
      onRefresh && onRefresh();
      onClose();
    } catch (err) {
      console.error('[IncomeViewModal] delete error', err);
      alert(err?.response?.data?.error || t('Failed to delete', 'Error al eliminar'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-2xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {t('No income entries for this period', 'Sin entradas de ingresos para este período')}
            </div>
          ) : (
            <ul className="space-y-4">
              {entries.map((e, i) => {
                const key = e._id || e.id || i;
                const amountVal = resolveAmount(e);
                const isSynced = Boolean(e.isSynced);
                const sourceText = e.source || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.source) || 'Manual';
                const dateText = e.date || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.date) || null;
                const contributorText = e.contributorName || 'Unknown';

                return (
                  <div key={key} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-100 dark:border-gray-600">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>{sourceText} • <span className="text-indigo-600 dark:text-indigo-400">{contributorText}</span></span>
                        {isSynced && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Synced</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {e.description && `${e.description}`}
                        {dateText && ` ${e.description ? '• ' : ''}${new Date(dateText).toLocaleDateString()}`}
                        {e.week && <span className="ml-1 text-gray-400">· Week {e.week}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
                        ${Number(amountVal).toFixed(2)}
                      </div>
                      {householdId && !isSynced && (
                        <button
                          onClick={() => handleDelete(e)}
                          className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors"
                        >
                          {t('Delete', 'Eliminar')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </ul>
          )}

          {entries.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  {t('Total', 'Total')}:
                </span>
                <span className="text-2xl font-bold text-indigo-600 tabular-nums">
                  ${entries.reduce((sum, e) => sum + resolveAmount(e), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors font-medium"
          >
            {t('Close', 'Cerrar')}
          </button>
        </div>
      </div>
    </div>
  );
}


