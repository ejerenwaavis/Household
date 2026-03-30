import mongoose from 'mongoose';

const fixedExpenseMatchFeedbackSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  fixedExpenseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'FixedExpense', index: true },
  transactionType: { type: String, enum: ['plaid', 'bank'], required: true, index: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  decision: { type: String, enum: ['confirmed', 'rejected'], required: true, index: true },
  confidence: { type: Number, default: 0, min: 0, max: 100 },
  reason: { type: String, default: '' },
  features: {
    amountDeltaPct: { type: Number, default: null },
    aliasMatched: { type: Boolean, default: false },
    dueDateDistanceDays: { type: Number, default: null },
    merchantHitCount: { type: Number, default: 0 },
  },
  createdBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true },
});

fixedExpenseMatchFeedbackSchema.index({ householdId: 1, fixedExpenseId: 1, createdAt: -1 });
fixedExpenseMatchFeedbackSchema.index({ householdId: 1, transactionType: 1, transactionId: 1, createdAt: -1 });

export default mongoose.model('FixedExpenseMatchFeedback', fixedExpenseMatchFeedbackSchema);
