import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function HouseholdSwitcher() {
  const { t } = useLanguage();
  const { user, switchHousehold } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHouseholds();
    }
  }, [isOpen]);

  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      const res = await api.get('/households/user/my-households');
      setHouseholds(res.data.households || []);
      console.log('[HouseholdSwitcher] fetched households', res.data.households?.length);
    } catch (err) {
      console.error('[HouseholdSwitcher] Error fetching households:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchHousehold = (householdId, householdName) => {
    console.log('[HouseholdSwitcher] STEP 1 - Starting switch to:', { householdId, householdName });
    console.log('[HouseholdSwitcher] Current user before switch:', user);
    switchHousehold(householdId, householdName);
    console.log('[HouseholdSwitcher] STEP 2 - Called switchHousehold');
    setIsOpen(false);
    
    // Add a small delay to ensure auth context updates, then reload page
    // This ensures localStorage is read fresh and all data refetches with new household ID
    setTimeout(() => {
      console.log('[HouseholdSwitcher] STEP 3 - Reloading page with window.location.href = /dashboard');
      window.location.href = '/dashboard';
    }, 100);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={t('Switch household', 'Cambiar hogar')}
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 13l4-8m4 8l-4-8m0-5l7-4" />
        </svg>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline max-w-[200px] truncate">
          {user.householdName}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal - centered on mobile, positioned on desktop */}
          <div className="fixed sm:absolute sm:right-0 sm:top-full sm:mt-2 inset-x-4 sm:inset-x-auto z-50 w-auto space-y-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg sm:w-96 sm:max-w-none">
              <div className="p-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t('Current Household', 'Hogar Actual')}
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{user.householdName}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{t('Active', 'Activo')}</div>
                  </div>
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>

                {loading ? (
                  <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : households.length > 1 ? (
                  <>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      {t('Other Households', 'Otros Hogares')}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {households.map((household) => (
                        household.householdId !== user.householdId && (
                          <button
                            key={household.householdId}
                            onClick={() => handleSwitchHousehold(household.householdId, household.householdName)}
                            className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                              <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                                {household.householdName?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white text-sm">{household.householdName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {household.members?.length || 0} {t('members', 'miembros')}
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                    <p>{t('You are only a member of this household', 'Solo eres miembro de este hogar')}</p>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('To join another household, accept the invitation through your email', 'Para unirte a otro hogar, acepta la invitación a través de tu correo')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
