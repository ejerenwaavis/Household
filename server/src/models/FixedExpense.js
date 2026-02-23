import mongoose from 'mongoose';

const fixedExpenseSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  nameES: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  group: { type: String, enum: ['Housing', 'Utilities', 'Insurance', 'Auto', 'Family', 'Food', 'Savings', 'Debt', 'Bills', 'Entertainment', 'Other'], default: 'Other' },
  frequency: { type: String, enum: ['monthly', 'weekly', 'biweekly'], default: 'monthly' },
  dueDay: { type: Number, min: 1, max: 31, default: 1 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

fixedExpenseSchema.index({ householdId: 1, isActive: 1 });

export default mongoose.model('FixedExpense', fixedExpenseSchema);
