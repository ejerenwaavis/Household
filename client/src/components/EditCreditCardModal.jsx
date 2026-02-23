import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function EditCreditCardModal({ card, onSave, onClose }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    cardName: card.cardName || '',
    holder: card.holder || '',
    originalBalance: card.originalBalance || 0,
    currentBalance: card.currentBalance || 0,
    minPayment: card.minPayment || 0,
    plannedExtraPayment: card.plannedExtraPayment || 0,
    interestRate: card.interestRate || 0,
    creditLimit: card.creditLimit || 0,
    dueDay: card.dueDay || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'cardName' || name === 'holder' || name === 'dueDay' ? value : parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.cardName.trim()) {
      alert(t('Card name is required', 'El nombre de la tarjeta es obligatorio'));
      return;
    }

    if (!formData.holder.trim()) {
      alert(t('Cardholder name is required', 'El nombre del titular es obligatorio'));
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('Edit Credit Card', 'Editar Tarjeta de Crédito')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Card Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Card Name', 'Nombre de la Tarjeta')} *
            </label>
            <input
              type="text"
              name="cardName"
              value={formData.cardName}
              onChange={handleChange}
              placeholder={t('e.g., Chase Sapphire', 'ej., Chase Sapphire')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Cardholder */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Cardholder', 'Titular')} *
            </label>
            <input
              type="text"
              name="holder"
              value={formData.holder}
              onChange={handleChange}
              placeholder={t('e.g., Maria', 'ej., Maria')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Original Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Original Balance', 'Balance Original')} *
            </label>
            <input
              type="number"
              name="originalBalance"
              value={formData.originalBalance}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Current Balance', 'Balance Actual')} *
            </label>
            <input
              type="number"
              name="currentBalance"
              value={formData.currentBalance}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Min Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Minimum Payment', 'Pago Mínimo')}
            </label>
            <input
              type="number"
              name="minPayment"
              value={formData.minPayment}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Extra Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Planned Extra Payment', 'Pago Extra Planificado')}
            </label>
            <input
              type="number"
              name="plannedExtraPayment"
              value={formData.plannedExtraPayment}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Interest Rate (APR %)', 'Tasa de Interés (APR %)')}
            </label>
            <input
              type="number"
              name="interestRate"
              value={formData.interestRate}
              onChange={handleChange}
              step="0.01"
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Credit Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Credit Limit', 'Límite de Crédito')}
            </label>
            <input
              type="number"
              name="creditLimit"
              value={formData.creditLimit}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Due Day */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              {t('Payment Due Day', 'Día de Vencimiento')}
            </label>
            <input
              type="number"
              name="dueDay"
              value={formData.dueDay}
              onChange={handleChange}
              min="1"
              max="31"
              placeholder={t('1-31', '1-31')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
