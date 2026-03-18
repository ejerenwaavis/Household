import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

/**
 * A slim, persistent but unobtrusive top banner shown when the user's email
 * is not yet verified. Disappears the moment the account is verified.
 * Includes a "Resend email" button with a cooldown so it can't be spammed.
 */
export default function EmailVerificationBanner() {
  const { user, updateUser } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  // Don't show if verified, frozen (separate UI handles that), or dismissed for this session
  if (!user || user.emailVerified || user.accountFrozen || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await api.post('/auth/resend-verification');
      setResent(true);
      // Reset after 60 seconds
      setTimeout(() => setResent(false), 60_000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-amber-500 flex-shrink-0">⚠️</span>
        <span className="text-amber-800 font-medium truncate">
          Please verify your email address —{' '}
          <span className="font-normal">check your inbox for the confirmation link.</span>
        </span>
        {error && <span className="text-red-600 text-xs ml-2">{error}</span>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {resent ? (
          <span className="text-green-700 text-xs font-medium">Email resent ✓</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs text-amber-700 hover:text-amber-900 underline underline-offset-2 disabled:opacity-50 transition-colors"
          >
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-amber-400 hover:text-amber-600 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
