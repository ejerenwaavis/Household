import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import SpendingByCategoryWidget from '../components/SpendingByCategoryWidget';
import PendingTasksWidget from '../components/PendingTasksWidget';
import MemberDetailsModal from '../components/MemberDetailsModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function DashboardPage(){
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState(0);
  const [payments, setPayments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [monthlyLabels, setMonthlyLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [expensesData, setExpensesData] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user?.householdId) {
      console.log('[Dashboard] fetchData called but no user.householdId, skipping');
      return;
    }
    console.log('[Dashboard] FETCHING DATA - householdId:', user.householdId, 'householdName:', user.householdName);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      console.log('[Dashboard] Making API calls with householdId:', user.householdId);
      
      const [summaryRes, expensesRes, paymentsRes, goalsRes, creditCardsRes, incomeRes, variableExpensesRes] = await Promise.all([
        api.get(`/households/${user.householdId}/summary`).catch(err => { console.error('[Dashboard] Summary failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/fixed-expenses/${user.householdId}`).catch(err => { console.error('[Dashboard] Fixed expenses failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/fixed-expense-payments/${user.householdId}?month=${monthStr}`).catch(err => { console.error('[Dashboard] Payments failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/goals/${user.householdId}`).catch(err => { console.error('[Dashboard] Goals failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/credit-cards/${user.householdId}`).catch(err => { console.error('[Dashboard] Credit cards failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/income/${user.householdId}`).catch(err => { console.error('[Dashboard] Income failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
        api.get(`/expenses/${user.householdId}`).catch(err => { console.error('[Dashboard] Variable expenses failed for householdId:', user.householdId, err.response?.status, err.message); return null; }),
      ]);
      
      // Also fetch household details to get members list and pending invites
      const [householdRes, invitesRes] = await Promise.all([
        api.get(`/households/${user.householdId}`).catch(err => { 
          console.error('[Dashboard] Household fetch failed for householdId:', user.householdId, err.response?.status, err.message); 
          return null; 
        }),
        api.get(`/households/${user.householdId}/invites`).catch(err => {
          console.error('[Dashboard] Invites fetch failed for householdId:', user.householdId, err.response?.status, err.message);
          return null;
        })
      ]);
      
      console.log('[Dashboard] API responses received:', {
        summary: !!summaryRes?.data,
        expenses: !!expensesRes?.data,
        payments: !!paymentsRes?.data,
        goals: !!goalsRes?.data,
        creditCards: !!creditCardsRes?.data,
        household: !!householdRes?.data,
        invites: !!invitesRes?.data
      });
      
      if (summaryRes?.data) setSummary(summaryRes.data);
      if (expensesRes?.data) setFixedExpensesTotal(expensesRes.data.total || 0);
      if (paymentsRes?.data) {
        console.log('[Dashboard] Payments updated:', paymentsRes.data.payments);
        setPayments(paymentsRes.data.payments || []);
      }
      if (goalsRes?.data) setGoals(goalsRes.data.goals || []);
      if (creditCardsRes?.data) {
        setCreditCards(creditCardsRes.data.cards || []);
        setCreditSummary(creditCardsRes.data.summary || null);
      }
      if (householdRes?.data) setHousehold(householdRes.data);
      if (invitesRes?.data) setPendingInvites(invitesRes.data.invites || []);
      if (variableExpensesRes?.data) setExpensesData(variableExpensesRes.data.expenses || []);
      
      // Build chart data from income and expenses (net per month)
      if (incomeRes?.data && variableExpensesRes?.data) {
        const incomeByMonth = incomeRes.data.byMonth || {};
        const expenseByMonth = variableExpensesRes.data.byMonth || {};
        const monthSet = new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)]);
        const months = Array.from(monthSet).sort();
        const lastMonths = months.slice(-12);
        const netData = lastMonths.map((m) => {
          const incomeTotal = Number(incomeByMonth[m] || 0);
          const expenseTotal = Number(expenseByMonth[m] || 0);
          return incomeTotal - expenseTotal;
        });
        setMonthlyLabels(lastMonths);
        setMonthlyData(netData);
      }
      
      // Build recent transactions from all sources
      const recent = [];
      if (incomeRes?.data?.incomes) {
        incomeRes.data.incomes.slice(0, 3).forEach(inc => {
          const breakdown = Array.isArray(inc.dailyBreakdown) ? inc.dailyBreakdown[0] : null;
          recent.push({
            type: 'income',
            name: breakdown?.source || inc.contributorName || 'Income',
            amount: Number(inc.weeklyTotal || 0),
            date: breakdown?.date || inc.createdAt
          });
        });
      }
      if (paymentsRes?.data?.payments) {
        paymentsRes.data.payments.slice(0, 3).forEach(pmt => {
          recent.push({
            type: 'payment',
            name: pmt.fixedExpenseId?.name || 'Payment',
            amount: pmt.amount,
            date: pmt.paymentDate
          });
        });
      }
      if (variableExpensesRes?.data?.expenses) {
        variableExpensesRes.data.expenses.slice(0, 3).forEach(exp => {
          recent.push({
            type: 'expense',
            name: exp.category || exp.description || 'Expense',
            amount: exp.amount,
            date: exp.date
          });
        });
      }
      recent.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentTransactions(recent.slice(0, 5));
      
      setLoading(false);
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
      setLoading(false);
    }
  }, [user?.householdId]);

  // Initial load and refetch when household ID changes
  useEffect(() => {
    console.log('[Dashboard] useEffect triggered - householdId:', user?.householdId, 'householdName:', user?.householdName);
    // Clear data when household changes
    setSummary(null);
    setHousehold(null);
    setPendingInvites([]);
    setPayments([]);
    setMonthlyData([]);
    setExpensesData([]);
    
    fetchData();
  }, [fetchData, user?.householdId]);

  // Refetch data when page comes back into focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Dashboard] Page came into focus, refetching data...');
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchData]);

  const handleLogout = ()=>{ logout(); navigate('/login'); };

  // Helper: Get current user's role in this household
  const getUserRole = () => {
    if (!household?.members || !user?.id) return null;
    const userMember = household.members.find(m => m.userId === user.id);
    return userMember?.role;
  };

  // Helper: Check if user can manage members (owner or co-owner)
  const canManageMembers = () => {
    const userRole = getUserRole();
    return ['owner', 'co-owner'].includes(userRole);
  };

  // Helper: Handle member button click with access control
  const handleMemberButtonClick = () => {
    if (canManageMembers()) {
      setSelectedMember(household?.members || []);
    } else {
      // Show alert if no permission
      alert(t('You do not have permission to manage members', 'No tienes permiso para administrar miembros'));
    }
  };

  // Calculate available this month
  const available = summary ? (summary.totalIncome - summary.totalExpenses - fixedExpensesTotal) : 0;
  const availableThisMonth = available;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t('Welcome back', 'Bienvenido')}{user?.name ? `, ${user.name}` : ''}</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('Household', 'Hogar')}: {user?.householdName || '—'}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <MetricCard title={t('Total Income', 'Total de Ingresos')} value={summary ? `$${summary.totalIncome.toFixed(2)}` : '$0.00'} subtitle={t('This month', 'Este mes')} accent="bg-green-500" linkTo="/income" />
          <MetricCard title={t('Fixed Expenses', 'Gastos Fijos')} value={`$${fixedExpensesTotal.toFixed(2)}`} subtitle={t('Monthly bills', 'Facturas mensuales')} accent="bg-red-500" linkTo="/fixed-expenses" />
          <MetricCard title={t('Variable Expenses', 'Gastos Variables')} value={summary ? `$${summary.totalExpenses.toFixed(2)}` : '$0.00'} subtitle={t('Other spending', 'Otros gastos')} accent="bg-orange-500" linkTo="/expenses" />
          <MetricCard 
            title={t('Available This Month', 'Disponible Este Mes')} 
            value={`$${availableThisMonth.toFixed(2)}`} 
            subtitle={t('Monthly budget', 'Presupuesto mensual')} 
            accent={availableThisMonth < 0 ? "bg-red-600" : "bg-blue-500"}
            valueColor={availableThisMonth < 0 ? "text-red-600" : "text-gray-700 dark:text-gray-300"}
          />
        </div>

        <PendingTasksWidget tasks={payments} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <SpendingByCategoryWidget expenses={expensesData} />
          </div>

          <aside>
            {/* Credit Debt Widget */}
            {creditSummary && creditSummary.cardCount > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Credit Card Debt', 'Deuda de Tarjetas')}</h3>
                  <a href="/credit-cards" className="text-xs text-pink-600 dark:text-pink-400 hover:text-pink-700">{t('View all', 'Ver todo')}</a>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('Total Debt', 'Deuda Total')}</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">${creditSummary.totalDebt?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{t('Paid Off', 'Pagado')}</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{creditSummary.overallProgress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${creditSummary.overallProgress || 0}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ${creditSummary.totalPaid?.toFixed(2) || '0.00'} {t('of', 'de')} ${creditSummary.totalOriginal?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  {creditCards.length > 0 && creditCards[0].dueDay && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{t('Next Payment Due', 'Próximo Pago')}</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{t('Day', 'Día')} {creditCards[0].dueDay}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">{t('Recent Activity', 'Actividad Reciente')}</h3>
              {recentTransactions.length === 0 ? (
                <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex justify-between"><span>Water Bill</span><span className="font-medium">$120</span></li>
                  <li className="flex justify-between"><span>Salary</span><span className="font-medium">$4,500</span></li>
                  <li className="flex justify-between"><span>Internet</span><span className="font-medium">$60</span></li>
                </ul>
              ) : (
                <ul className="space-y-3 text-sm">
                  {recentTransactions.map((txn, idx) => (
                    <li key={idx} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          txn.type === 'income' ? 'bg-green-500' : 
                          txn.type === 'payment' ? 'bg-blue-500' : 'bg-orange-500'
                        }`} />
                        <span className="text-gray-700 dark:text-gray-300">{txn.name}</span>
                      </div>
                      <span className={`font-medium ${
                        txn.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>${txn.amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 mt-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">{t('Fixed Expenses This Month', 'Gastos Fijos Este Mes')}</h3>
              {(() => {
                const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const unpaidTotal = Math.max(0, fixedExpensesTotal - paidTotal);
                const paymentPercent = fixedExpensesTotal > 0 ? Math.round((paidTotal / fixedExpensesTotal) * 100) : 0;
                return (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>{t('Paid', 'Pagado')}</span>
                        <span className="font-medium text-green-600 dark:text-green-400">${paidTotal.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${paymentPercent}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {paymentPercent}% {t('of', 'de')} ${fixedExpensesTotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{t('Remaining to Pay', 'Por Pagar')}</span>
                        <span className={`font-semibold ${unpaidTotal > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                          ${unpaidTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('Total:', 'Total:')} ${fixedExpensesTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Goals & Funds', 'Metas y Fondos')}</h3>
                <a href="/goals" className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700">{t('View all', 'Ver todo')}</a>
              </div>
              {goals.length === 0 ? (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-3 text-center">{t('No goals yet.', 'Sin objetivos aún.')}</div>
              ) : (
                <ul className="space-y-3">
                  {goals.slice(0, 3).map((goal) => {
                    const key = goal._id || goal.id;
                    const progress = goal.progressPercent != null ? goal.progressPercent : (goal.target > 0 ? Math.min(100, Math.round((goal.currentBalance / goal.target) * 100)) : null);
                    return (
                      <li key={key}>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{goal.name}</span>
                          <span>{progress != null ? `${progress}%` : `$${Number(goal.currentBalance || 0).toFixed(0)}`}</span>
                        </div>
                        {goal.target > 0 && (
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('Household', 'Hogar')}</h3>
                <button 
                  onClick={() => navigate('/members')}
                  className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {t('Manage', 'Gestionar')}
                </button>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleMemberButtonClick}
                  disabled={!canManageMembers()}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    canManageMembers() 
                      ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer' 
                      : 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60'
                  }`}
                  title={canManageMembers() ? '' : t('Only owners can manage members', 'Solo los propietarios pueden administrar miembros')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 text-sm">👥</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t('Members', 'Miembros')}</div>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{household?.members?.length || 0}</div>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 ${!canManageMembers() ? 'text-gray-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {pendingInvites.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center">
                        <span className="text-yellow-600 dark:text-yellow-400 text-sm">✉️</span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('Pending Invites', 'Invitaciones Pendientes')}</div>
                        <div className="font-semibold text-gray-800 dark:text-gray-200">{pendingInvites.length}</div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate('/members')}
                  className="w-full px-4 py-2 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors text-sm font-medium"
                >
                  {t('+ Invite Members', '+ Invitar Miembros')}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Member Details Modal */}
        {selectedMember && typeof selectedMember === 'object' && !Array.isArray(selectedMember) && (
          <MemberDetailsModal
            member={selectedMember}
            householdId={user?.householdId}
            allMembers={household?.members}
            onClose={() => setSelectedMember(null)}
            onSave={(updatedMember) => {
              // Update household members list
              setHousehold(prev => ({
                ...prev,
                members: prev.members.map(m => 
                  m.userId === updatedMember.userId ? updatedMember : m
                )
              }));
            }}
          />
        )}

        {/* Members List Modal */}
        {Array.isArray(selectedMember) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('Household Members', 'Miembros del Hogar')}
                </h2>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-3">
                  {selectedMember.map((member, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedMember(member)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                            {member.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">{member.name || 'Member'}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{member.email || ''}</div>
                          {member.incomePercentage > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {t('Income', 'Ingresos')}: {member.incomePercentage}%
                            </div>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
