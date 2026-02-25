import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function DebtPaymentForm({ householdId, creditCards, statements, onSuccess }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    cardId: '',
    cardStatementId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    amountPaid: 0,
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amountPaid' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.cardId) {
      alert(t('Please select a credit card', 'Por favor selecciona una tarjeta'));
      return;
    }

    if (!formData.paymentDate) {
      alert(t('Payment date is required', 'La fecha de pago es obligatoria'));
      return;
    }

    if (formData.amountPaid <= 0) {
      alert(t('Amount must be greater than 0', 'La cantidad debe ser mayor que 0'));
      return;
    }

    try {
      await api.post(`/debt-payments/${householdId}`, formData);
      
      // Reset form
      setFormData({
        cardId: '',
        cardStatementId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        amountPaid: 0,
        notes: ''
      });
      
      onSuccess && onSuccess();
    } catch (error) {
      console.error('[DebtPaymentForm] Error:', error);
      alert(error.response?.data?.error || t('Failed to create payment', 'Error al crear pago'));
    }
  };

  // Filter statements by selected card
  const filteredStatements = formData.cardId 
    ? statements.filter(s => s.cardId?._id === formData.cardId || s.cardId === formData.cardId)
    : [];

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {t('Record Debt Payment', 'Registrar Pago de Deuda')}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Credit Card */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Credit Card', 'Tarjeta de Crédito')} *
          </label>
          <select
            name="cardId"
            value={formData.cardId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          >
            <option value="">{t('Select a card', 'Selecciona una tarjeta')}</option>
            {creditCards.map(card => (
              <option key={card._id} value={card._id}>
                {card.cardName} - {card.holder} (${card.currentBalance.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Payment Date', 'Fecha de Pago')} *
          </label>
          <input
            type="date"
            name="paymentDate"
            value={formData.paymentDate}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Amount Paid */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Amount Paid', 'Cantidad Pagada')} *
          </label>
          <input
            type="number"
            name="amountPaid"
            value={formData.amountPaid}
            onChange={handleChange}
            step="0.01"
            min="0"
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Statement (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Link to Statement (Optional)', 'Vincular a Estado (Opcional)')}
          </label>
          <select
            name="cardStatementId"
            value={formData.cardStatementId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">{t('None', 'Ninguno')}</option>
            {filteredStatements.map(stmt => (
              <option key={stmt._id} value={stmt._id}>
                {stmt.statementName} (${stmt.currentBalance.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Notes (Optional)', 'Notas (Opcional)')}
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            placeholder={t('Any additional notes...', 'Notas adicionales...')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6">
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          {t('Record Payment', 'Registrar Pago')}
        </button>
      </div>
    </form>
  );
}
