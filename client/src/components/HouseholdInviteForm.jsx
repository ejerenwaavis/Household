import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

export default function HouseholdInviteForm({ householdId, onInviteSent }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return alert(t('Enter an email', 'Ingresa un email'));

    setLoading(true);
    try {
      const res = await api.post(`/households/${householdId}/invite`, { email });
      console.log('[HouseholdInviteForm] invite sent:', res.data);
      
      setInviteToken(res.data.invite.inviteToken);
      setMessage({
        type: 'success',
        text: t('Invite sent! Share the link below.', '¡Invitación enviada! Comparte el enlace abajo.')
      });
      setEmail('');
      onInviteSent && onInviteSent();
    } catch (err) {
      console.error('[HouseholdInviteForm] error:', err);
      setMessage({
        type: 'error',
        text: err?.response?.data?.error || t('Failed to send invite', 'Error al enviar invitación')
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    if (!inviteToken) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${inviteToken}`;
  };

  const copyToClipboard = () => {
    const link = generateInviteLink();
    navigator.clipboard.writeText(link);
    alert(t('Link copied!', '¡Enlace copiado!'));
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {t('Invite Members to Household', 'Invitar Miembros al Hogar')}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">
            {t('Email Address', 'Dirección de Email')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {loading ? t('Sending...', 'Enviando...') : t('Send Invite', 'Enviar Invitación')}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="text-sm font-medium">{message.text}</div>
        </div>
      )}

      {inviteToken && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-700 font-medium mb-2">
            {t('Invite Link', 'Enlace de Invitación')}:
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generateInviteLink()}
              className="flex-1 p-2 bg-white border rounded text-xs"
            />
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              {t('Copy', 'Copiar')}
            </button>
          </div>
          <div className="text-xs text-blue-600 mt-2">
            {t('Link expires in 30 days', 'El enlace expira en 30 días')}
          </div>
        </div>
      )}
    </div>
  );
}
