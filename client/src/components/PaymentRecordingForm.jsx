import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

/**
 * PaymentRecordingForm
 * Records a payment against an overspend project for a specific week.
 *
 * Props:
 *   project     {object}  — OverspendProject record
 *   onSuccess   {fn(proj)} — called with updated project on success
 *   onCancel    {fn}       — called when user cancels
 */
export default function PaymentRecordingForm({ project, onSuccess, onCancel }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(String(project?.weeklyContribution || ''));
  const [week, setWeek] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!project) return null;

  const remaining = project.memberResponsibilityAmount - project.totalCollected;
  const paidWeeks = (project.payments || []).map((p) => p.week);
  const unpaidWeeks = Array.from({ length: project.weekCount || 4 }, (_, i) => i + 1)
    .filter((w) => !paidWeeks.includes(w));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(
        `/credit-card-statements/${project.householdId}/overspend-projects/${project._id}/payments`,
        {
          amount: Number(amount),
          week: week ? Number(week) : undefined,
          notes,
          date,
        }
      );
      onSuccess && onSuccess(res.data.project);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
      setConfirmed(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Project context strip */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">{project.memberName}</p>
        <div className="flex gap-4 mt-1 text-xs text-blue-700 dark:text-blue-400">
          <span>Remaining: <strong>${remaining.toFixed(2)}</strong></span>
          <span>Weekly: <strong>${Number(project.weeklyContribution || 0).toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Payment Amount <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={remaining + 0.01}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setConfirmed(false); }}
            required
            className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Week */}
      {unpaidWeeks.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Which Week
          </label>
          <select
            value={week}
            onChange={(e) => { setWeek(e.target.value); setConfirmed(false); }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">— Select week (optional)</option>
            {unpaidWeeks.map((w) => (
              <option key={w} value={w}>
                Week {w} — ${Number(project.weeklyContribution || 0).toFixed(2)} expected
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setConfirmed(false); }}
          className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Zelle payment sent"
          className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Confirm strip */}
      {confirmed && !error && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-xl px-3 py-2 text-xs text-green-800 dark:text-green-300">
          You're about to record <strong>${Number(amount).toFixed(2)}</strong> for {project.memberName}
          {week ? ` (Week ${week})` : ''}. Click "Record Payment" again to confirm.
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-sm px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? 'Saving...' : confirmed ? 'Record Payment' : 'Review Payment'}
        </button>
      </div>
    </form>
  );
}
