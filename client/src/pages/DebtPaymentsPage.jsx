import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import Layout from '../components/Layout';
import DebtPaymentForm from '../components/DebtPaymentForm';
import EditDebtPaymentModal from '../components/EditDebtPaymentModal';
import api from '../services/api';
import { exportDebtPayments } from '../services/exportService';

export default function DebtPaymentsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [byMonth, setByMonth] = useState([]);
  const [summary, setSummary] = useState({});
  const [creditCards, setCreditCards] = useState([]);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const fetchPayments = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/debt-payments/${user.householdId}`);
      setPayments(response.data.payments || []);
      setByMonth(response.data.byMonth || []);
      setSummary(response.data.summary || {});
    } catch (error) {
      console.error('[DebtPayments] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  const fetchCreditCards = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      const response = await api.get(`/credit-cards/${user.householdId}`);
      setCreditCards(response.data.cards || []);
    } catch (error) {
      console.error('[DebtPayments] Error fetching cards:', error);
    }
  }, [user?.householdId]);

  const fetchStatements = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      const response = await api.get(`/card-statements/${user.householdId}`);
      setStatements(response.data.statements || []);
    } catch (error) {
      console.error('[DebtPayments] Error fetching statements:', error);
    }
  }, [user?.householdId]);

  useEffect(() => {
    fetchPayments();
    fetchCreditCards();
    fetchStatements();
  }, [fetchPayments, fetchCreditCards, fetchStatements]);

  const handlePaymentAdded = () => {
    setShowForm(false);
    fetchPayments();
    fetchCreditCards(); // Refresh card balances
    fetchStatements();  // Refresh statement balances
  };

  const handleEdit = (payment) => {
    setEditingPayment(payment);
  };

  const handleSaveEdit = async (updates) => {
    if (!editingPayment) return;

    try {
      await api.patch(
        `/debt-payments/${user.householdId}/${editingPayment._id}`,
        updates
      );
      setEditingPayment(null);
      fetchPayments();
      fetchCreditCards();
      fetchStatements();
    } catch (error) {
      console.error('[DebtPayments] Update error:', error);
      alert(error.response?.data?.error || t('Failed to update payment', 'Error al actualizar pago'));
    }
  };

  const handleDelete = async (payment) => {
    if (!window.confirm(t('Delete this payment?', '¿Eliminar este pago?'))) {
      return;
    }

    try {
      await api.delete(`/debt-payments/${user.householdId}/${payment._id}`);
      fetchPayments();
      fetchCreditCards();
      fetchStatements();
    } catch (error) {
      console.error('[DebtPayments] Delete error:', error);
      alert(error.response?.data?.error || t('Failed to delete payment', 'Error al eliminar pago'));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">{t('Loading...', 'Cargando...')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('Debt Payments', 'Pagos de Deuda')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t('Record and track credit card payments', 'Registra y rastrea pagos de tarjetas')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportDebtPayments(payments)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Download as CSV"
            >
              {t('Export', 'Exportar')}
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showForm ? t('Cancel', 'Cancelar') : t('+ Add Payment', '+ Agregar Pago')}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('Total Paid', 'Total Pagado')}</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">${summary.totalPaid?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="bg-white dark:bg-gray-750 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('Number of Payments', 'Número de Pagos')}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.paymentCount || 0}</div>
          </div>
        </div>

        {/* Add Payment Form */}
        {showForm && (
          <div className="mb-6">
            <DebtPaymentForm 
              householdId={user?.householdId}
              creditCards={creditCards}
              statements={statements}
              onSuccess={handlePaymentAdded}
            />
          </div>
        )}

        {/* Payments Grouped by Month */}
        {byMonth.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('No Payments Yet', 'Sin Pagos')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('Add your first payment to start tracking', 'Agrega tu primer pago para comenzar')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {byMonth.map((monthData) => (
              <div key={monthData.month} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                {/* Month Header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {new Date(monthData.month + '-01').toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </h2>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('Total Paid', 'Total Pagado')}:</span>
                      <span className="ml-2 font-bold text-green-600 dark:text-green-400">${monthData.totalPaid.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('Payments', 'Pagos')}:</span>
                      <span className="ml-2 font-bold text-gray-700 dark:text-gray-300">{monthData.paymentCount}</span>
                    </div>
                  </div>
                </div>

                {/* Payments for this month */}
                <div className="space-y-3">
                  {monthData.payments.map((payment) => (
                    <div
                      key={payment._id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {payment.cardId && (
                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
                              {payment.cardId.cardName} - {payment.cardId.holder}
                            </span>
                          )}
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            ${payment.amountPaid.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">{t('Payment Date', 'Fecha de Pago')}:</span>{' '}
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </div>
                          {payment.cardStatementId && (
                            <div>
                              <span className="font-medium">{t('Statement', 'Estado')}:</span>{' '}
                              {payment.cardStatementId.statementName}
                            </div>
                          )}
                          {payment.notes && (
                            <div>
                              <span className="font-medium">{t('Notes', 'Notas')}:</span>{' '}
                              {payment.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(payment)}
                          className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        >
                          {t('Edit', 'Editar')}
                        </button>
                        <button
                          onClick={() => handleDelete(payment)}
                          className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          {t('Delete', 'Eliminar')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {editingPayment && (
          <EditDebtPaymentModal
            payment={editingPayment}
            creditCards={creditCards}
            statements={statements}
            onSave={handleSaveEdit}
            onClose={() => setEditingPayment(null)}
          />
        )}
      </div>
    </Layout>
  );
}
