import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function PendingTasksWidget() {
  const { pendingInvites, login, user, token } = useAuth();
  const { inviteModalOpen, setInviteModalOpen } = useNotifications();
  const { t } = useLanguage();
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState(null);

  if (!pendingInvites || pendingInvites.length === 0 || !inviteModalOpen) {
    return null;
  }

  // Show the first pending invite in the banner; user cycles through by acting on each
  const invite = pendingInvites[0];

  const handleAccept = async () => {
    setProcessing('accept');
    setError(null);
    try {
      const response = await api.post(`/households/invite/accept/${invite.inviteToken}`);
      const remaining = pendingInvites.slice(1);
      if (response.data.household) {
        login(
          { ...user, householdId: response.data.household.householdId, householdName: response.data.household.householdName },
          token,
          remaining
        );
      } else {
        login(user, token, remaining);
      }
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to accept invite', 'Error al aceptar invitación'));
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async () => {
    setProcessing('decline');
    setError(null);
    try {
      await api.post(`/households/invite/decline/${invite.inviteToken}`);
      login(user, token, pendingInvites.slice(1));
    } catch (err) {
      setError(err.response?.data?.error || t('Failed to decline invite', 'Error al rechazar invitación'));
    } finally {
      setProcessing(null);
    }
  };

  const banner = (
    <>
      {/* Blurred backdrop — sits behind the modal, above the page */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]"
        onClick={() => setInviteModalOpen(false)}
      />

      {/* Modal card — centered, above the backdrop */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-700 overflow-hidden">

          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xl">
                  ✉️
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {t('Household Invitation', 'Invitación del Hogar')}
                  </h2>
                  {pendingInvites.length > 1 && (
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                      {pendingInvites.length} {t('pending invitations', 'invitaciones pendientes')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Dismiss"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Invite details */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{invite.invitedByName || 'Someone'}</span>
                {' '}{t('invited you to join', 'te invitó a unirte a')}
              </p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {invite.householdName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {t('Expires', 'Expira')} {new Date(invite.expiresAt || Date.now()).toLocaleDateString()}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                disabled={!!processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-sm transition-colors disabled:opacity-60"
              >
                {processing === 'decline' ? <Spinner /> : t('Decline', 'Rechazar')}
              </button>
              <button
                onClick={handleAccept}
                disabled={!!processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors disabled:opacity-60 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
              >
                {processing === 'accept' ? <Spinner /> : t('Accept', 'Aceptar')}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
              {t('Click outside to dismiss — find it again in the 🔔 bell', 'Haz clic fuera para cerrar — encuéntralo en la 🔔 campana')}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(banner, document.body);
}
