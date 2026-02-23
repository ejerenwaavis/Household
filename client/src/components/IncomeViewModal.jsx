import React from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function IncomeViewModal({ title, entries = [], members = [], onClose }){
  const { t } = useLanguage();

  const handleDelete = async (entry) => {
    const id = entry._id || entry.id;
    if (!window.confirm('Delete this income entry?')) return;
    try {
      // Would need householdId - pass as prop or get from entry
      console.log('[IncomeViewModal] delete clicked for', id);
      alert('Delete functionality needs householdId. Please close modal and delete from main list.');
    } catch (err) {
      console.error('[IncomeViewModal] delete error', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="text-2xl text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {t('No income entries for this period', 'Sin entradas de ingresos para este período')}
            </div>
          ) : (
            <ul className="space-y-4">
              {entries.map((e, i) => {
                const key = e._id || e.id || i;
                
                // Determine amount safely
                let amountVal = 0;
                if (typeof e.amount === 'number') amountVal = e.amount;
                else if (typeof e.dailyAmount === 'number') amountVal = e.dailyAmount;
                else if (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown.length) {
                  amountVal = e.dailyBreakdown.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                }

                // Determine source, date, and contributor
                const sourceText = e.source || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.source) || 'Manual';
                const dateText = e.date || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.date) || null;
                const contributorText = e.contributorName || 'Unknown';

                return (
                  <div key={key} className="flex justify-between items-start bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700">
                        {sourceText} • <span className="text-indigo-600">{contributorText}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {e.description ? `${e.description}` : ''}
                        {dateText && ` ${e.description ? '•' : ''} ${new Date(dateText).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-gray-800">
                        ${Number(amountVal || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </ul>
          )}

          {entries.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">
                  {t('Total', 'Total')}:
                </span>
                <span className="text-2xl font-bold text-indigo-600">
                  ${entries.reduce((sum, e) => {
                    let amt = 0;
                    if (typeof e.amount === 'number') amt = e.amount;
                    else if (typeof e.dailyAmount === 'number') amt = e.dailyAmount;
                    else if (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown.length) {
                      amt = e.dailyBreakdown.reduce((s, d) => s + (Number(d.amount) || 0), 0);
                    }
                    return sum + amt;
                  }, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {t('Close', 'Cerrar')}
          </button>
        </div>
      </div>
    </div>
  );
}
