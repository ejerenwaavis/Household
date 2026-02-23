import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import Layout from '../components/Layout';
import HouseholdInviteForm from '../components/HouseholdInviteForm';
import api from '../services/api';

export default function MemberManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [household, setHousehold] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!user?.householdId) return;
    
    try {
      setLoading(true);
      const [householdRes, invitesRes] = await Promise.all([
        api.get(`/households/${user.householdId}`),
        api.get(`/households/${user.householdId}/invites`)
      ]);

      setHousehold(householdRes.data);
      setPendingInvites(invitesRes.data.invites || []);
      setError(null);
    } catch (err) {
      console.error('[MemberManagement] Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to load member data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.householdId]);

  const handleCancelInvite = async (inviteId) => {
    if (!confirm(t('Are you sure you want to cancel this invite?', '¿Seguro que quieres cancelar esta invitación?'))) {
      return;
    }

    try {
      await api.delete(`/households/${user.householdId}/invites/${inviteId}`);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('[MemberManagement] Error canceling invite:', err);
      alert(err.response?.data?.error || t('Failed to cancel invite', 'Error al cancelar invitación'));
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm(t('Are you sure you want to remove this member?', '¿Seguro que quieres eliminar este miembro?'))) {
      return;
    }

    try {
      await api.delete(`/households/${user.householdId}/members/${memberId}`);
      fetchData(); // Refresh data
    } catch (err) {
      console.error('[MemberManagement] Error removing member:', err);
      alert(err.response?.data?.error || t('Failed to remove member', 'Error al eliminar miembro'));
    }
  };

  const isHeadOfHouse = household?.headOfHouseId?.toString() === user?.userId?.toString();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('Loading...', 'Cargando...')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            {t('Member Management', 'Gestión de Miembros')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('Manage household members and invitations', 'Gestionar miembros e invitaciones del hogar')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Members */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {t('Household Members', 'Miembros del Hogar')}
              </h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {household?.members?.length || 0}
              </span>
            </div>

            {household?.members && household.members.length > 0 ? (
              <div className="space-y-3">
                {household.members.map((member, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {member.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{member.name || 'Member'}</div>
                        <div className="text-sm text-gray-500">{member.email || ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          {member.role}
                        </span>
                      )}
                      {isHeadOfHouse && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-red-600 hover:text-red-800 text-sm px-2"
                          title={t('Remove member', 'Eliminar miembro')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>{t('No members yet', 'Sin miembros aún')}</p>
              </div>
            )}
          </div>

          {/* Invite Members */}
          <div>
            <HouseholdInviteForm 
              householdId={user?.householdId} 
              onInviteSent={fetchData}
            />
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {t('Pending Invitations', 'Invitaciones Pendientes')}
              </h2>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                {pendingInvites.length}
              </span>
            </div>

            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite._id}
                  className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{invite.email}</span>
                      <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs">
                        {t('Pending', 'Pendiente')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {t('Invited by', 'Invitado por')}: {invite.invitedByName || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('Sent', 'Enviado')}: {new Date(invite.createdAt).toLocaleDateString()}
                      {' • '}
                      {t('Expires', 'Expira')}: {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/invite/${invite.inviteToken}`;
                        navigator.clipboard.writeText(link);
                        alert(t('Link copied!', '¡Enlace copiado!'));
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      {t('Copy Link', 'Copiar Enlace')}
                    </button>
                    {isHeadOfHouse && (
                      <button
                        onClick={() => handleCancelInvite(invite._id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        {t('Cancel', 'Cancelar')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
