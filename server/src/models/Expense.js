import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  contributorName: { type: String, default: 'Unknown' },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true, index: -1 },
  week: { type: Number, min: 1, max: 4 },
  month: { type: String, required: true, index: true },
  source: { type: String, enum: ['manual', 'plaid', 'import'], default: 'manual' },
  autoImported: { type: Boolean, default: false },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

expenseSchema.index({ householdId: 1, date: -1 });
expenseSchema.index({ householdId: 1, month: 1, category: 1 });

export default mongoose.model('Expense', expenseSchema);
