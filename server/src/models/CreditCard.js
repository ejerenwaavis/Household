import mongoose from 'mongoose';

const creditCardSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  cardName: { type: String, required: true },
  holder: { type: String, required: true }, // Who holds the card (e.g., "Maria", "Avis")
  originalBalance: { type: Number, required: true, default: 0 }, // Starting debt
  currentBalance: { type: Number, required: true, default: 0 }, // Current debt owed
  minPayment: { type: Number, default: 0 }, // Minimum monthly payment
  plannedExtraPayment: { type: Number, default: 0 }, // Extra amount planned to pay
  interestRate: { type: Number, default: 0 }, // APR percentage
  creditLimit: { type: Number, default: 0 }, // Card limit
  lastStatementDate: Date,
  dueDay: Number, // Day of month payment is due
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Calculate payoff percentage
creditCardSchema.virtual('payoffPercent').get(function() {
  if (this.originalBalance === 0) return 100;
  const paid = this.originalBalance - this.currentBalance;
  return Math.round((paid / this.originalBalance) * 100);
});

// Calculate remaining to pay off
creditCardSchema.virtual('remaining').get(function() {
  return Math.max(0, this.currentBalance);
});

creditCardSchema.set('toJSON', { virtuals: true });
creditCardSchema.set('toObject', { virtuals: true });

export default mongoose.model('CreditCard', creditCardSchema);
