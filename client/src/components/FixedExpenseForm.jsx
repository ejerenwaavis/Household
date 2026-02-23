import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function FixedExpenseForm({ householdId, onCreated }){
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [group, setGroup] = useState('Other');
  const [frequency, setFrequency] = useState('monthly');
  const [dueDay, setDueDay] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const groups = ['Housing', 'Utilities', 'Insurance', 'Auto', 'Family', 'Food', 'Savings', 'Debt', 'Bills', 'Entertainment', 'Other'];

  const reset = () => { 
    setName('');
    setAmount('');
    setGroup('Other');
    setFrequency('monthly');
    setDueDay('1');
    setError(null); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!householdId) return setError(t('No household selected', 'Sin hogar seleccionado'));
    if (!name || !amount || Number(amount) <= 0) return setError(t('Enter name and valid amount', 'Ingresa nombre y monto válido'));

    setLoading(true);
    try {
      const payload = {
        name,
        amount: Number(amount),
        group,
        frequency,
        dueDay: Number(dueDay),
      };

      console.log('[FixedExpenseForm] submitting payload:', payload, 'householdId:', householdId);

      const res = await api.post(`/fixed-expenses/${householdId}`, payload);
      console.log('[FixedExpenseForm] response:', res && res.data);

      const created = res.data.expense || { id: res.data.id, ...payload };
      if (onCreated) onCreated(created);
      reset();
    } catch (err) {
      console.error('[FixedExpenseForm] submit error:', err, err?.response?.data);
      setError(err?.response?.data?.error || t('Failed to create expense', 'Error al crear gasto'));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500">{t('Name', 'Nombre')}</label>
          <input 
            value={name} 
            onChange={(e)=>setName(e.target.value)} 
            placeholder={t('e.g., Rent', 'p.ej., Renta')} 
            className="mt-1 w-full p-2 border rounded-lg" 
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
          <input 
            value={amount} 
            onChange={(e)=>setAmount(e.target.value)} 
            placeholder="0.00" 
            type="number" 
            step="0.01"
            className="mt-1 w-full p-2 border rounded-lg" 
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Category', 'Categoría')}</label>
          <select value={group} onChange={(e)=>setGroup(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-xs text-gray-500">{t('Frequency', 'Frecuencia')}</label>
          <select value={frequency} onChange={(e)=>setFrequency(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
            <option value="weekly">{t('Weekly', 'Semanal')}</option>
            <option value="biweekly">{t('Biweekly', 'Quincenal')}</option>
            <option value="monthly">{t('Monthly', 'Mensual')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Due Day (of month)', 'Día de vencimiento')}</label>
          <input 
            value={dueDay} 
            onChange={(e)=>setDueDay(e.target.value)} 
            type="number"
            min="1"
            max="31"
            className="mt-1 w-full p-2 border rounded-lg" 
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-500 mt-3">{error}</div>}

      <div className="mt-4 text-right">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {loading ? t('Saving...', 'Guardando...') : t('Add Fixed Expense', 'Agregar Gasto Fijo')}
        </button>
      </div>
    </form>
  );
}
