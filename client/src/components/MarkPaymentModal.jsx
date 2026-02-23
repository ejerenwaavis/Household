import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const METHODS = ['online', 'check', 'transfer', 'cash', 'other'];

const methodLabel = (t, m) =>
  t(m, m === 'online' ? 'En línea' : m === 'check' ? 'Cheque' : m === 'transfer' ? 'Transferencia' : m === 'cash' ? 'Efectivo' : 'Otro');

export default function MarkPaymentModal({ expense, onSave, onClose }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(expense?.amount || 0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('online');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        fixedExpenseId: expense._id || expense.id,
        amount: Number(amount),
        paymentDate,
        method,
        notes,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          {t('Mark as Paid: ', 'Marcar como pagado: ')}
          <span className="text-red-600">{expense?.name}</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500">{t('Amount', 'Monto')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Payment Date', 'Fecha de Pago')}</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">{t('Method', 'Método')}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full p-2 border rounded-lg">
              {METHODS.map((m) => (
                <option key={m} value={m}>{methodLabel(t, m)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">
              {t('Notes', 'Notas')} <span className="text-gray-400">({t('optional', 'opcional')})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('e.g., Confirmation #12345', 'p.ej., Confirmación #12345')}
              rows="2"
              className="mt-1 w-full p-2 border rounded-lg text-sm"
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
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {loading ? t('Saving...', 'Guardando...') : t('Confirm', 'Confirmar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
