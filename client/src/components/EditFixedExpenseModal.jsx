import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function EditFixedExpenseModal({ expense, onSave, onClose }){
  const { t } = useLanguage();
  const [name, setName] = useState(expense?.name || '');
  const [amount, setAmount] = useState(expense?.amount || 0);
  const [group, setGroup] = useState(expense?.group || 'Other');
  const [frequency, setFrequency] = useState(expense?.frequency || 'monthly');
  const [dueDay, setDueDay] = useState(expense?.dueDay || 1);
  const [loading, setLoading] = useState(false);

  const groups = ['Housing', 'Utilities', 'Insurance', 'Auto', 'Family', 'Food', 'Savings', 'Debt', 'Bills', 'Entertainment', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = {
        name,
        amount: Number(amount),
        group,
        frequency,
        dueDay: Number(dueDay),
      };
      await onSave(updates);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{t('Edit Fixed Expense', 'Editar Gasto Fijo')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Name', 'Nombre')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Category', 'Categoría')}</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Frequency', 'Frecuencia')}</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
              <option value="weekly">{t('Weekly', 'Semanal')}</option>
              <option value="biweekly">{t('Biweekly', 'Quincenal')}</option>
              <option value="monthly">{t('Monthly', 'Mensual')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Due Day (of month)', 'Día de vencimiento')}</label>
            <input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {t('Cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
