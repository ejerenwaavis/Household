import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const fmt = (n) => `$${(Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/**
 * Shows pending payment suggestions (bank statement rows that look like CC payments).
 * The user can confirm (creates a DebtPayment) or dismiss each one.
 */
export default function PaymentSuggestionsWidget({ householdId, onConfirmed }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(null); // id of suggestion being actioned

  const fetchSuggestions = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const res = await api.get(`/payment-suggestions/${householdId}?status=pending`);
      setSuggestions(res.data.suggestions || []);
    } catch {
      // silent — widget is supplementary
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // Re-fetch when parent notifies a new import happened
  useEffect(() => {
    if (onConfirmed) fetchSuggestions();
  }, [onConfirmed, fetchSuggestions]);

  const handle = async (id, action) => {
    setActing(id);
    try {
      await api.patch(`/payment-suggestions/${householdId}/${id}/${action}`);
      setSuggestions(prev => prev.filter(s => s._id !== id));
      if (action === 'confirm' && onConfirmed) onConfirmed();
    } catch (err) {
      alert(err?.response?.data?.error || `Failed to ${action} suggestion`);
    } finally {
      setActing(null);
    }
  };

  if (loading && suggestions.length === 0) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {suggestions.length} potential credit card payment{suggestions.length !== 1 ? 's' : ''} detected
        </p>
      </div>

      <div className="space-y-2">
        {suggestions.map(s => (
          <div
            key={s._id}
            className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-800"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.cardName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.description}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{s.date} · {s.month}</p>
            </div>
            <div className="text-sm font-bold text-red-600 dark:text-red-400 flex-shrink-0">
              {fmt(s.amount)}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => handle(s._id, 'confirm')}
                disabled={acting === s._id}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {acting === s._id ? '…' : 'Confirm'}
              </button>
              <button
                onClick={() => handle(s._id, 'reject')}
                disabled={acting === s._id}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
        Confirming will record this as a debt payment and update the card balance.
      </p>
    </div>
  );
}
