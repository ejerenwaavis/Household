import mongoose from 'mongoose';

const incomeSplitSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  userName: String, // Denormalized for display
  splitPercentage: { type: Number, required: true, min: 0, max: 100 }, // e.g., 60 or 40
  isHeadOfHouse: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index to ensure one split record per household member
incomeSplitSchema.index({ householdId: 1, userId: 1 }, { unique: true });

export default mongoose.model('IncomeSplit', incomeSplitSchema);
