import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function IncomeForm({ householdId, onCreated }){
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Salary');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [weekSelect, setWeekSelect] = useState('current');
  const [contributorName, setContributorName] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch household members on mount
  useEffect(() => {
    const fetchMembers = async () => {
      if (!householdId) return;
      try {
        console.log('[IncomeForm] fetching household members for:', householdId);
        const res = await api.get(`/households/${householdId}`);
        const memberList = res.data?.members || [];
        console.log('[IncomeForm] members fetched:', memberList);
        setMembers(memberList);
        // Auto-select first member if available
        if (memberList.length > 0 && !contributorName) {
          setContributorName(memberList[0].name);
        }
      } catch (err) {
        console.error('[IncomeForm] fetch members error:', err);
      }
    };
    fetchMembers();
  }, [householdId]);

  const reset = () => { 
    setAmount(''); 
    setSource('Salary'); 
    setDescription(''); 
    setDate('');
    setWeekSelect('current');
    setError(null); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!householdId) return setError(t('No household selected', 'Sin hogar seleccionado'));
    if (!amount || Number(amount) <= 0) return setError(t('Enter a valid amount', 'Ingresa un monto válido'));
    if (!contributorName) return setError(t('Please select a household member', 'Por favor selecciona un miembro del hogar'));

    setLoading(true);
    try {
      const payload = { amount: Number(amount), source, description, contributorName };

      // If user selected a previous week, include week+optional date
      if (weekSelect && weekSelect !== 'current') {
        const wk = Number(weekSelect.replace('wk','')) || undefined;
        if (wk) payload.week = wk;
        if (date) payload.date = date; // optional date inside that week
      } else {
        // current week
        payload.week = 'current';
      }

      console.log('[IncomeForm] submitting payload:', payload, 'householdId:', householdId);

      const res = await api.post(`/income/${householdId}/daily`, payload);
      console.log('[IncomeForm] response:', res && res.data);

      const created = res.data.income || { id: res.data.id, ...payload };
      if (onCreated) onCreated(created);
      reset();
    } catch (err) {
      console.error('[IncomeForm] submit error:', err, err?.response?.data);
      setError(err?.response?.data?.error || t('Failed to create income', 'Error al registrar ingreso'));
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs text-gray-500">{t('Member', 'Miembro')}</label>
          <select value={contributorName} onChange={(e)=>setContributorName(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
            <option value="">-- {t('Select', 'Seleccionar')} --</option>
            {members.map((m) => (
              <option key={m.userId} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
          <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" type="number" step="0.01" className="mt-1 w-full p-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Source', 'Fuente')}</label>
          <select value={source} onChange={(e)=>setSource(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
            <option value="Salary">{t('Salary', 'Salario')}</option>
            <option value="Freelance">{t('Freelance', 'Freelance')}</option>
            <option value="Interest">{t('Interest', 'Interés')}</option>
            <option value="Other">{t('Other', 'Otro')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Description', 'Descripción')}</label>
          <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder={t('e.g., Client payment', 'p.ej., Pago de cliente')} className="mt-1 w-full p-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-xs text-gray-500">{t('Week', 'Semana')}</label>
          <select value={weekSelect} onChange={(e)=>setWeekSelect(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
            <option value="current">{t('Current', 'Actual')}</option>
            <option value="wk1">{t('Wk1', 'Sem1')}</option>
            <option value="wk2">{t('Wk2', 'Sem2')}</option>
            <option value="wk3">{t('Wk3', 'Sem3')}</option>
            <option value="wk4">{t('Wk4', 'Sem4')}</option>
            <option value="wk5">{t('Wk5', 'Sem5')}</option>
          </select>
        </div>
      </div>

      {weekSelect && weekSelect !== 'current' && (
        <div className="mt-4">
          <label className="block text-xs text-gray-500">{t('Optional: Pick a specific date within this week', 'Opcional: Elige una fecha específica en esta semana')}</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e)=>setDate(e.target.value)} 
            className="mt-1 w-full max-w-xs p-2 border rounded-lg" 
          />
        </div>
      )}

      {error && <div className="text-sm text-red-500 mt-3">{error}</div>}

      <div className="mt-4 text-right">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
          {loading ? t('Saving...', 'Guardando...') : t('Add Income', 'Agregar Ingreso')}
        </button>
      </div>
    </form>
  );
}
