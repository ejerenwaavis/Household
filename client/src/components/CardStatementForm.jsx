import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import { getCurrentMonthString, extractMonth } from '../utils/dateUtils';

export default function CardStatementForm({ householdId, creditCards, onSuccess }) {
  const { t } = useLanguage();
  const [duplicateError, setDuplicateError] = useState(null);

  const [formData, setFormData] = useState({
    cardId: '',
    statementName: '',
    month: getCurrentMonthString(),
    statementDate: '',
    statementBalance: 0,
    currentBalance: 0
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If statement date changes, auto-update the month field
    if (name === 'statementDate' && value) {
      const derivedMonth = extractMonth(value);
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        month: derivedMonth
      }));
      return;
    }
    
    // Auto-generate statement name when card is selected
    if (name === 'cardId' && value) {
      const selectedCard = creditCards.find(c => c._id === value);
      if (selectedCard && formData.month) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          statementName: `${selectedCard.cardName} - ${formData.month}`
        }));
        return;
      }
    }
    
    // Auto-generate statement name when month is selected
    if (name === 'month' && value) {
      const selectedCard = creditCards.find(c => c._id === formData.cardId);
      if (selectedCard) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          statementName: `${selectedCard.cardName} - ${value}`
        }));
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: ['statementBalance', 'currentBalance'].includes(name) ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.cardId) {
      alert(t('Please select a credit card', 'Por favor selecciona una tarjeta'));
      return;
    }

    if (!formData.statementName.trim()) {
      alert(t('Statement name is required', 'El nombre del estado es obligatorio'));
      return;
    }

    if (!formData.statementDate) {
      alert(t('Statement date is required', 'La fecha del estado es obligatoria'));
      return;
    }

    try {
      // Send form data - backend pre-save hook will ensure month matches statementDate
      await api.post(`/card-statements/${householdId}`, formData);
      
      // Reset form with current month
      setFormData({
        cardId: '',
        statementName: '',
        month: getCurrentMonthString(),
        statementDate: '',
        statementBalance: 0,
        currentBalance: 0
      });
      setDuplicateError(null);
      
      onSuccess && onSuccess();
    } catch (error) {
      console.error('[CardStatementForm] Error:', error);
      
      // Handle duplicate statement error
      if (error.response?.status === 409 && error.response?.data?.code === 'DUPLICATE_STATEMENT') {
        setDuplicateError(error.response.data);
      } else {
        alert(error.response?.data?.error || t('Failed to create statement', 'Error al crear estado'));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {t('Add Card Statement', 'Agregar Estado de Tarjeta')}
      </h2>
      
      {/* Duplicate Statement Error */}
      {duplicateError && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                {t('Statement Already Exists', 'La Declaración Ya Existe')}
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                {duplicateError.error}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Close error and open edit modal
                    setDuplicateError(null);
                    onSuccess && onSuccess(true); // Pass edit flag
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                >
                  {t('Edit Existing', 'Editar Existente')}
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateError(null)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 text-sm font-medium"
                >
                  {t('Cancel', 'Cancelar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                {card.cardName} - {card.holder}
              </option>
            ))}
          </select>
        </div>

        {/* Month - Auto-derived from Statement Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Month', 'Mes')} <span className="text-xs text-gray-500">{t('(auto-derived)', '(auto-derivado)')}</span>
          </label>
          <input
            type="month"
            name="month"
            value={formData.month}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            title={t('Month is automatically calculated from the statement date', 'El mes se calcula automáticamente a partir de la fecha del estado')}
          />
        </div>

        {/* Statement Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Statement Name', 'Nombre del Estado')} *
          </label>
          <input
            type="text"
            name="statementName"
            value={formData.statementName}
            onChange={handleChange}
            placeholder={t('e.g., Chase - 2024-01', 'ej., Chase - 2024-01')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Statement Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Statement Date', 'Fecha del Estado')} *
          </label>
          <input
            type="date"
            name="statementDate"
            value={formData.statementDate}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Statement Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Statement Balance', 'Balance del Estado')} *
          </label>
          <input
            type="number"
            name="statementBalance"
            value={formData.statementBalance}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>

        {/* Current Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Current Balance', 'Balance Actual')} *
          </label>
          <input
            type="number"
            name="currentBalance"
            value={formData.currentBalance}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6">
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          {t('Add Statement', 'Agregar Estado')}
        </button>
      </div>
    </form>
  );
}
