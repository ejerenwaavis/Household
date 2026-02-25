import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import Layout from '../components/Layout';
import HouseholdInviteForm from '../components/HouseholdInviteForm';
import MemberDetailsModal from '../components/MemberDetailsModal';
import api from '../services/api';

export default function MemberManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [household, setHousehold] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

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
  
  // Role-based access control: Check if user is admin
  const canManageMembers = () => {
    if (!household?.members || !user?.userId) {
      console.log('[MemberManagement] Cannot manage: missing household.members or user.userId', {
        hasMembers: !!household?.members,
        userId: user?.userId
      });
      return false;
    }
    
    const userMember = household.members.find(m => m.userId === user.userId);
    console.log('[MemberManagement] User member found:', userMember);
    
    // Admin or owner can manage members
    const canManage = userMember && (userMember.role === 'admin' || userMember.role === 'owner');
    console.log('[MemberManagement] Can manage members?', canManage, 'User role:', userMember?.role);
    
    return canManage;
  };

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('Member Management', 'Gestión de Miembros')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {t('Manage household members and invitations', 'Gestionar miembros e invitaciones del hogar')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Members */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('Household Members', 'Miembros del Hogar')}
              </h2>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                {household?.members?.length || 0}
              </span>
            </div>

            {household?.members && household.members.length > 0 ? (
              <div className="space-y-3">
                {household.members.map((member, idx) => (
                  <button
                    key={idx}
                    onClick={() => canManageMembers() && setSelectedMember(member)}
                    className={`w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg transition ${
                      canManageMembers()
                        ? 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer hover:shadow-md'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-sm">
                          {member.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{member.name || 'Member'}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{member.email || ''}</div>
                        {member.incomePercentage > 0 && (
                          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {t('Income Contribution', 'Contribución de Ingresos')}: {member.incomePercentage}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {member.role && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          {member.role}
                        </span>
                      )}
                      {canManageMembers() ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMember(member);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-sm px-2"
                            title={t('Edit member', 'Editar miembro')}
                          >
                            ✎
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMember(member.userId);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm px-2"
                            title={t('Remove member', 'Eliminar miembro')}
                          >
                            ✕
                          </button>
                        </>
                      ) : null}
                    </div>
                  </button>
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
            {canManageMembers() ? (
              <HouseholdInviteForm 
                householdId={user?.householdId} 
                onInviteSent={fetchData}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  {t('Invite Members', 'Invitar Miembros')}
                </h2>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        {t('Higher Access Privilege Required', 'Se Requiere Mayor Privilegio de Acceso')}
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {t('Only the household owner can invite members. Contact the household owner to add new members.', 'Solo el propietario del hogar puede invitar a miembros. Comuníquese con el propietario del hogar para agregar nuevos miembros.')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
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
                      <span className="font-medium text-gray-900 dark:text-white">{invite.email}</span>
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
                    {canManageMembers() && (
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

        {/* Member Details Modal */}
        {selectedMember && (
          <MemberDetailsModal
            member={selectedMember}
            householdId={user?.householdId}
            allMembers={household?.members}
            onClose={() => setSelectedMember(null)}
            onSave={(updatedMember) => {
              // Update household members list
              setHousehold(prev => ({
                ...prev,
                members: prev.members.map(m => 
                  m.userId === updatedMember.userId ? updatedMember : m
                )
              }));
              setSelectedMember(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}
