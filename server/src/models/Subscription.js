import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, unique: true, index: true },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  plan: {
    type: { type: String, enum: ['free', 'basic', 'plus', 'pro'], default: 'free' }
  },
  billing: {
    status: { type: String, enum: ['active', 'canceled', 'past_due'], default: 'active' },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    autoRenew: { type: Boolean, default: true },
    paymentMethod: String
  },
  features: {
    maxMembers: { type: Number, default: 1 },
    historyMonths: { type: Number, default: 1 },
    forecastingEnabled: { type: Boolean, default: false },
    aiInsightsEnabled: { type: Boolean, default: false },
    customReports: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false }
  },
  usage: {
    membersActive: { type: Number, default: 0 },
    dataPointsThisMonth: { type: Number, default: 0 },
    reportsGenerated: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Subscription', subscriptionSchema);
