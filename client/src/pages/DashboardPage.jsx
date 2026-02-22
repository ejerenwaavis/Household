import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';
import SimpleBarChart from '../components/SimpleBarChart';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function DashboardPage(){
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (user?.householdId) {
      api.get(`/households/${user.householdId}/summary`)
        .then((res)=> setSummary(res.data))
        .catch((err)=> console.error('Summary load failed', err))
        .finally(()=> setLoading(false));
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
            <h1 className="text-2xl font-bold text-gray-800">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="text-sm text-gray-500">Household: {user?.householdName || '—'}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard title="Total Income" value={summary ? `$${summary.totalIncome.toFixed(2)}` : '$0.00'} subtitle="This month" accent="bg-green-500" />
          <MetricCard title="Total Expenses" value={summary ? `$${summary.totalExpenses.toFixed(2)}` : '$0.00'} subtitle="This month" accent="bg-red-500" />
          <MetricCard title="Balance" value={summary ? `$${summary.balance.toFixed(2)}` : '$0.00'} subtitle="Available" accent="bg-blue-500" />
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SimpleBarChart data={chartData} labels={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']} />
          </div>

          <aside>
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Recent Activity</h3>
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
