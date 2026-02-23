import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const TYPES = ['Emergency', 'Project', 'Investment', 'Other'];

const typeLabel = (t, tp) =>
  t(tp, tp === 'Emergency' ? 'Emergencia' : tp === 'Project' ? 'Proyecto' : tp === 'Investment' ? 'Inversión' : 'Otro');

export default function GoalForm({ householdId, onCreated }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [type, setType] = useState('Other');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [target, setTarget] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setType('Other');
    setMonthlyContribution('');
    setTarget('');
    setCurrentBalance('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!householdId) return setError(t('No household selected', 'Sin hogar seleccionado'));
    if (!name.trim()) return setError(t('Goal name is required', 'El nombre del objetivo es requerido'));

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        monthlyContribution: Number(monthlyContribution) || 0,
        target: Number(target) || 0,
        currentBalance: Number(currentBalance) || 0,
      };
      const res = await api.post(`/goals/${householdId}`, payload);
      if (onCreated) onCreated(res.data.goal);
      reset();
    } catch (err) {
      console.error('[GoalForm] submit error:', err);
      setError(err?.response?.data?.error || t('Failed to create goal', 'Error al crear objetivo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-500">{t('Goal Name', 'Nombre del Objetivo')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('e.g., Emergency Fund', 'p.ej., Fondo de Emergencia')}
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
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full p-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-xs text-gray-500">
            {t('Target Amount', 'Monto Objetivo')} <span className="text-gray-400">({t('optional', 'opcional')})</span>
          </label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full p-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Current Balance', 'Saldo Actual')}</label>
          <input
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full p-2 border rounded-lg"
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-500 mt-3">{error}</div>}

      <div className="mt-4 text-right">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          {loading ? t('Saving...', 'Guardando...') : t('Add Goal', 'Agregar Objetivo')}
        </button>
      </div>
    </form>
  );
}
