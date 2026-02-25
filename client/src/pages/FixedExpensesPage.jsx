import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import FixedExpenseForm from '../components/FixedExpenseForm';
import FixedExpenseList from '../components/FixedExpenseList';
import FixedExpensePaymentsWidget from '../components/FixedExpensePaymentsWidget';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function FixedExpensesPage(){
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [byGroup, setByGroup] = useState({});
  const [total, setTotal] = useState(0);
  const [payments, setPayments] = useState([]);
  const [currentMonth, setCurrentMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchExpenses = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      console.log('[FixedExpensesPage] fetching expenses for householdId:', user.householdId, 'lang:', language);
      const res = await api.get(`/fixed-expenses/${user.householdId}?lang=${language}`);
      console.log('[FixedExpensesPage] fetch response:', res && res.data);
      setExpenses(res.data.expenses || []);
      setByGroup(res.data.byGroup || {});
      setTotal(res.data.total || 0);
      
      // Fetch payments for current month
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setCurrentMonth(monthStr);
      const paymentsRes = await api.get(`/fixed-expense-payments/${user.householdId}?month=${monthStr}`);
      setPayments(paymentsRes.data.payments || []);
    } catch (err) {
      console.error('[FixedExpensesPage] Failed to load expenses', err, err?.response?.data);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchExpenses(); }, [user, language]);

  const handleCreated = (newExpense) => {
    fetchExpenses();
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Fixed Expenses', 'Gastos Fijos')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('Manage your recurring monthly bills and fixed payments.', 'Gestiona tus gastos recurrentes mensuales y pagos fijos.')}</p>
          </div>
        </div>

        {showForm && (
          <FixedExpenseForm householdId={user?.householdId} onCreated={handleCreated} />
        )}

        <div className="mt-4 mb-6">
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            {showForm ? t('Cancel', 'Cancelar') : t('+ Add Fixed Expense', '+ Agregar Gasto Fijo')}
          </button>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">{t('Your Fixed Expenses', 'Tus Gastos Fijos')}</h2>
          
          {/* Payment summary widget */}
          <div className="mb-6">
            <FixedExpensePaymentsWidget
              currentMonth={currentMonth}
              payments={payments}
              totalFixed={total}
            />
          </div>

          <FixedExpenseList 
            householdId={user?.householdId} 
            byGroup={byGroup}
            total={total}
            payments={payments}
            currentMonth={currentMonth}
            loading={loading}
            refresh={fetchExpenses}
            language={language}
          />
        </div>
      </div>
    </Layout>
  );
}
