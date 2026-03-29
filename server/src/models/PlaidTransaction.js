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
    index: true,
    description: 'Unique ID from Plaid (unique per household, not globally)'
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

  transferDirection: {
    type: String,
    enum: ['in', 'out', 'unknown'],
    default: 'unknown',
    description: 'Direction of transfer flow for transfer-like transactions'
  },

  transferScope: {
    type: String,
    enum: ['same-household', 'external', 'unknown'],
    default: 'unknown',
    description: 'Whether transfer stays inside household-linked accounts or exits externally'
  },

  transferGroupId: {
    type: String,
    default: null,
    index: true,
    description: 'Shared identifier for paired transfer legs'
  },

  isInternalTransferNeutralized: {
    type: Boolean,
    default: false,
    index: true,
    description: 'True when this transaction is excluded from income/expense totals as an internal transfer'
  },

  transferClassificationSource: {
    type: String,
    enum: ['system_heuristic', 'manual_review', 'unknown'],
    default: 'unknown',
    description: 'How transfer classification was assigned'
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

  reconciliationReason: {
    type: String,
    enum: [
      'manual_review',
      'fixed_expense_payment',
      'synced_income',
      'duplicate_review',
      'categorized_unreviewed',
      'unreviewed',
      null,
    ],
    default: null,
    description: 'Why this transaction is or is not considered reconciled'
  },

  reconciledAt: {
    type: Date,
    description: 'When the transaction was marked reconciled'
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
// Unique per household: Plaid Sandbox reuses the same transaction IDs across test users
plaidTransactionSchema.index({ householdId: 1, plaidTransactionId: 1 }, { unique: true });
plaidTransactionSchema.index({ householdId: 1, date: -1 });
plaidTransactionSchema.index({ linkedAccountId: 1, date: -1 });
plaidTransactionSchema.index({ isReconciled: 1, date: -1 });
plaidTransactionSchema.index({ reconciliationReason: 1, date: -1 });
plaidTransactionSchema.index({ primaryCategory: 1 });
plaidTransactionSchema.index({ householdId: 1, isInternalTransferNeutralized: 1, date: -1 });
plaidTransactionSchema.index({ householdId: 1, transferScope: 1, date: -1 });

export default mongoose.model('PlaidTransaction', plaidTransactionSchema);
