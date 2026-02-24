/**
 * PlaidTransaction Model
 * Stores transactions synced from Plaid for reconciliation and analysis
 */

import mongoose from 'mongoose';

const plaidTransactionSchema = new mongoose.Schema({
  // Household reference
  householdId: { 
    type: String, 
    required: true, 
    index: true 
  },

  // Linked account reference
  linkedAccountId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LinkedAccount',
    required: true,
    index: true
  },

  // Plaid identifiers
  plaidTransactionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    description: 'Unique ID from Plaid'
  },

  plaidAccountId: {
    type: String,
    required: true,
    index: true,
    description: 'Plaid account ID'
  },

  // Transaction details
  date: {
    type: Date,
    required: true,
    index: true
  },

  amount: {
    type: Number,
    required: true,
    description: 'Transaction amount (positive for debits, negative for credits)'
  },

  name: {
    type: String,
    required: true,
    index: true
  },

  merchant: {
    type: String,
    description: 'Merchant name if available'
  },

  description: {
    type: String,
    description: 'Full transaction description'
  },

  isPending: {
    type: Boolean,
    default: false
  },

  paymentMethod: {
    type: String,
    enum: ['online', 'in store', 'other', 'none'],
    description: 'How the transaction was processed'
  },

  transactionCode: {
    type: String,
    description: 'Plaid transaction code (e.g., "debit", "atm", "cash", "check")'
  },

  // Categorization
  primaryCategory: {
    type: String,
    description: 'Primary Plaid category'
  },

  detailedCategory: {
    type: String,
    description: 'Detailed Plaid category'
  },

  userCategory: {
    type: String,
    description: 'User-assigned category for better organization'
  },

  relatedExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense',
    description: 'Associated Expense record if matched'
  },

  relatedIncomeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Income',
    description: 'Associated Income record if matched'
  },

  // Reconciliation metadata
  isReconciled: {
    type: Boolean,
    default: false,
    description: 'Whether user has reviewed and matched this transaction'
  },

  reconcilationNotes: {
    type: String,
    description: 'User notes about this transaction'
  },

  isDuplicate: {
    type: Boolean,
    default: false,
    description: 'Marked as duplicate if same transaction imported multiple times'
  },

  originalTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlaidTransaction',
    description: 'Reference to original transaction if this is a duplicate'
  },

  tags: [{
    type: String
  }],

  // Sync metadata
  syncedAt: {
    type: Date,
    default: Date.now
  },

  isoCurrencyCode: {
    type: String,
    default: 'USD'
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for efficient querying
plaidTransactionSchema.index({ householdId: 1, date: -1 });
plaidTransactionSchema.index({ linkedAccountId: 1, date: -1 });
plaidTransactionSchema.index({ isReconciled: 1, date: -1 });
plaidTransactionSchema.index({ primaryCategory: 1 });

export default mongoose.model('PlaidTransaction', plaidTransactionSchema);
