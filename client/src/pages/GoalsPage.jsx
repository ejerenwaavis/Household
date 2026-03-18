import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import GoalForm from '../components/GoalForm';
import GoalList from '../components/GoalList';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import SkeletonBlock from '../components/SkeletonBlock';

export default function GoalsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [totalMonthlyContribution, setTotalMonthlyContribution] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchGoals = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      console.log('[GoalsPage] fetching goals for householdId:', user.householdId);
      const [goalsRes, acctRes] = await Promise.all([
        api.get(`/goals/${user.householdId}`),
        api.get('/plaid/linked-accounts').catch(() => ({ data: { linkedAccounts: [] } })),
      ]);
      setGoals(goalsRes.data.goals || []);
      setTotalMonthlyContribution(goalsRes.data.totalMonthlyContribution || 0);
      setLinkedAccounts(acctRes.data.linkedAccounts || []);
    } catch (err) {
      console.error('[GoalsPage] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGoals(); }, [user]);

  const handleCreated = () => {
    fetchGoals();
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('Goals & Funds', 'Metas y Fondos')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('Track your savings goals and financial targets.', 'Rastrea tus metas de ahorro y objetivos financieros.')}
          </p>
        </div>

        {showForm && (
          <GoalForm householdId={user?.householdId} linkedAccounts={linkedAccounts} onCreated={handleCreated} />
        )}

        <div className="mt-4 mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            {showForm ? t('Cancel', 'Cancelar') : t('+ Add Goal', '+ Agregar Objetivo')}
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <SkeletonBlock className="h-5 w-40 rounded" />
                  <SkeletonBlock className="h-5 w-20 rounded" />
                </div>
                <SkeletonBlock className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <SkeletonBlock className="h-3 w-24 rounded" />
                  <SkeletonBlock className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GoalList
            householdId={user?.householdId}
            goals={goals}
            linkedAccounts={linkedAccounts}
            totalMonthlyContribution={totalMonthlyContribution}
            loading={loading}
            refresh={fetchGoals}
          />
        )}
      </div>
    </Layout>
  );
}
