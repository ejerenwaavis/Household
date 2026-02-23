import { useState, useCallback } from 'react';
import api from '../services/api';

export function useInvite() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const acceptInvite = useCallback(async (token) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/households/invite/accept/${token}`);
      return response.data;
    } catch (err) {
      const errorMessage = err?.response?.data?.error || 'Failed to accept invite';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const declineInvite = useCallback(async (token) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/households/invite/decline/${token}`);
      return response.data;
    } catch (err) {
      const errorMessage = err?.response?.data?.error || 'Failed to decline invite';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    acceptInvite,
    declineInvite,
    clearError
  };
}
