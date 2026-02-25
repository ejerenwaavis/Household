import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import EditCreditCardModal from './EditCreditCardModal';
import api from '../services/api';

export default function CreditCardList({ cards, loading, onUpdate, householdId }) {
  const { t } = useLanguage();
  const [editingCard, setEditingCard] = useState(null);

  const handleDelete = async (card) => {
    if (!window.confirm(t(`Delete "${card.cardName}"?`, `¿Eliminar "${card.cardName}"?`))) {
      return;
    }

    try {
      await api.delete(`/credit-cards/${householdId}/${card._id}`);
      onUpdate && onUpdate();
    } catch (error) {
      console.error('[CreditCardList] Delete error:', error);
      alert(error.response?.data?.error || t('Failed to delete card', 'Error al eliminar tarjeta'));
    }
  };

  const handleSaveEdit = async (updates) => {
    if (!editingCard) return;

    try {
      await api.patch(`/credit-cards/${householdId}/${editingCard._id}`, updates);
      setEditingCard(null);
      onUpdate && onUpdate();
    } catch (error) {
      console.error('[CreditCardList] Update error:', error);
      alert(error.response?.data?.error || t('Failed to update card', 'Error al actualizar tarjeta'));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
        <p className="text-gray-600 mt-4">{t('Loading...', 'Cargando...')}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="text-6xl mb-4">💳</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {t('No Credit Cards Yet', 'Sin Tarjetas de Crédito')}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {t('Add your first credit card to start tracking debt', 'Agrega tu primera tarjeta para rastrear deuda')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {cards.map((card) => {
          const payoffPercent = card.payoffPercent || 0;
          const remainingDebt = card.currentBalance || 0;
          const totalPaid = (card.originalBalance || 0) - remainingDebt;

          return (
            <div
              key={card._id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-800">{card.cardName}</h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                      {card.holder}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">{t('Current Balance', 'Balance Actual')}</div>
                      <div className="text-lg font-bold text-red-600">${remainingDebt.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">{t('Original', 'Original')}</div>
                      <div className="text-lg font-semibold text-gray-700">${(card.originalBalance || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">{t('Paid Off', 'Pagado')}</div>
                      <div className="text-lg font-semibold text-green-600">${totalPaid.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">{t('Min Payment', 'Pago Mín.')}</div>
                      <div className="text-lg font-semibold text-gray-700">${(card.minPayment || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setEditingCard(card)}
                    className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    {t('Edit', 'Editar')}
                  </button>
                  <button
                    onClick={() => handleDelete(card)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    {t('Delete', 'Eliminar')}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{t('Payoff Progress', 'Progreso de Pago')}</span>
                  <span className="font-semibold text-indigo-600">{payoffPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                    style={{ width: `${Math.min(100, payoffPercent)}%` }}
                  />
                </div>
              </div>

              {/* Additional Info */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                {card.interestRate > 0 && (
                  <div>
                    <span className="font-medium">{t('APR', 'APR')}:</span> {card.interestRate}%
                  </div>
                )}
                {card.plannedExtraPayment > 0 && (
                  <div>
                    <span className="font-medium">{t('Extra Payment', 'Pago Extra')}:</span> ${card.plannedExtraPayment.toFixed(2)}
                  </div>
                )}
                {card.creditLimit > 0 && (
                  <div>
                    <span className="font-medium">{t('Credit Limit', 'Límite')}:</span> ${card.creditLimit.toFixed(2)}
                  </div>
                )}
                {card.dueDay && (
                  <div>
                    <span className="font-medium">{t('Due Day', 'Día de Vencimiento')}:</span> {card.dueDay}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingCard && (
        <EditCreditCardModal
          card={editingCard}
          onSave={handleSaveEdit}
          onClose={() => setEditingCard(null)}
        />
      )}
    </>
  );
}
