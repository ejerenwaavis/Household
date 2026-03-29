import mongoose from 'mongoose';

const manualBankAccountSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  bankName: { type: String, required: true, default: 'Uploaded Bank' },
  bankNameNormalized: { type: String, required: true, index: true },
  accountName: { type: String, default: '' },
  accountMask: { type: String, default: '' },
  accountIdentityKey: { type: String, required: true },
  linkedAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LinkedAccount',
    default: null,
    index: true,
  },
  source: { type: String, enum: ['statement_upload'], default: 'statement_upload' },
  transactionCount: { type: Number, default: 0 },
  sourceDocumentCount: { type: Number, default: 0 },
  lastImportedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

manualBankAccountSchema.index({ householdId: 1, accountIdentityKey: 1 }, { unique: true });

export default mongoose.model('ManualBankAccount', manualBankAccountSchema);