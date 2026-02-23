import mongoose from 'mongoose';

const householdSchema = new mongoose.Schema({
  householdId: { type: String, required: true, unique: true, index: true },
  householdName: { type: String, required: true },
  headOfHouseId: { type: String }, // User ID of the household owner (auto-set if missing)
  currency: { type: String, default: 'USD' },
  language: { type: String, enum: ['en', 'es'], default: 'en' },
  members: [{
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'member', 'viewer'], default: 'member' },
    name: { type: String, required: true },
    email: { type: String },
    joinedAt: { type: Date, default: Date.now }
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
    notificationsEnabled: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Household', householdSchema);
