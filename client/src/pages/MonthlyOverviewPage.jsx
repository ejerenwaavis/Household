import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import { exportMonthlyOverview } from '../services/exportService';

export default function MonthlyOverviewPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [monthlyData, setMonthlyData] = useState([]);
  const [incomeSplits, setIncomeSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user?.householdId) return;
    
    try {
      setLoading(true);
      
      // Fetch all income and expenses
      const [incomeRes, expensesRes, splitsRes] = await Promise.all([
        api.get(`/income/${user.householdId}`),
        api.get(`/fixed-expenses/${user.householdId}`),
        api.get(`/income-splits/${user.householdId}`).catch(() => ({ data: { splits: [] } }))
      ]);
      
      const incomes = incomeRes.data.incomes || [];
      const expenses = expensesRes.data.expenses || [];
      const splits = splitsRes.data.splits || [];
      
      setIncomeSplits(splits);
      
      // Group by month
      const monthMap = {};
      
      // Add income data
      incomes.forEach(income => {
        const month = income.month;
        // Skip invalid month values
        if (!month || !/^\d{4}-\d{2}$/.test(month)) return;
        if (parseInt(month.substring(0, 4)) < 2020) return;
        if (!monthMap[month]) {
          monthMap[month] = {
            month,
            totalIncome: 0,
            totalExpenses: 0,
            incomeItems: [],
            expenseItems: []
          };
        }
        // Income model stores amount as `weeklyTotal`; fall back to `amount` for older records
        const incomeAmount = Number(income.weeklyTotal) || Number(income.amount) || 0;
        monthMap[month].totalIncome += incomeAmount;
        monthMap[month].incomeItems.push({ ...income, amount: incomeAmount });
      });

      // Fixed expenses have no month field — add the total of all fixed expenses
      // to every month that has income data (they are recurring monthly costs)
      const totalFixedExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      Object.keys(monthMap).forEach(month => {
        monthMap[month].totalExpenses = totalFixedExpenses;
        monthMap[month].expenseItems = expenses;
      });
      
      // Calculate remaining and weekly allowance
      const monthlyArray = Object.values(monthMap).map(m => {
        const remaining = m.totalIncome - m.totalExpenses;
        const weeksPerMonth = 4.33; // Average weeks per month
        const weeklyAllowance = remaining / weeksPerMonth;
        
        return {
          ...m,
          remaining,
          weeklyAllowance,
          perPersonSplit: splits.map(split => ({
            name: split.userName,
            percentage: split.splitPercentage,
            amount: (remaining * split.splitPercentage) / 100,
            weekly: (weeklyAllowance * split.splitPercentage) / 100
          }))
        };
      });
      
      // Sort by month descending
      monthlyArray.sort((a, b) => b.month.localeCompare(a.month));
      
      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error('[MonthlyOverview] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.householdId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('Monthly Overview', 'Resumen Mensual')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t('View income, expenses, and budget breakdown by month', 'Ver ingresos, gastos y presupuesto por mes')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/finance-report?month=${selectedMonth || (monthlyData[0]?.month || '')}`)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center gap-1.5"
              title="Open Finance Meeting Report"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('Finance Meeting Report', 'Reporte de Reunión')}
            </button>
            <button
              onClick={() => exportMonthlyOverview(monthlyData)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Download as CSV"
            >
              {t('Export', 'Exportar')}
            </button>
          </div>
        </div>

        {/* Monthly Table */}
        {monthlyData.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('No Data Yet', 'Sin Datos')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('Add income and expenses to see monthly overview', 'Agrega ingresos y gastos para ver resumen')}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Month', 'Mes')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Total Income', 'Ingreso Total')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Fixed Expenses', 'Gastos Fijos')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Remaining', 'Restante')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Weekly Allowance', 'Asignación Semanal')}
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('Actions', 'Acciones')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {monthlyData.map((data) => (
                  <tr 
                    key={data.month} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedMonth(selectedMonth === data.month ? null : data.month)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {new Date(data.month + '-02T12:00:00').toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'long' 
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600 dark:text-green-400">
                      ${(Number(data.totalIncome) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-red-600 dark:text-red-400">
                      ${(Number(data.totalExpenses) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                      ${(Number(data.remaining) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-purple-600 dark:text-purple-400">
                      ${(Number(data.weeklyAllowance) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMonth(selectedMonth === data.month ? null : data.month);
                        }}
                      >
                        {selectedMonth === data.month ? t('Hide', 'Ocultar') : t('Details', 'Detalles')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Details Panel */}
        {selectedMonth && monthlyData.find(m => m.month === selectedMonth) && (
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                {new Date(selectedMonth + '-02T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                <span className="ml-2 font-normal text-gray-400 normal-case tracking-normal">{t('— Budget Breakdown', '— Desglose de Presupuesto')}</span>
              </h2>
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none px-1"
                aria-label="Close"
              >✕</button>
            </div>

            {(() => {
              const data = monthlyData.find(m => m.month === selectedMonth);
              const remaining = data.remaining || 0;
              const healthPct = data.totalIncome > 0
                ? Math.min(100, Math.max(0, (remaining / data.totalIncome) * 100))
                : 0;
              const healthColor = healthPct >= 30 ? 'bg-green-500' : healthPct >= 10 ? 'bg-yellow-400' : 'bg-red-500';

              return (
                <div className="p-4 space-y-4">

                  {/* ── Summary strip ─────────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-green-50 dark:bg-green-900/25 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">{t('Income', 'Ingresos')}</div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">${(data.totalIncome || 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{data.incomeItems.length} {data.incomeItems.length === 1 ? t('entry', 'registro') : t('entries', 'registros')}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/25 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">{t('Fixed Exp.', 'Gastos Fijos')}</div>
                      <div className="text-xl font-bold text-red-700 dark:text-red-300">${(data.totalExpenses || 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{data.expenseItems.length} {data.expenseItems.length === 1 ? t('item', 'ítem') : t('items', 'ítems')}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/25 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{t('Remaining', 'Restante')}</div>
                      <div className={`text-xl font-bold ${remaining >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-600 dark:text-red-400'}`}>${remaining.toFixed(2)}</div>
                      <div className="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${healthColor}`} style={{ width: `${healthPct}%` }} />
                      </div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/25 rounded-xl px-3 py-2.5">
                      <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">{t('Wk Allowance', 'Asign. Semanal')}</div>
                      <div className="text-xl font-bold text-purple-700 dark:text-purple-300">${(data.weeklyAllowance || 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">÷ 4.33 {t('weeks', 'semanas')}</div>
                    </div>
                  </div>

                  {/* ── Income + Expenses side-by-side ────────────────── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                    {/* Income table */}
                    {data.incomeItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{t('Income Sources', 'Fuentes de Ingreso')}</span>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">{t('Contributor', 'Contribuidor')}</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">{t('Source', 'Fuente')}</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-500 dark:text-gray-400">Wk</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400">{t('Amount', 'Monto')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {data.incomeItems.map((inc, i) => (
                                <tr key={inc._id || i} className="hover:bg-green-50 dark:hover:bg-green-900/20">
                                  <td className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300">{inc.contributorName || '—'}</td>
                                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{inc.dailyBreakdown?.[0]?.source || inc.source || '—'}</td>
                                  <td className="px-3 py-1.5 text-center text-gray-400 dark:text-gray-500">{inc.week || '—'}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-green-600 dark:text-green-400">${(Number(inc.weeklyTotal) || Number(inc.amount) || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-green-50 dark:bg-green-900/30">
                                <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-300 uppercase">{t('Total', 'Total')}</td>
                                <td className="px-3 py-1.5 text-right text-xs font-bold text-green-700 dark:text-green-300">${(data.totalIncome || 0).toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Expenses table */}
                    {data.expenseItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{t('Fixed Expenses', 'Gastos Fijos')}</span>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">{t('Name', 'Nombre')}</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-500 dark:text-gray-400">{t('Freq', 'Frec.')}</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400">{t('Amount', 'Monto')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {data.expenseItems.map((exp, i) => (
                                <tr key={exp._id || i} className="hover:bg-red-50 dark:hover:bg-red-900/20">
                                  <td className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300">{exp.name || '—'}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize">{exp.frequency || 'monthly'}</span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-red-600 dark:text-red-400">${(Number(exp.amount) || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-red-50 dark:bg-red-900/30">
                                <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 uppercase">{t('Total', 'Total')}</td>
                                <td className="px-3 py-1.5 text-right text-xs font-bold text-red-700 dark:text-red-300">${(data.totalExpenses || 0).toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Per-person split ──────────────────────────────── */}
                  {data.perPersonSplit && data.perPersonSplit.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{t('Income Split', 'División de Ingresos')}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {data.perPersonSplit.map((split, idx) => (
                          <div key={idx} className="border border-indigo-100 dark:border-indigo-800 rounded-xl px-3 py-2.5 bg-indigo-50/40 dark:bg-indigo-900/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{split.name}</span>
                              <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-1 shrink-0">{split.percentage}%</span>
                            </div>
                            <div className="flex justify-between items-end gap-1">
                              <div>
                                <div className="text-xs text-gray-400">{t('Month', 'Mes')}</div>
                                <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">${(Number(split.amount) || 0).toFixed(0)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-400">{t('Week', 'Sem.')}</div>
                                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">${(Number(split.weekly) || 0).toFixed(0)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        )}
      </div>
    </Layout>
  );
}
