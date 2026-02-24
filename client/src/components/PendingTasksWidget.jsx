import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function PendingTasksWidget() {
  const { pendingInvites, login, user, token } = useAuth();
  const { t } = useLanguage();
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState(null);

  if (!pendingInvites || pendingInvites.length === 0) {
    return null;
  }

  const handleAccept = async (inviteToken) => {
    setProcessing(inviteToken);
    setError(null);
    try {
      const response = await api.post(`/households/invite/accept/${inviteToken}`);
      console.log('Invite accepted:', response.data);

      // Update auth context with new household info
      if (response.data.household) {
        login(
          {
            ...user,
            householdId: response.data.household.householdId,
            householdName: response.data.household.householdName,
          },
          token,
          pendingInvites.filter(inv => inv.inviteToken !== inviteToken)
        );
      } else {
        // Just remove the accepted invite
        login(user, token, pendingInvites.filter(inv => inv.inviteToken !== inviteToken));
      }
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(err.response?.data?.error || 'Failed to accept invite');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (inviteToken) => {
    setProcessing(inviteToken);
    setError(null);
    try {
      await api.post(`/households/invite/decline/${inviteToken}`);
      console.log('Invite declined:', inviteToken);

      // Remove the declined invite from pending
      login(user, token, pendingInvites.filter(inv => inv.inviteToken !== inviteToken));
    } catch (err) {
      console.error('Failed to decline invite:', err);
      setError(err.response?.data?.error || 'Failed to decline invite');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 shadow-md border border-blue-200 dark:border-indigo-900 mb-6 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('Pending Actions', 'Acciones Pendientes')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('You have pending household invitations', 'Tienes invitaciones pendientes de hogar')}
          </p>
        </div>
        <span className="inline-block bg-blue-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
          {pendingInvites.length}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {pendingInvites.map((invite) => (
          <div
            key={invite.id || invite.inviteToken}
            className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                  {t('Household Invitation', 'Invitación del Hogar')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  <span className="font-medium">{invite.invitedByName || 'Unknown'}</span> {t('invited you to join', 'te invitó a unirte a')}
                </p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                  {invite.householdName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {t('Expires', 'Expira')} {new Date(invite.expiresAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDecline(invite.inviteToken)}
                disabled={processing === invite.inviteToken}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
              >
                {processing === invite.inviteToken ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </span>
                ) : (
                  t('Decline', 'Rechazar')
                )}
              </button>
              <button
                onClick={() => handleAccept(invite.inviteToken)}
                disabled={processing === invite.inviteToken}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-60"
              >
                {processing === invite.inviteToken ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </span>
                ) : (
                  t('Accept', 'Aceptar')
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        {t('These invitations will expire in 30 days', 'Estas invitaciones expirarán en 30 días')}
      </p>
    </div>
  );
}
