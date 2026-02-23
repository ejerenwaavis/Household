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
    return <div className="text-gray-500">{t('Loading...', 'Cargando...')}</div>;
  }

  if (invites.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-sm">{t('No pending invites', 'Sin invitaciones pendientes')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {t('Pending Invites', 'Invitaciones Pendientes')} ({invites.length})
      </h3>

      <div className="space-y-3">
        {invites.map((invite) => {
          const expiresIn = Math.ceil((new Date(invite.expiresAt) - new Date()) / (24 * 60 * 60 * 1000));
          const isExpiringSoon = expiresIn <= 3;

          return (
            <div key={invite._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {invite.email}
                </div>
                <div className={`text-xs ${isExpiringSoon ? 'text-orange-600' : 'text-gray-500'}`}>
                  {t('Expires in', 'Expira en')} {expiresIn} {t('days', 'días')}
                </div>
              </div>

              <button
                onClick={() => handleResendInvite(invite)}
                className="ml-2 px-3 py-1 text-xs bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 whitespace-nowrap"
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
