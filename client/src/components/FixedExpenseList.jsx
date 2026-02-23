import React, { useState } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import EditFixedExpenseModal from './EditFixedExpenseModal';
import MarkPaymentModal from './MarkPaymentModal';

export default function FixedExpenseList({ householdId, byGroup = {}, total = 0, payments = [], loading = false, refresh, currentMonth }){
  const { t, language } = useLanguage();
  const [editingExpense, setEditingExpense] = useState(null);
  const [markingPayment, setMarkingPayment] = useState(null);
  console.log('[FixedExpenseList] render byGroup:', Object.keys(byGroup), 'total:', total, 'loading:', loading, 'payments:', payments.length);

  const handleDelete = async (expense) => {
    const id = expense._id || expense.id;
    if (!id) return console.error('[FixedExpenseList] missing id for delete');
    if (!householdId) return console.error('[FixedExpenseList] missing householdId');
    if (!window.confirm(t(`Delete "${expense.name}"?`, `¿Eliminar "${expense.name}"?`))) return;
    try {
      console.log('[FixedExpenseList] deleting', { id, householdId });
      await api.delete(`/fixed-expenses/${householdId}/${id}`);
      console.log('[FixedExpenseList] delete success', id);
      refresh && refresh();
    } catch (err) {
      console.error('[FixedExpenseList] delete error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
  };

  const handleSaveEdit = async (updates) => {
    const id = editingExpense._id || editingExpense.id;
    if (!id) return console.error('[FixedExpenseList] missing id for edit');
    if (!householdId) return console.error('[FixedExpenseList] missing householdId');

    try {
      console.log('[FixedExpenseList] patching', { id, householdId, updates });
      const res = await api.patch(`/fixed-expenses/${householdId}/${id}`, updates);
      console.log('[FixedExpenseList] patch response', res && res.data);
      setEditingExpense(null);
      refresh && refresh();
    } catch (err) {
      console.error('[FixedExpenseList] patch error', err, err?.response?.data);
      alert(err?.response?.data?.error || 'Failed to update');
    }
  };

  const handleSavePayment = async (paymentData) => {
    if (!householdId) return console.error('[FixedExpenseList] missing householdId for payment');
    try {
      console.log('[FixedExpenseList] creating payment', paymentData);
      await api.post(`/fixed-expense-payments/${householdId}`, paymentData);
      setMarkingPayment(null);
      refresh && refresh();
    } catch (err) {
      console.error('[FixedExpenseList] payment error', err);
      alert(err?.response?.data?.error || t('Failed to save payment', 'Error al guardar pago'));
    }
  };

  const categoryColors = {
    'Housing': 'text-blue-600',
    'Utilities': 'text-yellow-600',
    'Insurance': 'text-orange-600',
    'Auto': 'text-purple-600',
    'Family': 'text-pink-600',
    'Food': 'text-green-600',
    'Savings': 'text-teal-600',
    'Debt': 'text-red-600',
    'Bills': 'text-indigo-600',
    'Entertainment': 'text-violet-600',
    'Other': 'text-gray-600',
  };

  if (loading) {
    return <div className="text-gray-500">{t('Loading…', 'Cargando…')}</div>;
  }

  if (Object.keys(byGroup).length === 0) {
    return <div className="text-sm text-gray-500">{t('No fixed expenses yet.', 'Sin gastos fijos aún.')}</div>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(byGroup).map(([group, expenses]) => {
        const groupTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const colorClass = categoryColors[group] || 'text-gray-600';
        return (
          <div key={group}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-medium ${colorClass}`}>{group}</h3>
              <span className="text-sm font-semibold text-gray-700">${groupTotal.toFixed(2)}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
              {expenses.map((e) => {
                const key = e._id || e.id;
                const displayName = language === 'es' && e.name_es ? e.name_es : e.name;
                
                // Find payments for this expense in current month
                const expenseId = String(e._id || e.id);
                const expensePayments = payments.filter(p => {
                  // Handle both cases: fixedExpenseId could be a string or an object (due to populate)
                  const paymentExpenseId = String((p.fixedExpenseId?._id || p.fixedExpenseId) || '');
                  const matchesExpense = paymentExpenseId === expenseId;
                  const matchesMonth = currentMonth ? p.monthPaid === currentMonth : true;
                  return matchesExpense && matchesMonth;
                });
                const paidAmount = expensePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const isPaid = paidAmount >= Number(e.amount);
                const remaining = Math.max(0, Number(e.amount) - paidAmount);
                
                console.log('[FixedExpenseList] expense:', displayName, { expenseId, totalPayments: payments.length, matchingPayments: expensePayments.length, paidAmount, expenseAmount: Number(e.amount), isPaid });

                return (
                  <div key={key} className={`p-3 rounded-lg border transition-colors ${
                    isPaid 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</div>
                        {isPaid && <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 rounded-full font-medium">✓ {t('Paid', 'Pagado')}</span>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('Frequency', 'Frecuencia')}: <span className="capitalize">{t(e.frequency, e.frequency === 'weekly' ? 'Semanal' : e.frequency === 'biweekly' ? 'Quincenal' : 'Mensual')}</span>
                          {e.dueDay && ` • ${t('Due', 'Vence')}: ${t('Day', 'Día')} ${e.dueDay}`}
                        </div>
                        {paidAmount > 0 && !isPaid && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            {t('Paid', 'Pagado')}: ${paidAmount.toFixed(2)} / ${Number(e.amount).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-right">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-fit">${Number(e.amount || 0).toFixed(2)}</div>
                        <button
                          onClick={() => !isPaid && setMarkingPayment(e)}
                          disabled={isPaid}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            isPaid
                              ? 'bg-green-100 text-green-700 cursor-not-allowed opacity-75'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                          }`}
                        >
                          {isPaid ? t('Paid', 'Pagado') : t('Mark Paid', 'Marcar')}
                        </button>
                        <button onClick={()=>handleEdit(e)} className="text-xs text-indigo-600 hover:text-indigo-700">{t('Edit', 'Editar')}</button>
                        <button onClick={()=>handleDelete(e)} className="text-xs text-red-600 hover:text-red-700">{t('Delete', 'Eliminar')}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="bg-gradient-to-r from-red-50 dark:from-red-900/20 to-orange-50 dark:to-orange-900/20 rounded-2xl p-6 border border-red-100 dark:border-red-700 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Total Monthly Fixed Expenses', 'Total de Gastos Fijos Mensuales')}</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">${total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="text-right mt-4">
        <button onClick={() => { console.log('[FixedExpenseList] refresh clicked'); refresh && refresh(); }} className="text-sm text-indigo-600">{t('Refresh', 'Actualizar')}</button>
      </div>

      {editingExpense && (
        <EditFixedExpenseModal
          expense={editingExpense}
          onSave={handleSaveEdit}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {markingPayment && (
        <MarkPaymentModal
          expense={markingPayment}
          onSave={handleSavePayment}
          onClose={() => setMarkingPayment(null)}
        />
      )}
    </div>
  );
}
