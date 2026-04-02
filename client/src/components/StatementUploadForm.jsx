import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

/**
 * StatementUploadForm — manager-only form to submit a credit card statement
 * with charges attributed to household members.
 *
 * Props:
 *   onSuccess {fn(result)} — called after successful statement submission + processing
 *   onCancel  {fn}
 */
export default function StatementUploadForm({ onSuccess, onCancel }) {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [members, setMembers] = useState([]);
  const [cardId, setCardId] = useState('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [charges, setCharges] = useState([{ memberId: '', memberName: '', amount: '', description: '' }]);
  const [step, setStep] = useState('form'); // 'form' | 'preview' | 'success'
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user?.householdId) return;
      try {
        const [cardsRes, householdRes] = await Promise.all([
          api.get(`/credit-cards/${user.householdId}`),
          api.get(`/households/${user.householdId}`),
        ]);
        setCards(cardsRes.data?.cards || []);
        setMembers(householdRes.data?.members || []);
      } catch (_) {}
      setLoadingData(false);
    };
    init();
  }, [user?.householdId]);

  const addCharge = () => {
    setCharges((prev) => [...prev, { memberId: '', memberName: '', amount: '', description: '' }]);
  };

  const removeCharge = (idx) => {
    setCharges((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCharge = (idx, field, value) => {
    setCharges((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-fill memberName when memberId changes
      if (field === 'memberId') {
        const member = members.find((m) => m.userId === value);
        if (member) updated[idx].memberName = member.name;
      }
      return updated;
    });
  };

  const totalAmount = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validCharges = charges.filter((c) => c.memberId && Number(c.amount) > 0);
    if (!cardId) return setError('Please select a credit card');
    if (validCharges.length === 0) return setError('Add at least one charge with a member and amount');

    if (step === 'form') {
      setStep('preview');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Submit statement
      const stmtRes = await api.post(`/credit-card-statements/${user.householdId}/statements`, {
        cardId,
        statementDate,
        charges: validCharges.map((c) => ({
          memberId: c.memberId,
          memberName: c.memberName,
          amount: Number(c.amount),
          description: c.description || 'Credit card charge',
        })),
      });
      const statementId = stmtRes.data?.statement?._id;

      // 2. Process statement (triggers overspend detection)
      const processRes = await api.post(
        `/credit-card-statements/${user.householdId}/statements/${statementId}/process`
      );

      setResult(processRes.data);
      setStep('success');
      onSuccess && onSuccess(processRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit statement');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
    );
  }

  if (step === 'success' && result) {
    const overspendCount = result.overspends?.length || 0;
    const projectCount = result.projects?.length || 0;
    return (
      <div className="py-6 text-center space-y-3">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Statement Submitted</h3>
        {overspendCount > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            ⚠️ {overspendCount} overspend{overspendCount > 1 ? 's' : ''} detected
            {projectCount > 0 && ` · ${projectCount} accountability project${projectCount > 1 ? 's' : ''} created`}
          </div>
        )}
        {overspendCount === 0 && (
          <p className="text-sm text-green-700 dark:text-green-400">No overspends detected.</p>
        )}
        <button
          onClick={onCancel}
          className="px-5 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  if (step === 'preview') {
    const validCharges = charges.filter((c) => c.memberId && Number(c.amount) > 0);
    const card = cards.find((c) => String(c._id) === cardId);
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">Review before submitting</p>
          <div className="space-y-1 text-xs text-blue-700 dark:text-blue-400">
            <p><strong>Card:</strong> {card?.cardName || 'Unknown'}</p>
            <p><strong>Statement Date:</strong> {statementDate}</p>
            <p><strong>Total:</strong> ${totalAmount.toFixed(2)}</p>
          </div>
        </div>
        <div className="space-y-2">
          {validCharges.map((c, i) => (
            <div key={i} className="flex justify-between text-sm px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">{c.memberName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.description || 'No description'}</p>
              </div>
              <p className="font-bold text-gray-900 dark:text-white">${Number(c.amount).toFixed(2)}</p>
            </div>
          ))}
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('form')}
            className="flex-1 text-sm px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ← Edit
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 text-sm px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Submitting...' : 'Submit & Process'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Credit Card <span className="text-red-500">*</span>
        </label>
        <select
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          required
          className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">— Select card</option>
          {cards.map((card) => (
            <option key={String(card._id)} value={String(card._id)}>
              {card.cardName} {card.cardNumberLast4 ? `(•••• ${card.cardNumberLast4})` : ''}
            </option>
          ))}
        </select>
        {cards.length === 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            No credit cards found. <a href="/credit-cards" className="underline">Add a card first →</a>
          </p>
        )}
      </div>

      {/* Statement date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Statement Date</label>
        <input
          type="date"
          value={statementDate}
          onChange={(e) => setStatementDate(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Charges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Charges by Member <span className="text-red-500">*</span>
          </label>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Total: ${totalAmount.toFixed(2)}
          </span>
        </div>
        <div className="space-y-3">
          {charges.map((charge, idx) => (
            <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <select
                  value={charge.memberId}
                  onChange={(e) => updateCharge(idx, 'memberId', e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="">— Member</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={charge.amount}
                    onChange={(e) => updateCharge(idx, 'amount', e.target.value)}
                    className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                {charges.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCharge(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Description (optional)"
                value={charge.description}
                onChange={(e) => updateCharge(idx, 'description', e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCharge}
          className="mt-2 text-xs text-orange-600 dark:text-orange-400 hover:underline"
        >
          + Add another charge
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-1">
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
          className="flex-1 text-sm px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-sm"
        >
          Review Statement →
        </button>
      </div>
    </form>
  );
}
