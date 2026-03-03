import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },

  // Raw date from the CSV/PDF (e.g. "02/26/2026") — kept for display
  date:    { type: String, default: '' },
  // Normalised ISO date for sorting / filtering
  dateISO: { type: Date, index: true },
  // "YYYY-MM" for quick month-based queries
  month:   { type: String, index: true },

  description: { type: String, default: '' },
  amount:      { type: Number, default: 0 },
  type:        { type: String, enum: ['debit', 'credit'], default: 'debit' },
  category:    { type: String, default: 'Other' },

  // Source bank / original filename
  bank: { type: String, default: '' },

  // SHA-256 of householdId|dateISO|amountCents|descriptionNormalised
  // Used to prevent duplicate imports.
  hash: { type: String, required: true },

  source:     { type: String, enum: ['csv', 'pdf', 'manual'], default: 'csv' },
  // Whether this row came from a bank account or a credit card statement upload
  sourceType: { type: String, enum: ['bank', 'credit_card'], default: 'bank' },
  // Populated when sourceType === 'credit_card' — links to CreditCard._id
  creditCardId: { type: String, default: null },
  importedBy: { type: String },
  importedAt: { type: Date, default: Date.now },
});

// One hash per household — prevents duplicate transactions regardless of who uploads
bankTransactionSchema.index({ householdId: 1, hash: 1 }, { unique: true });
// Efficient per-month lookups
bankTransactionSchema.index({ householdId: 1, month: 1, type: 1 });

export default mongoose.model('BankTransaction', bankTransactionSchema);
