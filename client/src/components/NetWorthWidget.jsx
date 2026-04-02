import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const fmtCurrency = (value) => `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function NetWorthWidget() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assets: { checkingAndSavings: '', investments: '', realEstate: '', vehicles: '', other: '' },
    liabilities: { creditCards: '', studentLoans: '', mortgage: '', carLoans: '', other: '' },
    notes: '',
  });

  const fetchSnapshots = useCallback(async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      const res = await api.get(`/households/${user.householdId}/net-worth`);
      setSnapshots(res.data.snapshots || []);
    } catch {
      // silently fail — widget is optional
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => { fetchSnapshots(); }, [fetchSnapshots]);

  const latest = snapshots[snapshots.length - 1] || null;
  const previous = snapshots[snapshots.length - 2] || null;
  const trend = latest && previous ? latest.netWorth - previous.netWorth : null;

  const handleFormChange = (section, field, value) => {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.householdId) return;
    setSaving(true);
    try {
      const payload = {
        assets: Object.fromEntries(Object.entries(form.assets).map(([k, v]) => [k, Number(v) || 0])),
        liabilities: Object.fromEntries(Object.entries(form.liabilities).map(([k, v]) => [k, Number(v) || 0])),
        notes: form.notes,
      };
      await api.post(`/households/${user.householdId}/net-worth`, payload);
      setShowForm(false);
      await fetchSnapshots();
    } catch (err) {
      console.error('[NetWorthWidget] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Simple SVG sparkline from snapshot data
  const sparkline = (() => {
    if (snapshots.length < 2) return null;
    const values = snapshots.map((s) => s.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const W = 200;
    const H = 50;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x},${y}`;
    });
    return points.join(' ');
  })();

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white dark:bg-gray-800 dark:border-indigo-900/30 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Net Worth</h3>
          {latest && (
            <p className="text-2xl font-bold mt-1" style={{ color: latest.netWorth >= 0 ? '#16a34a' : '#dc2626' }}>
              {fmtCurrency(latest.netWorth)}
            </p>
          )}
          {trend !== null && (
            <p className={`text-xs mt-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '▲' : '▼'} {fmtCurrency(Math.abs(trend))} vs last month
            </p>
          )}
          {!latest && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No data yet — record your first snapshot.</p>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 shrink-0"
        >
          {showForm ? 'Cancel' : 'Update'}
        </button>
      </div>

      {/* Sparkline chart */}
      {sparkline && (
        <div className="mb-4">
          <svg width="100%" height="50" viewBox="0 0 200 50" preserveAspectRatio="none">
            <polyline
              points={sparkline}
              fill="none"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{snapshots[0]?.month}</span>
            <span>{snapshots[snapshots.length - 1]?.month}</span>
          </div>
        </div>
      )}

      {/* Asset/Liability summary */}
      {latest && !showForm && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-green-50 dark:bg-green-900/10 p-2.5">
            <p className="text-green-700 dark:text-green-400 font-medium">Assets</p>
            <p className="text-green-900 dark:text-green-300 font-bold text-sm mt-0.5">{fmtCurrency(latest.totalAssets)}</p>
          </div>
          <div className="rounded-lg bg-red-50 dark:bg-red-900/10 p-2.5">
            <p className="text-red-700 dark:text-red-400 font-medium">Liabilities</p>
            <p className="text-red-900 dark:text-red-300 font-bold text-sm mt-0.5">{fmtCurrency(latest.totalLiabilities)}</p>
          </div>
        </div>
      )}

      {/* Update Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1.5">Assets</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(form.assets).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.assets[field]}
                    onChange={(e) => handleFormChange('assets', field, e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1.5">Liabilities</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(form.liabilities).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.liabilities[field]}
                    onChange={(e) => handleFormChange('liabilities', field, e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. included new investment account"
              className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Snapshot'}
          </button>
        </form>
      )}
    </div>
  );
}
