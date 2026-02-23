import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import SimpleBarChart from '../components/SimpleBarChart';
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
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);

  const fetchData = useCallback(async () => {
    if (!user?.householdId) return;
    console.log('[Dashboard] Fetching data...');
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const [summaryRes, expensesRes, paymentsRes, goalsRes] = await Promise.all([
        api.get(`/households/${user.householdId}/summary`).catch(err => { console.error('Summary load failed', err); return null; }),
        api.get(`/fixed-expenses/${user.householdId}`).catch(err => { console.error('Fixed expenses load failed', err); return null; }),
        api.get(`/fixed-expense-payments/${user.householdId}?month=${monthStr}`).catch(err => { console.error('Payments load failed', err); return null; }),
        api.get(`/goals/${user.householdId}`).catch(err => { console.error('Goals load failed', err); return null; }),
      ]);
      
      // Also fetch household details to get members list and pending invites
      const [householdRes, invitesRes] = await Promise.all([
        api.get(`/households/${user.householdId}`).catch(err => { 
          console.error('Household load failed', err); 
          return null; 
        }),
        api.get(`/households/${user.householdId}/invites`).catch(err => {
          console.error('Invites load failed', err);
          return null;
        })
      ]);
      
      if (summaryRes?.data) setSummary(summaryRes.data);
      if (expensesRes?.data) setFixedExpensesTotal(expensesRes.data.total || 0);
      if (paymentsRes?.data) {
        console.log('[Dashboard] Payments updated:', paymentsRes.data.payments);
        setPayments(paymentsRes.data.payments || []);
      }
      if (goalsRes?.data) setGoals(goalsRes.data.goals || []);
      if (householdRes?.data) setHousehold(householdRes.data);
      if (invitesRes?.data) setPendingInvites(invitesRes.data.invites || []);
      setLoading(false);
    } catch (err) {
      console.error('[Dashboard] fetch error:', err);
      setLoading(false);
    }
  }, [user?.householdId]);

  // Initial load
  useEffect(() => {
    console.log('[Dashboard] Initial load effect');
    fetchData();
  }, [fetchData]);

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

  // Sample small dataset for the chart (if backend doesn't provide)
  const chartData = Array.from({length:12}, (_,i)=> Math.round(Math.random()*1000));

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('Welcome back', 'Bienvenido')}{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="text-sm text-gray-500">{t('Household', 'Hogar')}: {user?.householdName || '\u2014'}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => { console.log('[Dashboard] Manual refresh'); fetchData(); }} 
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              {t('Refresh', 'Actualizar')}
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">{t('Logout', 'Cerrar sesi\u00f3n')}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard title={t('Total Income', 'Total de Ingresos')} value={summary ? `$${summary.totalIncome.toFixed(2)}` : '$0.00'} subtitle={t('This month', 'Este mes')} accent="bg-green-500" linkTo="/income" />
          <MetricCard title={t('Fixed Expenses', 'Gastos Fijos')} value={`$${fixedExpensesTotal.toFixed(2)}`} subtitle={t('Monthly bills', 'Facturas mensuales')} accent="bg-red-500" linkTo="/fixed-expenses" />
          <MetricCard title={t('Variable Expenses', 'Gastos Variables')} value={summary ? `$${summary.totalExpenses.toFixed(2)}` : '$0.00'} subtitle={t('Other spending', 'Otros gastos')} accent="bg-orange-500" linkTo="/expenses" />
          {(() => {
            const available = summary ? (summary.totalIncome - summary.totalExpenses - fixedExpensesTotal) : 0;
            const isNegative = available < 0;
            return (
              <MetricCard 
                title={t('Available', 'Disponible')} 
                value={`$${available.toFixed(2)}`} 
                subtitle={t('After all expenses', 'Después de todos los gastos')} 
                accent={isNegative ? "bg-red-600" : "bg-blue-500"}
                valueColor={isNegative ? "text-red-600" : "text-gray-800"}
              />
            );
          })()}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SimpleBarChart data={chartData} labels={language === 'es' ? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']} />
          </div>

          <aside>
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-3">{t('Recent Activity', 'Actividad Reciente')}</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex justify-between"><span>Water Bill</span><span className="font-medium">$120</span></li>
                <li className="flex justify-between"><span>Salary</span><span className="font-medium">$4,500</span></li>
                <li className="flex justify-between"><span>Internet</span><span className="font-medium">$60</span></li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 mt-4">
              <h3 className="text-sm font-medium text-gray-600 mb-3">{t('Fixed Expenses This Month', 'Gastos Fijos Este Mes')}</h3>
              {(() => {
                const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const unpaidTotal = Math.max(0, fixedExpensesTotal - paidTotal);
                const paymentPercent = fixedExpensesTotal > 0 ? Math.round((paidTotal / fixedExpensesTotal) * 100) : 0;
                return (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{t('Paid', 'Pagado')}</span>
                        <span className="font-medium text-green-600">${paidTotal.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${paymentPercent}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {paymentPercent}% {t('of', 'de')} ${fixedExpensesTotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">{t('Remaining to Pay', 'Por Pagar')}</span>
                        <span className={`font-semibold ${unpaidTotal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          ${unpaidTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t('Total:', 'Total:')} ${fixedExpensesTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600">{t('Goals & Funds', 'Metas y Fondos')}</h3>
                <a href="/goals" className="text-xs text-teal-600 hover:text-teal-700">{t('View all', 'Ver todo')}</a>
              </div>
              {goals.length === 0 ? (
                <div className="text-xs text-gray-400 py-3 text-center">{t('No goals yet.', 'Sin objetivos aún.')}</div>
              ) : (
                <ul className="space-y-3">
                  {goals.slice(0, 3).map((goal) => {
                    const key = goal._id || goal.id;
                    const progress = goal.progressPercent != null ? goal.progressPercent : (goal.target > 0 ? Math.min(100, Math.round((goal.currentBalance / goal.target) * 100)) : null);
                    return (
                      <li key={key}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium text-gray-700">{goal.name}</span>
                          <span>{progress != null ? `${progress}%` : `$${Number(goal.currentBalance || 0).toFixed(0)}`}</span>
                        </div>
                        {goal.target > 0 && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">{t('Household', 'Hogar')}</h3>
                <button 
                  onClick={() => navigate('/members')}
                  className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {t('Manage', 'Gestionar')}
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-sm">👥</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{t('Members', 'Miembros')}</div>
                      <div className="font-semibold text-gray-800">{household?.members?.length || 0}</div>
                    </div>
                  </div>
                </div>

                {pendingInvites.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        <span className="text-yellow-600 text-sm">✉️</span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">{t('Pending Invites', 'Invitaciones Pendientes')}</div>
                        <div className="font-semibold text-gray-800">{pendingInvites.length}</div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate('/members')}
                  className="w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  {t('+ Invite Members', '+ Invitar Miembros')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
