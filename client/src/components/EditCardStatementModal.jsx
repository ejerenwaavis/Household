import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { extractMonth } from '../utils/dateUtils';

export default function EditCardStatementModal({ statement, creditCards, onSave, onClose }) {
  const { t } = useLanguage();
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    cardId: statement.cardId?._id || statement.cardId || '',
    statementName: statement.statementName || '',
    month: statement.month || '',
    statementDate: statement.statementDate ? statement.statementDate.split('T')[0] : '',
    statementBalance: statement.statementBalance || 0,
    currentBalance: statement.currentBalance || 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError(null); // Clear error when user makes changes
    
    // Auto-update month from statement date
    if (name === 'statementDate' && value) {
      const derivedMonth = extractMonth(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        month: derivedMonth
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: ['statementBalance', 'currentBalance'].includes(name) ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.cardId) {
      setError(t('Please select a credit card', 'Por favor selecciona una tarjeta'));
      return;
    }

    if (!formData.statementName.trim()) {
      setError(t('Statement name is required', 'El nombre del estado es obligatorio'));
      return;
    }

    if (!formData.statementDate) {
      setError(t('Statement date is required', 'La fecha del estado es obligatoria'));
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t('Edit Card Statement', 'Editar Estado de Tarjeta')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
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

          {/* Month - Auto-derived from Statement Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Month', 'Mes')} <span className="text-xs text-gray-500">{t('(auto-derived)', '(auto-derivado)')}</span>
            </label>
            <input
              type="month"
              name="month"
              value={formData.month}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
              title={t('Month is automatically calculated from the statement date', 'El mes se calcula automáticamente a partir de la fecha del estado')}
            />
          </div>

          {/* Statement Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Statement Name', 'Nombre del Estado')} *
            </label>
            <input
              type="text"
              name="statementName"
              value={formData.statementName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Statement Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Statement Date', 'Fecha del Estado')} *
            </label>
            <input
              type="date"
              name="statementDate"
              value={formData.statementDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Statement Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Statement Balance', 'Balance del Estado')} *
            </label>
            <input
              type="number"
              name="statementBalance"
              value={formData.statementBalance}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('Current Balance', 'Balance Actual')} *
            </label>
            <input
              type="number"
              name="currentBalance"
              value={formData.currentBalance}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              required
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
