import mongoose from 'mongoose';

const householdSchema = new mongoose.Schema({
  householdId: { type: String, required: true, unique: true, index: true },
  householdName: { type: String, required: true },
  headOfHouseId: { type: String }, // User ID of the household owner (auto-set if missing)
  currency: { type: String, default: 'USD' },
  language: { type: String, enum: ['en', 'es'], default: 'en' },
  members: [{
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'co-owner', 'manager', 'member', 'viewer'], default: 'member' },
    name: { type: String, required: true },
    email: { type: String },
    joinedAt: { type: Date, default: Date.now },
    responsibilities: [String], // ['bills', 'groceries', 'maintenance', etc.]
    incomePercentage: { type: Number, min: 0, max: 100, default: 0 }, // Percentage of household income expected from this member
    incomeAmount: { type: Number, default: 0 } // Actual income amount if separate from percentage
  }],
  subscription: {
    planId: { type: String, enum: ['free', 'basic', 'plus', 'pro'], default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'past_due'], default: 'active' },
    stripeCustomerId: String,
    startDate: Date,
    renewalDate: Date
  },
  settings: {
    sharedView: { type: Boolean, default: true },
    notificationsEnabled: { type: Boolean, default: true },
    creditCardOverspendThreshold: { type: Number, default: 500 }, // Amount in dollars above which to flag overspend
    autoCreateOverspendProject: { type: Number, default: 1000 } // Auto-create project if overspend < this amount, otherwise require approval
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Household', householdSchema);
