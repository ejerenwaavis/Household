import { Schema, model } from 'mongoose';

const cardStatementSchema = new Schema({
  householdId: {
    type: String,
    required: true,
    index: true
  },
  cardId: {
    type: Schema.Types.ObjectId,
    ref: 'CreditCard',
    required: true,
    index: true
  },
  statementName: {
    type: String,
    required: true,
    trim: true
  },
  month: {
    type: String,  // Format: "YYYY-MM" (e.g., "2024-01")
    required: true,
    index: true
  },
  statementDate: {
    type: Date,
    required: true
  },
  statementBalance: {
    type: Number,
    required: true,
    default: 0
  },
  currentBalance: {
    type: Number,
    required: true,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
cardStatementSchema.index({ householdId: 1, month: -1 });
cardStatementSchema.index({ cardId: 1, month: -1 });

// Virtual: Amount paid off on this statement
cardStatementSchema.virtual('amountPaid').get(function() {
  return Math.max(0, this.statementBalance - this.currentBalance);
});

// Virtual: Payment progress percentage
cardStatementSchema.virtual('paymentProgress').get(function() {
  if (this.statementBalance === 0) return 100;
  const paid = this.statementBalance - this.currentBalance;
  return Math.round((paid / this.statementBalance) * 100);
});

// Ensure virtuals are included in JSON
cardStatementSchema.set('toJSON', { virtuals: true });
cardStatementSchema.set('toObject', { virtuals: true });

const CardStatement = model('CardStatement', cardStatementSchema);

export default CardStatement;
