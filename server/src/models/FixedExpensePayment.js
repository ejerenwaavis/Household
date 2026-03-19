import mongoose from 'mongoose';

const fixedExpensePaymentSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  fixedExpenseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'FixedExpense', index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true, index: true },
  source: { type: String, enum: ['manual', 'plaid_auto'], default: 'manual' },
  plaidTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlaidTransaction', default: null, index: true },
  method: { type: String, enum: ['online', 'check', 'transfer', 'cash', 'other'], default: 'online' },
  notes: { type: String, default: '' },
  monthPaid: { type: String, required: true }, // Format: "2026-02" (YYYY-MM)
  createdAt: { type: Date, default: Date.now },
});

fixedExpensePaymentSchema.index({ householdId: 1, monthPaid: 1 });
fixedExpensePaymentSchema.index({ fixedExpenseId: 1, monthPaid: 1 });
fixedExpensePaymentSchema.index({ plaidTransactionId: 1 }, { unique: true, sparse: true });

export default mongoose.model('FixedExpensePayment', fixedExpensePaymentSchema);
