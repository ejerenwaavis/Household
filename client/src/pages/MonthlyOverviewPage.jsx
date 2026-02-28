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
                      {new Date(data.month + '-01').toLocaleDateString(undefined, { 
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
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              {new Date(selectedMonth + '-01').toLocaleDateString(undefined, { 
                year: 'numeric', 
                month: 'long' 
              })} {t('- Details', '- Detalles')}
            </h2>
            
            {(() => {
              const data = monthlyData.find(m => m.month === selectedMonth);
              return (
                <div className="space-y-6">
                  {/* Per-Person Split */}
                  {data.perPersonSplit && data.perPersonSplit.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {t('Per-Person Split', 'División por Persona')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.perPersonSplit.map((split, idx) => (
                          <div key={idx} className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{split.name}</span>
                              <span className="text-sm text-gray-600 dark:text-gray-400">{split.percentage}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('Monthly', 'Mensual')}</div>
                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">${(Number(split.amount) || 0).toFixed(2)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('Weekly', 'Semanal')}</div>
                                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">${(Number(split.weekly) || 0).toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Income Items */}
                  {data.incomeItems && data.incomeItems.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        {t('Income Sources', 'Fuentes de Ingreso')}
                      </h3>
                      <div className="space-y-2">
                        {data.incomeItems.map((income, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-green-50 dark:bg-green-900 rounded-lg p-3">
                            <span className="text-gray-700 dark:text-gray-200">{income.source}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">${(Number(income.amount) || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expense Items */}
                  {data.expenseItems && data.expenseItems.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-3">
                        {t('Fixed Expenses', 'Gastos Fijos')}
                      </h3>
                      <div className="space-y-2">
                        {data.expenseItems.map((expense, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-red-50 rounded-lg p-3">
                            <span className="text-gray-700">{expense.name}</span>
                            <span className="font-semibold text-red-600">${(Number(expense.amount) || 0).toFixed(2)}</span>
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
