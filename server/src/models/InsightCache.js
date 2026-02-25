import mongoose from 'mongoose';

const insightCacheSchema = new mongoose.Schema({
  householdId: { type: String, required: true, unique: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed },
  generatedAt: { type: Date, default: Date.now },
});

// Auto-expire after 24 hours
insightCacheSchema.index({ generatedAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model('InsightCache', insightCacheSchema);
