import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function IncomeSplitExpectations({ householdId, fixedExpensesTotal = 0, currentMonthIncome = [] }) {
  const { t } = useLanguage();
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (householdId) {
      fetchSplits();
    }
  }, [householdId]);

  const fetchSplits = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/income-splits/${householdId}`);
      setSplits(res.data.splits || []);
    } catch (err) {
      console.error('[IncomeSplitExpectations] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate expected weekly contribution per member
  const weeklyFixedExpenses = fixedExpensesTotal / 4.33; // Average weeks per month

  // Group income by member
  const incomeByMember = {};
  currentMonthIncome.forEach((income) => {
    const memberId = income.contributedBy || 'unassigned';
    if (!incomeByMember[memberId]) {
      incomeByMember[memberId] = [];
    }
    incomeByMember[memberId].push(income);
  });

  if (loading) {
    return <div className="text-gray-500">{t('Loading...', 'Cargando...')}</div>;
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {t('Income Expectations vs Actual', 'Expectativas de Ingresos vs Real')}
      </h3>

      <div className="space-y-4">
        {splits.map((split) => {
          const expectedWeekly = weeklyFixedExpenses * (split.splitPercentage / 100);
          const memberIncomes = incomeByMember[String(split.userId._id || split.userId)] || [];
          const actualWeekly = memberIncomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
          const shortage = Math.max(0, expectedWeekly - actualWeekly);
          const isShort = shortage > 0;
          const isMetOrExceeded = actualWeekly >= expectedWeekly;

          return (
            <div key={split._id} className={`p-4 rounded-lg border ${isMetOrExceeded ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-gray-700">
                    {split.userId.name || split.userName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {split.splitPercentage}% {t('of fixed expenses', 'de gastos fijos')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="bg-white rounded p-2 border border-gray-200">
                  <div className="text-xs text-gray-500">{t('Expected', 'Esperado')}</div>
                  <div className="text-lg font-bold text-indigo-600">
                    ${expectedWeekly.toFixed(2)}
                  </div>
                </div>

                <div className="bg-white rounded p-2 border border-gray-200">
                  <div className="text-xs text-gray-500">{t('Actual', 'Real')}</div>
                  <div className="text-lg font-bold text-gray-700">
                    ${actualWeekly.toFixed(2)}
                  </div>
                </div>

                <div className={`rounded p-2 border ${isShort ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="text-xs text-gray-500">{t('Short', 'Falta')}</div>
                  <div className={`text-lg font-bold ${isShort ? 'text-red-600' : 'text-green-600'}`}>
                    ${shortage.toFixed(2)}
                  </div>
                </div>
              </div>

              {isShort && (
                <div className="text-xs text-red-600 mt-2">
                  {t('Still needs to contribute: $', 'Aún necesita contribuir: $')}{shortage.toFixed(2)}
                </div>
              )}

              {isMetOrExceeded && (
                <div className="text-xs text-green-600 mt-2">
                  ✓ {t('Target met!', '¡Meta alcanzada!')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-xs text-gray-600">
        <div className="font-semibold text-indigo-700 mb-1">
          {t('Weekly Fixed Expenses Target', 'Meta Semanal de Gastos Fijos')}: ${weeklyFixedExpenses.toFixed(2)}
        </div>
        <div className="text-indigo-600">
          {t('Based on: Total Fixed ($', 'Basado en: Total Fijo ($')}{fixedExpensesTotal.toFixed(2)}{t(') ÷ 4.33 weeks', ') ÷ 4.33 semanas')}
        </div>
      </div>
    </div>
  );
}
