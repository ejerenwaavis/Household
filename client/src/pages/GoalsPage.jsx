import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import GoalForm from '../components/GoalForm';
import GoalList from '../components/GoalList';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function GoalsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [goals, setGoals] = useState([]);
  const [totalMonthlyContribution, setTotalMonthlyContribution] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchGoals = async () => {
    if (!user?.householdId) return;
    setLoading(true);
    try {
      console.log('[GoalsPage] fetching goals for householdId:', user.householdId);
      const res = await api.get(`/goals/${user.householdId}`);
      setGoals(res.data.goals || []);
      setTotalMonthlyContribution(res.data.totalMonthlyContribution || 0);
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
          <h1 className="text-2xl font-bold">{t('Goals & Funds', 'Metas y Fondos')}</h1>
          <p className="text-sm text-gray-500">
            {t('Track your savings goals and financial targets.', 'Rastrea tus metas de ahorro y objetivos financieros.')}
          </p>
        </div>

        {showForm && (
          <GoalForm householdId={user?.householdId} onCreated={handleCreated} />
        )}

        <div className="mt-4 mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            {showForm ? t('Cancel', 'Cancelar') : t('+ Add Goal', '+ Agregar Objetivo')}
          </button>
        </div>

        <GoalList
          householdId={user?.householdId}
          goals={goals}
          totalMonthlyContribution={totalMonthlyContribution}
          loading={loading}
          refresh={fetchGoals}
        />
      </div>
    </Layout>
  );
}
