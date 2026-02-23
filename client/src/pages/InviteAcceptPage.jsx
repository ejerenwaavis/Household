import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useInvite } from '../hooks/useInvite';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { loading, error, acceptInvite, declineInvite, clearError } = useInvite();
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleAccept = async () => {
    if (!token) {
      setMessage({ type: 'error', text: t('Invalid invite link', 'Enlace de invitación inválido') });
      return;
    }

    try {
      const res = await acceptInvite(token);
      console.log('[InviteAccept] accepted:', res);

      setMessage({ 
        type: 'success', 
        text: t('Successfully joined household!', '¡Te uniste al hogar exitosamente!')
      });

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('[InviteAccept] error:', err);
      setMessage({
        type: 'error',
        text: error || t('Failed to join household', 'Error al unirse al hogar')
      });
    }
  };

  const handleDecline = async () => {
    if (!token) return;

    try {
      await declineInvite(token);
      setMessage({ type: 'info', text: t('Invite declined', 'Invitación rechazada') });

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('[InviteDecline] error:', err);
      setMessage({
        type: 'error',
        text: error || t('Failed to decline invite', 'Error al rechazar invitación')
      });
    }
  };

  if (!user) {
    return <div className="text-center py-12">{t('Redirecting to login...', 'Redirigiendo a inicio de sesión...')}</div>;
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">✉️</div>
            <h1 className="text-2xl font-bold text-gray-800">
              {t('Household Invitation', 'Invitación del Hogar')}
            </h1>
          </div>

          {!message ? (
            <>
              <div className="mb-6 text-center text-gray-600">
                <p className="text-sm">
                  {t('You have been invited to join a household!', '¡Has sido invitado a unirte a un hogar!')}
                </p>
                <p className="text-sm mt-2">
                  {t('Email:', 'Email:')} <span className="font-medium">{user?.email}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-60 transition-colors"
                >
                  {t('Decline', 'Rechazar')}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? t('Joining...', 'Uniéndose...') : t('Accept', 'Aceptar')}
                </button>
              </div>
            </>
          ) : (
            <div className={`p-4 rounded-lg text-center ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <div className="text-sm font-medium">{message.text}</div>
              {message.type === 'success' && (
                <div className="text-xs mt-2">{t('Redirecting...', 'Redirigiendo...')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
