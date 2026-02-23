import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import Layout from '../components/Layout';
import CardStatementForm from '../components/CardStatementForm';
import EditCardStatementModal from '../components/EditCardStatementModal';
import api from '../services/api';
import { exportCardStatements } from '../services/exportService';

export default function CardStatementsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [statements, setStatements] = useState([]);
  const [byMonth, setByMonth] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStatement, setEditingStatement] = useState(null);

  const fetchStatements = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/card-statements/${user.householdId}`);
      setStatements(response.data.statements || []);
      setByMonth(response.data.byMonth || []);
    } catch (error) {
      console.error('[CardStatements] Error fetching:', error);
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
      console.error('[CardStatements] Error fetching cards:', error);
    }
  }, [user?.householdId]);

  useEffect(() => {
    fetchStatements();
    fetchCreditCards();
  }, [fetchStatements, fetchCreditCards]);

  const handleStatementAdded = () => {
    setShowForm(false);
    fetchStatements();
  };

  const handleEdit = (statement) => {
    setEditingStatement(statement);
  };

  const handleSaveEdit = async (updates) => {
    if (!editingStatement) return;

    try {
      await api.patch(
        `/card-statements/${user.householdId}/${editingStatement._id}`,
        updates
      );
      setEditingStatement(null);
      fetchStatements();
    } catch (error) {
      console.error('[CardStatements] Update error:', error);
      alert(error.response?.data?.error || t('Failed to update statement', 'Error al actualizar estado'));
    }
  };

  const handleDelete = async (statement) => {
    if (!window.confirm(t(`Delete "${statement.statementName}"?`, `¿Eliminar "${statement.statementName}"?`))) {
      return;
    }

    try {
      await api.delete(`/card-statements/${user.householdId}/${statement._id}`);
      fetchStatements();
    } catch (error) {
      console.error('[CardStatements] Delete error:', error);
      alert(error.response?.data?.error || t('Failed to delete statement', 'Error al eliminar estado'));
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('Card Statements', 'Estados de Tarjetas')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t('Track monthly credit card statements', 'Rastrea estados mensuales de tarjetas')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportCardStatements(statements)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Download as CSV"
            >
              {t('Export', 'Exportar')}
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showForm ? t('Cancel', 'Cancelar') : t('+ Add Statement', '+ Agregar Estado')}
            </button>
          </div>
        </div>

        {/* Add Statement Form */}
        {showForm && (
          <div className="mb-6">
            <CardStatementForm 
              householdId={user?.householdId}
              creditCards={creditCards}
              onSuccess={handleStatementAdded}
            />
          </div>
        )}

        {/* Statements Grouped by Month */}
        {byMonth.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('No Statements Yet', 'Sin Estados')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('Add your first statement to start tracking', 'Agrega tu primer estado para comenzar')}
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
                      <span className="text-gray-600 dark:text-gray-400">{t('Statement Balance', 'Balance Estado')}:</span>
                      <span className="ml-2 font-bold text-red-600 dark:text-red-400">${monthData.totalStatementBalance.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('Current', 'Actual')}:</span>
                      <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">${monthData.totalCurrentBalance.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">{t('Paid', 'Pagado')}:</span>
                      <span className="ml-2 font-bold text-green-600 dark:text-green-400">${monthData.totalPaid.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Statements for this month */}
                <div className="space-y-3">
                  {monthData.statements.map((stmt) => (
                    <div
                      key={stmt._id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{stmt.statementName}</h3>
                          {stmt.cardId && (
                            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-xs">
                              {stmt.cardId.cardName} - {stmt.cardId.holder}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
                          <div>
                            <span className="font-medium">{t('Statement Date', 'Fecha')}:</span>{' '}
                            {new Date(stmt.statementDate).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">{t('Statement Balance', 'Balance Estado')}:</span>{' '}
                            ${stmt.statementBalance.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">{t('Current Balance', 'Balance Actual')}:</span>{' '}
                            ${stmt.currentBalance.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-medium">{t('Paid', 'Pagado')}:</span>{' '}
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              ${stmt.amountPaid?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(stmt)}
                          className="px-3 py-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        >
                          {t('Edit', 'Editar')}
                        </button>
                        <button
                          onClick={() => handleDelete(stmt)}
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

        {editingStatement && (
          <EditCardStatementModal
            statement={editingStatement}
            creditCards={creditCards}
            onSave={handleSaveEdit}
            onClose={() => setEditingStatement(null)}
          />
        )}
      </div>
    </Layout>
  );
}
