import mongoose from 'mongoose';

const goalContributionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  goalId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Goal', index: true },
  amount: { type: Number, required: true, min: 0 },
  contributionDate: { type: Date, required: true, index: true },
  method: { type: String, enum: ['bank', 'cash', 'check', 'transfer', 'other'], default: 'bank' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

goalContributionSchema.index({ householdId: 1, goalId: 1 });

export default mongoose.model('GoalContribution', goalContributionSchema);
