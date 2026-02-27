import { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export const NotificationContext = createContext();

function loadFromStorage() {
  try { return JSON.parse(localStorage.getItem('hh_notifications') || '[]'); }
  catch { return []; }
}

export function NotificationProvider({ children }) {
  const { user, pendingInvites } = useAuth();
  const [notifications, setNotifications] = useState(loadFromStorage);
  // Controls whether the invite modal is currently shown
  const [inviteModalOpen, setInviteModalOpen] = useState(true);

  const persist = (updated) => {
    localStorage.setItem('hh_notifications', JSON.stringify(updated));
    return updated;
  };

  // Clear notifications on logout
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      localStorage.removeItem('hh_notifications');
    }
  }, [user]);

  // Sync pendingInvites → notification entries
  useEffect(() => {
    setNotifications(prev => {
      const currentTokens = new Set((pendingInvites || []).map(inv => inv.inviteToken));

      // Remove stale invite notifications no longer in pendingInvites
      const cleaned = prev.filter(
        n => n.type !== 'invite' || currentTokens.has(n.data?.inviteToken)
      );

      // Add entries for new invites not already tracked
      const existingTokens = new Set(
        cleaned.filter(n => n.type === 'invite').map(n => n.data?.inviteToken)
      );
      const newNotifs = (pendingInvites || [])
        .filter(inv => !existingTokens.has(inv.inviteToken))
        .map(inv => ({
          id: `invite-${inv.inviteToken}`,
          type: 'invite',
          title: 'Household Invitation',
          body: `${inv.invitedByName || 'Someone'} invited you to join ${inv.householdName}`,
          data: inv,
          read: false,
          createdAt: new Date().toISOString(),
        }));

      const updated = newNotifs.length ? [...newNotifs, ...cleaned] : cleaned;
      return persist(updated);
    });

    // Auto-open the modal whenever a new invite arrives
    if (pendingInvites?.length) setInviteModalOpen(true);
  }, [pendingInvites]);

  const markRead = useCallback((id) => {
    setNotifications(prev => persist(prev.map(n => n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => persist(prev.map(n => ({ ...n, read: true }))));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => persist(prev.filter(n => n.id !== id)));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem('hh_notifications');
  }, []);

  const addNotification = useCallback(({ type = 'info', title, body, data = null }) => {
    const notif = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => persist([notif, ...prev]));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      inviteModalOpen,
      setInviteModalOpen,
      addNotification,
      markRead,
      markAllRead,
      removeNotification,
      clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}
