/**
 * Transaction API Service
 * Handles all transaction-related API calls from the frontend
 */

import api from './api';

const API_BASE = '/plaid';

/**
 * Get transactions for a specific account or all accounts
 */
export const getTransactions = async (params, authToken) => {
  try {
    const response = await api.get(`${API_BASE}/transactions`, { params });
    return response.data;
  } catch (error) {
    console.error('[TransactionService] Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Get a specific transaction
 */
export const getTransaction = async (transactionId, authToken) => {
  try {
    const response = await api.get(`${API_BASE}/transactions/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error('[TransactionService] Error fetching transaction:', error);
    throw error;
  }
};

/**
 * Update a transaction (category, reconciliation status, etc.)
 */
export const updateTransaction = async (transactionId, updates, authToken) => {
  try {
    const response = await api.patch(`${API_BASE}/transactions/${transactionId}`, updates);
    return response.data;
  } catch (error) {
    console.error('[TransactionService] Error updating transaction:', error);
    throw error;
  }
};

/**
 * Get transaction summary/statistics
 */
export const getTransactionsSummary = async (params, authToken) => {
  try {
    const response = await api.get(`${API_BASE}/transactions-summary`, { params });
    return response.data;
  } catch (error) {
    console.error('[TransactionService] Error fetching summary:', error);
    throw error;
  }
};

export default {
  getTransactions,
  getTransaction,
  updateTransaction,
  getTransactionsSummary
};
