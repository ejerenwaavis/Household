import mongoose from 'mongoose';

/**
 * NetWorthSnapshot
 * Stores a household's net worth at a point in time,
 * broken down by assets and liabilities.
 */
const netWorthSnapshotSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  month: { type: String, required: true, index: true }, // YYYY-MM
  recordedAt: { type: Date, default: Date.now },
  recordedBy: { type: String }, // userId

  // Asset categories (positive)
  assets: {
    checkingAndSavings: { type: Number, default: 0 },
    investments: { type: Number, default: 0 },
    realEstate: { type: Number, default: 0 },
    vehicles: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  // Liability categories (positive numbers representing owed amounts)
  liabilities: {
    creditCards: { type: Number, default: 0 },
    studentLoans: { type: Number, default: 0 },
    mortgage: { type: Number, default: 0 },
    carLoans: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },

  // Computed totals (stored for quick reads)
  totalAssets: { type: Number, default: 0 },
  totalLiabilities: { type: Number, default: 0 },
  netWorth: { type: Number, default: 0 }, // totalAssets - totalLiabilities

  notes: { type: String, default: '' },
});

// One snapshot per household per month
netWorthSnapshotSchema.index({ householdId: 1, month: 1 }, { unique: true });

// Pre-save hook: compute totals
netWorthSnapshotSchema.pre('save', function (next) {
  const a = this.assets || {};
  const l = this.liabilities || {};
  this.totalAssets = (a.checkingAndSavings || 0) + (a.investments || 0) + (a.realEstate || 0) + (a.vehicles || 0) + (a.other || 0);
  this.totalLiabilities = (l.creditCards || 0) + (l.studentLoans || 0) + (l.mortgage || 0) + (l.carLoans || 0) + (l.other || 0);
  this.netWorth = this.totalAssets - this.totalLiabilities;
  next();
});

export default mongoose.model('NetWorthSnapshot', netWorthSnapshotSchema);
