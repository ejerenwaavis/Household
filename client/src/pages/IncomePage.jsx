import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import IncomeForm from '../components/IncomeForm';
import IncomeList from '../components/IncomeList';
import IncomeViewModal from '../components/IncomeViewModal';
import IncomeSplitConfig from '../components/IncomeSplitConfig';
import IncomeSplitExpectations from '../components/IncomeSplitExpectations';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function IncomePage(){
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [weeklyTotals, setWeeklyTotals] = useState([0,0,0,0]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewingWeek, setViewingWeek] = useState(null); // null, 1, 2, 3, 4, or 'month'

  const fetchCurrentMonth = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      console.log('[IncomePage] fetching month:', monthStr, 'householdId:', user.householdId, 'lang:', language);
      const res = await api.get(`/income/${user.householdId}/${monthStr}?lang=${language}`);
      console.log('[IncomePage] fetch response:', res && res.data);
      const incomes = res.data.income || [];
      setEntries(incomes);
      setWeeklyTotals(res.data.weeklyTotals || [0,0,0,0]);
      setMonthTotal(res.data.total || 0);
    } catch (err) {
      console.error('[IncomePage] Failed to load incomes', err, err?.response?.data);
    } finally { setLoading(false); }
  };

  const fetchMembers = async () => {
    if (!user?.householdId) return;
    try {
      const res = await api.get(`/households/${user.householdId}`);
      const memberList = res.data?.members || [];
      setMembers(memberList);
    } catch (err) {
      console.error('[IncomePage] fetch members error:', err);
    }
  };

  const fetchFixedExpenses = async () => {
    if (!user?.householdId) return;
    try {
      const res = await api.get(`/fixed-expenses/${user.householdId}`);
      setFixedExpensesTotal(res.data.total || 0);
    } catch (err) {
      console.error('[IncomePage] fetch fixed expenses error:', err);
    }
  };

  useEffect(()=>{ fetchCurrentMonth(); fetchMembers(); fetchFixedExpenses(); }, [user, language]);

  const handleCreated = (newEntry) => {
    // Prepend to list for instant feedback
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);

    // Recalculate totals based on updated entries
    const weeks = [0, 0, 0, 0];
    updatedEntries.forEach((e) => {
      const w = Number(e.week) || 1;
      const idx = Math.min(3, Math.max(0, w - 1));
      const wt = Number(e.weeklyTotal) || 0;
      weeks[idx] += wt;
    });
    const total = weeks.reduce((a, b) => a + b, 0);
    setWeeklyTotals(weeks);
    setMonthTotal(total);
  };

  // compute current week index (1-4)
  const now = new Date();
  const currentWeek = Math.min(4, Math.ceil(now.getDate() / 7));
  const weekEntries = entries.filter(e => Number(e.week) === Number(currentWeek));

  // Get entries for viewing modal
  const getEntriesForView = () => {
    if (viewingWeek === 'month') {
      return entries;
    } else if (viewingWeek && typeof viewingWeek === 'number') {
      return entries.filter(e => Number(e.week) === Number(viewingWeek));
    }
    return [];
  };

  const getViewTitle = () => {
    if (viewingWeek === 'month') {
      const now = new Date();
      const monthName = now.toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
      return language === 'es' ? `Todos los Ingresos - ${monthName}` : `All Income - ${monthName}`;
    } else if (viewingWeek && typeof viewingWeek === 'number') {
      return language === 'es' ? `Ingresos Semana ${viewingWeek}` : `Week ${viewingWeek} Income`;
    }
    return '';
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Add Income', 'Agregar Ingreso')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('Quickly log daily income for your household.', 'Registra los ingresos diarios de tu hogar.')}</p>
        </div>

        <IncomeForm householdId={user?.householdId} onCreated={handleCreated} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">{t('This week', 'Esta semana')}</h2>
            <IncomeList householdId={user?.householdId} loading={loading} entries={weekEntries} members={members} refresh={fetchCurrentMonth} />
          </div>

          <aside>
            <h2 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">{t('This month', 'Este mes')}</h2>
            <div className="space-y-4">
              <div
                onClick={() => setViewingWeek('month')}
                className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{t('Total Income', 'Total de Ingresos')}</div>
                    <div className="text-2xl font-semibold text-gray-700 dark:text-gray-300">${monthTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('Click to view all', 'Clic para ver todo')}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-750 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">{t('Weekly totals', 'Totales semanales')}</div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {weeklyTotals.map((w, i) => (
                    <div
                      key={i}
                      onClick={() => setViewingWeek(i + 1)}
                      className="bg-gray-50 dark:bg-gray-700 p-3 rounded cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      <div className="text-xs text-gray-400 dark:text-gray-500">W{i+1}</div>
                      <div className="font-semibold text-gray-700 dark:text-gray-300">${Number(w || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Income Split Expectations and Configuration */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <IncomeSplitExpectations 
              householdId={user?.householdId}
              fixedExpensesTotal={fixedExpensesTotal}
              currentMonthIncome={entries}
            />
          </div>

          <aside>
            <IncomeSplitConfig 
              householdId={user?.householdId}
              onUpdate={fetchCurrentMonth}
            />
          </aside>
        </div>

        {viewingWeek && (
          <IncomeViewModal
            title={getViewTitle()}
            entries={getEntriesForView()}
            members={members}
            onClose={() => setViewingWeek(null)}
          />
        )}
      </div>
    </Layout>
  );
}
