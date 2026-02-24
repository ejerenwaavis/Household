/**
 * LinkedAccount Model
 * Stores information about bank accounts linked via Plaid
 */

import mongoose from 'mongoose';

const linkedAccountSchema = new mongoose.Schema({
  // Household reference
  householdId: { 
    type: String, 
    required: true, 
    index: true,
    description: 'Household that owns this linked account'
  },

  // User who linked the account
  userId: { 
    type: String, 
    required: true, 
    index: true,
    description: 'User who initially linked this account'
  },

  // Plaid identifiers
  plaidItemId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true,
    description: 'Unique identifier from Plaid for the linked bank connection'
  },

  plaidAccessToken: { 
    type: String, 
    required: true,
    description: 'Access token for Plaid API calls (encrypted in production)'
  },

  plaidInstitutionId: { 
    type: String,
    description: 'Plaid institution ID (bank identifier)'
  },

  // Account details
  accountId: {
    type: String,
    required: true,
    description: 'Plaid account ID within the item'
  },

  accountName: {
    type: String,
    required: true,
    description: 'User-friendly account name'
  },

  accountOfficialName: {
    type: String,
    description: 'Official name from the bank'
  },

  accountType: {
    type: String,
    enum: ['depository', 'credit', 'investment', 'loan', 'other'],
    description: 'Type of account'
  },

  accountSubtype: {
    type: String,
    enum: [
      'checking', 'savings', 'money market', 'paypal',
      'credit card', 'paycheck', 'prepaid',
      'cash management', 'workplace401k', 'ira', 'brokerage',
      'mortgage', 'auto loan', 'student loan', 'personal loan', 'line of credit',
      'other'
    ],
    description: 'Specific subtype of account'
  },

  accountMask: {
    type: String,
    description: 'Last 2-4 digits of the account number'
  },

  // Balance information
  currentBalance: {
    type: Number,
    default: 0,
    description: 'Current account balance'
  },

  availableBalance: {
    type: Number,
    description: 'Available balance (for accounts where different from current)'
  },

  creditLimit: {
    type: Number,
    description: 'Credit limit (for credit card accounts)'
  },

  currencyCode: {
    type: String,
    default: 'USD',
    description: 'ISO currency code'
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true,
    description: 'Whether this account is currently linked and syncing'
  },

  syncStatus: {
    type: String,
    enum: ['active', 'pending', 'error', 'suspended'],
    default: 'active',
    description: 'Current sync status'
  },

  lastSyncedAt: {
    type: Date,
    description: 'When transactions were last fetched from Plaid'
  },

  lastSyncError: {
    type: String,
    description: 'Error message from last failed sync'
  },

  // Account metadata
  linkedAt: {
    type: Date,
    default: Date.now,
    description: 'When the account was first linked'
  },

  transactionCount: {
    type: Number,
    default: 0,
    description: 'Number of transactions synced for this account'
  },

  // Sync parameters
  syncStartDate: {
    type: Date,
    description: 'Earliest date to sync transactions from (defaults to 90 days prior)'
  },

  isDefault: {
    type: Boolean,
    default: false,
    description: 'Whether this is the primary account for the household'
  },

  tags: [{
    type: String,
    description: 'User-defined tags for categorization'
  }],

  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for efficient querying
linkedAccountSchema.index({ householdId: 1, isActive: 1 });
linkedAccountSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('LinkedAccount', linkedAccountSchema);
