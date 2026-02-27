import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useLanguage } from '../context/LanguageContext';

function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_ICON = {
  invite: '✉️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: '🔔',
};

const TYPE_BG = {
  invite:  'bg-indigo-100 dark:bg-indigo-900/40',
  success: 'bg-green-100 dark:bg-green-900/40',
  warning: 'bg-yellow-100 dark:bg-yellow-900/40',
  error:   'bg-red-100 dark:bg-red-900/40',
  info:    'bg-gray-100 dark:bg-gray-700',
};

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
    setInviteModalOpen,
  } = useNotifications();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleViewInvite = (notif) => {
    markRead(notif.id);
    setInviteModalOpen(true);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={t('Notifications', 'Notificaciones')}
        aria-label={t('Notifications', 'Notificaciones')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-600 dark:text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {t('Notifications', 'Notificaciones')}
              {unreadCount > 0 && (
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">
                  {unreadCount} {t('new', 'nuevos')}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                {t('Mark all read', 'Marcar todo leído')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl mb-3">🔔</div>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t("You're all caught up!", '¡Estás al día!')}
                </p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                    notif.read ? 'bg-white dark:bg-gray-800' : 'bg-indigo-50/60 dark:bg-indigo-900/10'
                  }`}
                >
                  {/* Type icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base ${TYPE_BG[notif.type] || TYPE_BG.info}`}>
                    {TYPE_ICON[notif.type] || '🔔'}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${notif.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {notif.body}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatTime(notif.createdAt)}
                      </span>
                      {notif.type === 'invite' && (
                        <button
                          onClick={() => handleViewInvite(notif)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                          {t('View Invitation →', 'Ver Invitación →')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Unread dot + dismiss */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2 pt-0.5">
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                    <button
                      onClick={() => removeNotification(notif.id)}
                      className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors mt-1"
                      title={t('Dismiss', 'Descartar')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 flex justify-end">
              <button
                onClick={() => { clearAll(); setOpen(false); }}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                {t('Clear all', 'Borrar todo')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
