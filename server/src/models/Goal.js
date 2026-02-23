import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  monthlyContribution: { type: Number, default: 0, min: 0 },
  target: { type: Number, default: 0, min: 0 }, // 0 = no target set
  currentBalance: { type: Number, default: 0, min: 0 },
  type: { type: String, enum: ['Emergency', 'Project', 'Investment', 'Other'], default: 'Other' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

goalSchema.index({ householdId: 1, isActive: 1 });

export default mongoose.model('Goal', goalSchema);
