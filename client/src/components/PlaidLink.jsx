/**
 * Plaid Link Component
 * Wrapper for Plaid Link flow to securely connect bank accounts
 */

import { useCallback, useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const PlaidLink = ({ onSuccess, onExit }) => {
  useAuth(); // ensures user is authenticated
  const [loading, setLoading] = useState(false);
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Create link token from backend
   * This token is required to initialize Plaid Link
   */
  const createLinkToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/plaid/create-link-token', {});

      if (response.data.linkToken) {
        setLinkToken(response.data.linkToken);
        console.log('[PlaidLink] Link token created successfully');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create link token';
      console.error('[PlaidLink] Error creating link token:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle successful Plaid Link flow
   * Exchange public token for access token
   */
  const handleOnSuccess = useCallback(async (publicToken, metadata) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[PlaidLink] Public token received, exchanging...', {
        institution: metadata?.institution?.name,
        accountsCount: metadata?.accounts?.length
      });

      // Exchange public token for access token
      const response = await api.post('/plaid/exchange-token', { publicToken, metadata });

      console.log('[PlaidLink] Token exchanged successfully', {
        linkedAccounts: response.data.linkedAccounts.length
      });

      // Notify parent component
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to link account';
      console.error('[PlaidLink] Error exchanging token:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  /**
   * Handle Plaid Link exit (user closes or error occurs)
   */
  const handleOnExit = useCallback((error, metadata) => {
    if (error) {
      console.warn('[PlaidLink] Plaid Link exit with error:', {
        errorType: error.error_type,
        errorCode: error.error_code,
        errorMessage: error.error_message
      });
      setError(error.error_message || 'Plaid Link encountered an error');
    } else {
      console.log('[PlaidLink] Plaid Link exited by user');
    }

    // Notify parent component
    if (onExit) {
      onExit(error, metadata);
    }
  }, [onExit]);

  /**
   * Initialize Plaid Link
   */
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit
  });

  /**
   * Auto-open Plaid Link once token is ready
   */
  useEffect(() => {
    if (ready && linkToken) {
      open();
    }
  }, [ready, linkToken, open]);

  /**
   * Open Plaid Link when button is clicked
   */
  const handleConnectBank = () => {
    if (!linkToken && !loading) {
      createLinkToken();
    } else if (ready && linkToken) {
      open();
    }
  };

  return (
    <div className="plaid-link-container">
      <button
        onClick={handleConnectBank}
        disabled={loading}
        className={`
          px-6 py-3 rounded-lg font-medium transition-all
          ${loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Preparing...
          </span>
        ) : (
          '🏦 Connect Bank Account'
        )}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PlaidLink;
