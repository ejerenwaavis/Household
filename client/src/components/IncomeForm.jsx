import React, { useState } from 'react';
import api from '../services/api';

export default function IncomeForm({ householdId, onCreated }){
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('Salary');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [weekSelect, setWeekSelect] = useState('current');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => { setAmount(''); setSource('Salary'); setDescription(''); setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!householdId) return setError('No household selected');
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount');

    setLoading(true);
    try {
      const payload = { amount: Number(amount), source, description };

      // If user selected a specific date, include it. If they selected a week choice, include 'week' (1-5 or 'current')
      // If a specific date is provided, include it. Otherwise include week indicator.
      if (weekSelect && weekSelect !== 'current') {
        // user selected a previous week; allow optional date within that week
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

      // backend returns { id, income }
      const created = res.data.income || { id: res.data.id, ...payload };
      if (onCreated) onCreated(created);
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-gray-500">Week (optional)</label>
        <select value={weekSelect} onChange={(e)=>{ setWeekSelect(e.target.value); /* do not auto-clear date; only show date when previous week selected */ }} className="mt-1 p-2 border rounded-lg">
        <div>
          <label className="block text-xs text-gray-500">Amount</label>
          <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0.00" className="mt-1 w-full p-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-xs text-gray-500">Source</label>
        {weekSelect && weekSelect !== 'current' && (
          <div className="mt-2">
            <label className="block text-xs text-gray-500">Optional date (pick a date within the selected week)</label>
            <input type="date" value={date} onChange={(e)=>{ setDate(e.target.value); }} className="mt-1 w-full p-2 border rounded-lg" />
          </div>
        )}
        </div>

        <div>
          <label className="block text-xs text-gray-500">Description (optional)</label>
          <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="e.g., Client payment" className="mt-1 w-full p-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-xs text-gray-500">Assign to date (optional)</label>
          <input type="date" value={date} onChange={(e)=>{ setDate(e.target.value); if (e.target.value) setWeekSelect('current'); }} className="mt-1 w-full p-2 border rounded-lg" />
          <div className="text-xs text-gray-400 mt-1">Or pick a week below</div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-gray-500">Week (optional)</label>
        <select value={weekSelect} onChange={(e)=>{ setWeekSelect(e.target.value); if (e.target.value !== 'current') setDate(''); }} className="mt-1 p-2 border rounded-lg">
          <option value="current">Current</option>
          <option value="wk1">Wk1</option>
          <option value="wk2">Wk2</option>
          <option value="wk3">Wk3</option>
          <option value="wk4">Wk4</option>
          <option value="wk5">Wk5</option>
        </select>
      </div>

      {error && <div className="text-sm text-red-500 mt-3">{error}</div>}

      <div className="mt-4 text-right">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
          {loading ? 'Saving...' : 'Add Income'}
        </button>
      </div>
    </form>
  );
}
