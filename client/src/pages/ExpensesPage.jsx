import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseList from '../components/ExpenseList';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function ExpensesPage(){
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCurrentMonth = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      console.log('[ExpensesPage] fetching month:', monthStr, 'householdId:', user.householdId, 'lang:', language);
      const res = await api.get(`/expenses/${user.householdId}/${monthStr}?lang=${language}`);
      console.log('[ExpensesPage] fetch response:', res && res.data);
      const expenses = res.data.expenses || [];
      setEntries(expenses);
      setCategoryTotals(res.data.byCategory || {});
      setMonthTotal(res.data.total || 0);
    } catch (err) {
      console.error('[ExpensesPage] Failed to load expenses', err, err?.response?.data);
    } finally { setLoading(false); }
  };

  const fetchMembers = async () => {
    if (!user?.householdId) return;
    try {
      const res = await api.get(`/households/${user.householdId}`);
      const memberList = res.data?.members || [];
      setMembers(memberList);
    } catch (err) {
      console.error('[ExpensesPage] fetch members error:', err);
    }
  };

  useEffect(()=>{ fetchCurrentMonth(); fetchMembers(); }, [user, language]);

  const handleCreated = (newEntry) => {
    // Prepend to list for instant feedback
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);

    // Recalculate totals
    const categories = {};
    updatedEntries.forEach((e) => {
      const cat = e.category || 'Other';
      categories[cat] = (categories[cat] || 0) + (Number(e.amount) || 0);
    });
    setCategoryTotals(categories);
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    setMonthTotal(total);
  };

  // compute current week index (1-4)
  const now = new Date();
  const currentWeek = Math.min(4, Math.ceil(now.getDate() / 7));
  const weekEntries = entries.filter(e => Number(e.week) === Number(currentWeek));

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Variable Expenses', 'Gastos Variables')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('Track your daily and weekly spending.', 'Registra tus gastos diarios y semanales.')}</p>
        </div>

        {/* Link bank account prompt */}
        <a
          href="/linked-accounts"
          className="flex items-center gap-3 mb-6 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
        >
          <span className="text-2xl">🏦</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Link your bank account</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Automatically sync transactions instead of entering them manually</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </a>

        <ExpenseForm householdId={user?.householdId} onCreated={handleCreated} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">{t('This week', 'Esta semana')}</h2>
            <ExpenseList householdId={user?.householdId} loading={loading} entries={weekEntries} members={members} refresh={fetchCurrentMonth} />
          </div>

          <aside>
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">{t('This month', 'Este mes')}</h2>
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('Total Spent', 'Total Gastado')}</div>
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">${monthTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('This month', 'Este mes')}</div>
                  </div>
                </div>
              </div>

              {Object.keys(categoryTotals).length > 0 && (
                <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-3">{t('By Category', 'Por Categoría')}</div>
                  <div className="space-y-2">
                    {Object.entries(categoryTotals).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-gray-600">{cat}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">${amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
