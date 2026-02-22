import mongoose from 'mongoose';

const incomeSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  week: { type: Number, min: 1, max: 4 },
  month: { type: String, required: true, index: true },
  dailyBreakdown: [{
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, required: true },
    description: String
  }],
  weeklyTotal: { type: Number, default: 0, min: 0 },
  projection: {
    currentPace: { type: Number, default: 0 },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    lastUpdated: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now }
});

incomeSchema.index({ householdId: 1, month: 1, week: 1 });

export default mongoose.model('Income', incomeSchema);
