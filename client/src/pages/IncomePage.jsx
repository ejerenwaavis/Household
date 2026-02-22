import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import IncomeForm from '../components/IncomeForm';
import IncomeList from '../components/IncomeList';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

export default function IncomePage(){
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [weeklyTotals, setWeeklyTotals] = useState([0,0,0,0]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCurrentMonth = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      console.log('[IncomePage] fetching month:', monthStr, 'householdId:', user.householdId);
      const res = await api.get(`/income/${user.householdId}/${monthStr}`);
      console.log('[IncomePage] fetch response:', res && res.data);
      const incomes = res.data.income || [];
      setEntries(incomes);
      setWeeklyTotals(res.data.weeklyTotals || [0,0,0,0]);
      setMonthTotal(res.data.total || 0);
    } catch (err) {
      console.error('[IncomePage] Failed to load incomes', err, err?.response?.data);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchCurrentMonth(); }, [user]);

  const handleCreated = (newEntry) => {
    // Prepend to list for instant feedback
    setEntries(prev => [newEntry, ...prev]);
  };

  // compute current week index (1-4)
  const now = new Date();
  const currentWeek = Math.min(4, Math.ceil(now.getDate() / 7));
  const weekEntries = entries.filter(e => Number(e.week) === Number(currentWeek));

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Add Income</h1>
          <p className="text-sm text-gray-500">Quickly log daily income for your household.</p>
        </div>

        <IncomeForm householdId={user?.householdId} onCreated={handleCreated} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-medium mb-3">This week</h2>
            <IncomeList householdId={user?.householdId} loading={loading} entries={weekEntries} refresh={fetchCurrentMonth} />
          </div>

          <aside>
            <h2 className="text-lg font-medium mb-3">This month</h2>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Total Income</div>
                    <div className="text-2xl font-semibold text-gray-800">${monthTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-1">This month</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                <div className="text-sm text-gray-600 font-medium mb-2">Weekly totals</div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  {weeklyTotals.map((w, i) => (
                    <div key={i} className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-400">W{i+1}</div>
                      <div className="font-semibold text-gray-800">${Number(w || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
