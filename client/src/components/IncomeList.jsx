import React from 'react';
import api from '../services/api';

export default function IncomeList({ householdId, entries = [], loading = false, refresh }){
  console.log('[IncomeList] render entries count:', entries.length, 'loading:', loading, 'householdId:', householdId);

  const handleDelete = async (entry) => {
    const id = entry._id || entry.id;
    if (!id) return console.error('[IncomeList] missing id for delete');
    if (!householdId) return console.error('[IncomeList] missing householdId for delete');
    if (!window.confirm('Delete this income entry?')) return;
    try {
      console.log('[IncomeList] deleting', { id, householdId });
      await api.delete(`/income/${householdId}/${id}`);
      console.log('[IncomeList] delete success', id);
      refresh && refresh();
    } catch (err) {
      console.error('[IncomeList] delete error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = async (entry) => {
    const id = entry._id || entry.id;
    if (!id) return console.error('[IncomeList] missing id for edit');
    if (!householdId) return console.error('[IncomeList] missing householdId for edit');

    const currentAmount = (typeof entry.amount === 'number') ? entry.amount : (Array.isArray(entry.dailyBreakdown) && entry.dailyBreakdown[0]?.amount) || '';
    const newAmount = window.prompt('New amount (leave blank to keep)', String(currentAmount));
    if (newAmount === null) return; // cancelled
    const newDesc = window.prompt('New description (leave blank to keep)', entry.description || (Array.isArray(entry.dailyBreakdown) && entry.dailyBreakdown[0]?.description) || '');

    const payload = {};
    if (newAmount !== '' && newAmount !== null) payload.amount = Number(newAmount);
    if (newDesc !== null) payload.description = newDesc;

    try {
      console.log('[IncomeList] patching', { id, householdId, payload });
      const res = await api.patch(`/income/${householdId}/${id}`, payload);
      console.log('[IncomeList] patch response', res && res.data);
      refresh && refresh();
    } catch (err) {
      console.error('[IncomeList] patch error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to update');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-gray-500">No income entries yet.</div>
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

            // Determine source and date from various shapes
            const sourceText = e.source || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.source) || 'Manual';
            const dateText = e.date || (Array.isArray(e.dailyBreakdown) && e.dailyBreakdown[0]?.date) || null;

            return (
              <li key={key} className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-700">{sourceText}</div>
                  <div className="text-xs text-gray-400">{e.description || ''} {dateText ? `• ${new Date(dateText).toLocaleString()}` : ''}</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-semibold text-gray-800">${Number(amountVal || 0).toFixed(2)}</div>
                  <button onClick={()=>handleEdit(e)} className="text-sm text-indigo-600">Edit</button>
                  <button onClick={()=>handleDelete(e)} className="text-sm text-red-600">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 text-right">
        <button onClick={() => { console.log('[IncomeList] refresh clicked'); refresh && refresh(); }} className="text-sm text-indigo-600">Refresh</button>
      </div>
    </div>
  );
}
