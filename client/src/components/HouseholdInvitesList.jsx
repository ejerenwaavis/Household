import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function HouseholdInvitesList({ householdId }) {
  const { t } = useLanguage();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvites();
  }, [householdId]);

  const fetchInvites = async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const res = await api.get(`/households/${householdId}/invites`);
      setInvites(res.data.invites || []);
    } catch (err) {
      console.error('[HouseholdInvitesList] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async (invite) => {
    try {
      await api.post(`/households/${householdId}/invite`, { email: invite.email });
      await fetchInvites();
      alert(t('Invite resent!', '¡Invitación reenviada!'));
    } catch (err) {
      alert(err?.response?.data?.error || t('Failed to resend', 'Error al reenviar'));
    }
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">{t('Loading...', 'Cargando...')}</div>;
  }

  if (invites.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <div className="text-sm">{t('No pending invites', 'Sin invitaciones pendientes')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        {t('Pending Invites', 'Invitaciones Pendientes')} ({invites.length})
      </h3>

      <div className="space-y-3">
        {invites.map((invite) => {
          const expiresIn = Math.ceil((new Date(invite.expiresAt) - new Date()) / (24 * 60 * 60 * 1000));
          const isExpiringSoon = expiresIn <= 3;

          return (
            <div key={invite._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {invite.email}
                </div>
                <div className={`text-xs ${isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t('Expires in', 'Expira en')} {expiresIn} {t('days', 'días')}
                </div>
              </div>

              <button
                onClick={() => handleResendInvite(invite)}
                className="ml-2 px-3 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 whitespace-nowrap transition-colors"
              >
                {t('Resend', 'Reenviar')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
