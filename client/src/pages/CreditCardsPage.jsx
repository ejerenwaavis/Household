import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import Layout from '../components/Layout';
import CreditCardForm from '../components/CreditCardForm';
import CreditCardList from '../components/CreditCardList';
import api from '../services/api';
import { exportCreditCards } from '../services/exportService';
import SkeletonBlock from '../components/SkeletonBlock';

export default function CreditCardsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [knownBanks, setKnownBanks] = useState([]);

  const fetchCards = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      setLoading(true);
      const [cardsRes, bankTxnRes] = await Promise.all([
        api.get(`/credit-cards/${user.householdId}`),
        api.get(`/bank-transactions/${user.householdId}?limit=500`).catch(() => ({ data: { transactions: [] } })),
      ]);
      setCards(cardsRes.data.cards || []);
      setSummary(cardsRes.data.summary || {});
      // Derive distinct bank names from saved transactions for the linked-bank dropdown
      const banks = [...new Set(
        (bankTxnRes.data.transactions || []).map(t => t.bank).filter(Boolean)
      )].sort();
      setKnownBanks(banks);
    } catch (error) {
      console.error('[CreditCards] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCardAdded = () => {
    setShowForm(false);
    fetchCards();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {(() => {
          const hasSyncedCards = (summary?.syncedCardCount || 0) > 0;

          return (
            <>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('Credit Cards', 'Tarjetas de Crédito')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t('Track and manage credit card debt', 'Rastrea y gestiona deuda de tarjetas')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportCreditCards(cards, summary)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Download as CSV"
            >
              {t('Export', 'Exportar')}
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showForm ? t('Cancel', 'Cancelar') : t('+ Add Card', '+ Agregar Tarjeta')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                  <SkeletonBlock className="h-3 w-24 rounded mb-3" />
                  <SkeletonBlock className="h-7 w-32 rounded" />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                  <SkeletonBlock className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-40 rounded" />
                    <SkeletonBlock className="h-3 w-24 rounded" />
                  </div>
                  <SkeletonBlock className="h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('Total Debt', 'Deuda Total')}</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">${summary.totalDebt?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {hasSyncedCards ? t('Available Credit', 'Crédito Disponible') : t('Original Balance', 'Balance Original')}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    ${hasSyncedCards ? (summary.totalAvailableCredit?.toFixed(2) || '0.00') : (summary.totalOriginal?.toFixed(2) || '0.00')}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {hasSyncedCards ? t('Credit Limit', 'Límite de Crédito') : t('Amount Paid', 'Pagado')}
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${hasSyncedCards ? (summary.totalCreditLimit?.toFixed(2) || '0.00') : (summary.totalPaid?.toFixed(2) || '0.00')}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {hasSyncedCards ? t('Utilization', 'Utilización') : t('Progress', 'Progreso')}
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {hasSyncedCards ? (summary.overallUtilization || 0) : (summary.overallProgress || 0)}%
                  </div>
                </div>
              </div>
            )}

            {hasSyncedCards && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                Synced Plaid credit accounts now appear here automatically. Manual credit cards can still be added for accounts not linked through Plaid.
              </div>
            )}

            {/* Add Card Form */}
            {showForm && (
              <div className="mb-6">
                <CreditCardForm
                  householdId={user?.householdId}
                  onSuccess={handleCardAdded}
                  knownBanks={knownBanks}
                />
              </div>
            )}

            {/* Cards List */}
            <CreditCardList
              cards={cards}
              loading={loading}
              onUpdate={fetchCards}
              householdId={user?.householdId}
            />
          </>
        )}
            </>
          );
        })()}
      </div>
    </Layout>
  );
}
