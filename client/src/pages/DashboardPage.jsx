import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import SimpleBarChart from '../components/SimpleBarChart';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function DashboardPage(){
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [fixedExpensesTotal, setFixedExpensesTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (user?.householdId) {
      Promise.all([
        api.get(`/households/${user.householdId}/summary`)
          .then((res)=> setSummary(res.data))
          .catch((err)=> console.error('Summary load failed', err)),
        api.get(`/fixed-expenses/${user.householdId}`)
          .then((res)=> setFixedExpensesTotal(res.data.total || 0))
          .catch((err)=> console.error('Fixed expenses load failed', err))
      ]).finally(()=> setLoading(false));
    }
  }, [user]);

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
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg">{t('Logout', 'Cerrar sesi\u00f3n')}</button>
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
                subtitle={t('After all expenses', 'Despu\u00e9s de todos los gastos')} 
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
          </aside>
        </div>
      </div>
    </Layout>
  );
}
