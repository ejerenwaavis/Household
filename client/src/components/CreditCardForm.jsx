import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function CreditCardForm({ householdId, onSuccess }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    cardName: '',
    holder: '',
    originalBalance: '',
    currentBalance: '',
    minPayment: '',
    plannedExtraPayment: '',
    interestRate: '',
    creditLimit: '',
    dueDay: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!householdId) return;

    setLoading(true);
    try {
      await api.post(`/credit-cards/${householdId}`, {
        ...form,
        originalBalance: parseFloat(form.originalBalance) || 0,
        currentBalance: parseFloat(form.currentBalance) || 0,
        minPayment: parseFloat(form.minPayment) || 0,
        plannedExtraPayment: parseFloat(form.plannedExtraPayment) || 0,
        interestRate: parseFloat(form.interestRate) || 0,
        creditLimit: parseFloat(form.creditLimit) || 0,
        dueDay: parseInt(form.dueDay) || null
      });
      
      setForm({
        cardName: '',
        holder: '',
        originalBalance: '',
        currentBalance: '',
        minPayment: '',
        plannedExtraPayment: '',
        interestRate: '',
        creditLimit: '',
        dueDay: ''
      });
      
      onSuccess && onSuccess();
    } catch (error) {
      console.error('[CreditCardForm] Error:', error);
      alert(error.response?.data?.error || t('Failed to add card', 'Error al agregar tarjeta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {t('Add Credit Card', 'Agregar Tarjeta de Crédito')}
      </h3>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Card Name', 'Nombre de Tarjeta')} *
          </label>
          <input
            type="text"
            name="cardName"
            value={form.cardName}
            onChange={handleChange}
            placeholder="Chase Sapphire"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Card Holder', 'Titular')} *
          </label>
          <input
            type="text"
            name="holder"
            value={form.holder}
            onChange={handleChange}
            placeholder="Maria"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Original Balance', 'Balance Original')} *
          </label>
          <input
            type="number"
            step="0.01"
            name="originalBalance"
            value={form.originalBalance}
            onChange={handleChange}
            placeholder="5000.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Current Balance', 'Balance Actual')} *
          </label>
          <input
            type="number"
            step="0.01"
            name="currentBalance"
            value={form.currentBalance}
            onChange={handleChange}
            placeholder="4393.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Minimum Payment', 'Pago Mínimo')}
          </label>
          <input
            type="number"
            step="0.01"
            name="minPayment"
            value={form.minPayment}
            onChange={handleChange}
            placeholder="50.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Planned Extra Payment', 'Pago Extra Planeado')}
          </label>
          <input
            type="number"
            step="0.01"
            name="plannedExtraPayment"
            value={form.plannedExtraPayment}
            onChange={handleChange}
            placeholder="200.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Interest Rate (APR %)', 'Tasa de Interés (APR %)')}
          </label>
          <input
            type="number"
            step="0.01"
            name="interestRate"
            value={form.interestRate}
            onChange={handleChange}
            placeholder="18.99"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Credit Limit', 'Límite de Crédito')}
          </label>
          <input
            type="number"
            step="0.01"
            name="creditLimit"
            value={form.creditLimit}
            onChange={handleChange}
            placeholder="10000.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('Due Day of Month', 'Día de Vencimiento')}
          </label>
          <input
            type="number"
            min="1"
            max="31"
            name="dueDay"
            value={form.dueDay}
            onChange={handleChange}
            placeholder="15"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('Adding...', 'Agregando...') : t('Add Card', 'Agregar Tarjeta')}
          </button>
        </div>
      </form>
    </div>
  );
}
