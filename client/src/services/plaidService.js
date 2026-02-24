/**
 * Plaid API Service
 * Handles all Plaid-related API calls from the frontend
 */

import axios from 'axios';

const API_BASE = '/api/plaid';

/**
 * Get all linked accounts for the current household
 */
export const getLinkedAccounts = async (authToken) => {
  try {
    const response = await axios.get(`${API_BASE}/linked-accounts`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('[PlaidService] Error fetching linked accounts:', error);
    throw error;
  }
};

/**
 * Get real-time balance for a specific linked account
 */
export const getAccountBalance = async (accountId, authToken) => {
  try {
    const response = await axios.get(`${API_BASE}/account-balance/${accountId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('[PlaidService] Error fetching account balance:', error);
    throw error;
  }
};

/**
 * Unlink a bank account from Plaid
 */
export const unlinkAccount = async (accountId, authToken) => {
  try {
    const response = await axios.delete(`${API_BASE}/unlink/${accountId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('[PlaidService] Error unlinking account:', error);
    throw error;
  }
};

/**
 * Get sync status for a linked account
 */
export const getSyncStatus = async (accountId, authToken) => {
  try {
    const response = await axios.get(`${API_BASE}/sync-status/${accountId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('[PlaidService] Error fetching sync status:', error);
    throw error;
  }
};

/**
 * Set an account as default for the household
 */
export const setDefaultAccount = async (accountId, authToken) => {
  try {
    const response = await axios.post(
      `${API_BASE}/set-default/${accountId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('[PlaidService] Error setting default account:', error);
    throw error;
  }
};

export default {
  getLinkedAccounts,
  getAccountBalance,
  unlinkAccount,
  getSyncStatus,
  setDefaultAccount
};
