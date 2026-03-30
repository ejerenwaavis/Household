import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  linkedAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LinkedAccount',
    default: null,
    index: true,
  },
  manualAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ManualBankAccount',
    default: null,
    index: true,
  },

  date: { type: String, default: '' },
  dateISO: { type: Date, index: true },
  month: { type: String, index: true },

  description: { type: String, default: '' },
  normalizedDescription: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  type: { type: String, enum: ['debit', 'credit'], default: 'debit' },
  category: { type: String, default: 'Other' },
  assignedFixedExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FixedExpense',
    default: null,
    index: true,
  },

  bank: { type: String, default: '' },
  accountName: { type: String, default: '' },
  accountMask: { type: String, default: '' },
  accountIdentityKey: { type: String, default: '', index: true },

  hash: { type: String, required: true },
  source: { type: String, enum: ['csv', 'pdf', 'image', 'manual'], default: 'csv' },
  sourceType: { type: String, enum: ['bank', 'credit_card'], default: 'bank' },
  creditCardId: { type: String, default: null },
  sourceDocumentNames: [{ type: String }],
  duplicateOfPlaid: { type: Boolean, default: false },
  plaidMatchTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlaidTransaction',
    default: null,
  },
  transferId: { type: String, default: null, index: true },
  transferMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  isInternalTransferNeutralized: { type: Boolean, default: false, index: true },
  transferScope: {
    type: String,
    enum: ['same-household', 'external', 'unknown'],
    default: 'unknown',
  },
  transferDirection: {
    type: String,
    enum: ['in', 'out', 'unknown'],
    default: 'unknown',
  },
  importedBy: { type: String, default: '' },
  importedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

bankTransactionSchema.index({ householdId: 1, hash: 1 }, { unique: true });
bankTransactionSchema.index({ householdId: 1, month: 1, type: 1 });
bankTransactionSchema.index({ householdId: 1, accountIdentityKey: 1, month: 1 });
bankTransactionSchema.index({ householdId: 1, isInternalTransferNeutralized: 1, month: 1 });

export default mongoose.model('BankTransaction', bankTransactionSchema);
