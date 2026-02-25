import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function EditDebtPaymentModal({ payment, creditCards, statements, onSave, onClose }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    cardId: payment.cardId?._id || payment.cardId || '',
    cardStatementId: payment.cardStatementId?._id || payment.cardStatementId || '',
    paymentDate: payment.paymentDate ? payment.paymentDate.split('T')[0] : '',
    amountPaid: payment.amountPaid || 0,
    notes: payment.notes || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amountPaid' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
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

    onSave(formData);
  };

  // Filter statements by selected card
  const filteredStatements = formData.cardId 
    ? statements.filter(s => s.cardId?._id === formData.cardId || s.cardId === formData.cardId)
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t('Edit Debt Payment', 'Editar Pago de Deuda')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Credit Card */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Credit Card', 'Tarjeta de Crédito')} *
            </label>
            <select
              name="cardId"
              value={formData.cardId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">{t('Select a card', 'Selecciona una tarjeta')}</option>
              {creditCards.map(card => (
                <option key={card._id} value={card._id}>
                  {card.cardName} - {card.holder}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Payment Date', 'Fecha de Pago')} *
            </label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Amount Paid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Amount Paid', 'Cantidad Pagada')} *
            </label>
            <input
              type="number"
              name="amountPaid"
              value={formData.amountPaid}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Statement (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Link to Statement (Optional)', 'Vincular a Estado (Opcional)')}
            </label>
            <select
              name="cardStatementId"
              value={formData.cardStatementId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('None', 'Ninguno')}</option>
              {filteredStatements.map(stmt => (
                <option key={stmt._id} value={stmt._id}>
                  {stmt.statementName}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Notes (Optional)', 'Notas (Opcional)')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 dark:bg-indigo-700 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-800 transition"
            >
              {t('Save Changes', 'Guardar Cambios')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition"
            >
              {t('Cancel', 'Cancelar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
