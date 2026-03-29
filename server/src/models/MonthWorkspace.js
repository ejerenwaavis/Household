import mongoose from 'mongoose';

const resetHistorySchema = new mongoose.Schema({
  resetAt: { type: Date, required: true },
  mode: {
    type: String,
    enum: ['upload-led', 'plaid-led', 'hybrid'],
    default: 'hybrid',
  },
  reason: { type: String, default: '' },
  resetBy: { type: String, default: '' },
  snapshot: {
    manualExpenseCount: { type: Number, default: 0 },
    manualIncomeCount: { type: Number, default: 0 },
    plaidExpenseCount: { type: Number, default: 0 },
    plaidIncomeCount: { type: Number, default: 0 },
    uploadedTransactionCount: { type: Number, default: 0 },
    fixedExpenseCount: { type: Number, default: 0 },
  },
}, { _id: false });

const monthWorkspaceSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  month: { type: String, required: true, index: true },
  mode: {
    type: String,
    enum: ['upload-led', 'plaid-led', 'hybrid'],
    default: 'hybrid',
  },
  resetAt: { type: Date, default: null, index: true },
  resetCount: { type: Number, default: 0 },
  lastResetBy: { type: String, default: '' },
  lastResetReason: { type: String, default: '' },
  resetHistory: { type: [resetHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

monthWorkspaceSchema.index({ householdId: 1, month: 1 }, { unique: true });

export default mongoose.model('MonthWorkspace', monthWorkspaceSchema);
