import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function HouseholdMembersWidget({ householdId }) {
  const { t } = useLanguage();
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (householdId) {
      fetchHousehold();
    }
  }, [householdId]);

  const fetchHousehold = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/households/${householdId}`);
      setHousehold(res.data);
    } catch (err) {
      console.error('[HouseholdMembersWidget] Error fetching household:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!household?.members || household.members.length === 0) {
    return null;
  }

  const totalIncomePercentage = household.members.reduce((sum, m) => sum + (m.incomePercentage || 0), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {t('Household Members', 'Miembros del Hogar')}
      </h3>

      <div className="space-y-3">
        {household.members.map((member) => (
          <div key={member.userId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-xs">
                  {member.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {member.name || 'Member'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {member.email || ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {member.incomePercentage > 0 ? (
                <div className="text-right">
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {member.incomePercentage}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {t('Income', 'Ingresos')}
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-sm text-gray-400 dark:text-gray-500">—</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {t('No split', 'Sin división')}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalIncomePercentage !== 100 && household.members.some(m => m.incomePercentage > 0) && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-medium">{t('Note:', 'Nota:')}</span> {t('Income split total is {{total}}%', `El total de la división de ingresos es ${totalIncomePercentage}%`).replace('{{total}}', totalIncomePercentage)}
          </div>
        </div>
      )}

      {household.members.some(m => m.responsibilities && m.responsibilities.length > 0) && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase">
            {t('Responsibilities', 'Responsabilidades')}
          </div>
          <div className="space-y-2">
            {household.members.map((member) => {
              if (!member.responsibilities || member.responsibilities.length === 0) return null;
              return (
                <div key={member.userId} className="text-xs">
                  <span className="font-medium text-gray-900 dark:text-white">{member.name}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.responsibilities.map((resp) => (
                      <span
                        key={resp}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                      >
                        {resp.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
