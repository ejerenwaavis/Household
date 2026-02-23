import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const METHODS = ['bank', 'cash', 'check', 'transfer', 'other'];

const methodLabel = (t, m) =>
  t(m, m === 'bank' ? 'Banco' : m === 'cash' ? 'Efectivo' : m === 'check' ? 'Cheque' : m === 'transfer' ? 'Transferencia' : 'Otro');

export default function AddGoalContributionModal({ goal, onSave, onClose }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('bank');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert(t('Enter a valid amount', 'Ingresa un monto válido'));
    
    setLoading(true);
    try {
      await onSave({
        goalId: goal._id || goal.id,
        amount: Number(amount),
        contributionDate,
        method,
        notes,
      });
      setAmount('');
      setNotes('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          {t('Add Funds to: ', 'Agregar Fondos a: ')}
          <span className="text-teal-600 dark:text-teal-400">{goal?.name}</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">{t('Amount', 'Monto')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">{t('Date', 'Fecha')}</label>
            <input
              type="date"
              value={contributionDate}
              onChange={(e) => setContributionDate(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">{t('Method', 'Método')}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
              {METHODS.map((m) => (
                <option key={m} value={m}>{methodLabel(t, m)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-300">
              {t('Notes', 'Notas')} <span className="text-gray-400 dark:text-gray-500">({t('optional', 'opcional')})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('e.g., Monthly contribution', 'p.ej., Aportación mensual')}
              rows="2"
              className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {t('Cancel', 'Cancelar')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-teal-600 dark:bg-teal-700 text-white rounded-lg hover:bg-teal-700 dark:hover:bg-teal-800 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Add', 'Agregar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
