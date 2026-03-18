import { useState } from 'react';
import api from '../services/api';

/**
 * Shown once after login if the account is frozen (unverified after 7 days).
 * Unlike the banner this is a modal and cannot be dismissed without action.
 */
export default function AccountFrozenModal({ open, onClose }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v-3m0-4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Frozen</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Your account was frozen because your email address wasn't verified within 7 days of
          registration. Send a new verification link to restore access.
        </p>

        {resent ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
            ✅ Verification email sent — check your inbox and click the link.
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">
                {error}
              </p>
            )}
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 mb-3"
            >
              {resending ? 'Sending…' : 'Send Verification Email'}
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          Continue to App
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Some features will be restricted until your email is verified.
        </p>
      </div>
    </div>
  );
}
