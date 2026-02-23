import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const TYPES = ['Emergency', 'Project', 'Investment', 'Other'];

const typeLabel = (t, tp) =>
  t(tp, tp === 'Emergency' ? 'Emergencia' : tp === 'Project' ? 'Proyecto' : tp === 'Investment' ? 'Inversión' : 'Otro');

export default function EditGoalModal({ goal, onSave, onClose }) {
  const { t } = useLanguage();
  const [name, setName] = useState(goal?.name || '');
  const [type, setType] = useState(goal?.type || 'Other');
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution ?? 0);
  const [target, setTarget] = useState(goal?.target ?? 0);
  const [currentBalance, setCurrentBalance] = useState(goal?.currentBalance ?? 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        monthlyContribution: Number(monthlyContribution),
        target: Number(target),
        currentBalance: Number(currentBalance),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{t('Edit Goal', 'Editar Objetivo')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Goal Name', 'Nombre del Objetivo')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Type', 'Tipo')}</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{typeLabel(t, tp)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Monthly Contribution', 'Aportación Mensual')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Target Amount', 'Monto Objetivo')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Current Balance', 'Saldo Actual')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
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
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Save', 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
