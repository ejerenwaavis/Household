import { Schema, model } from 'mongoose';

const debtPaymentSchema = new Schema({
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
  cardStatementId: {
    type: Schema.Types.ObjectId,
    ref: 'CardStatement',
    default: null
  },
  month: {
    type: String,  // Format: "YYYY-MM" (e.g., "2024-01")
    required: true,
    index: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    default: ''
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
debtPaymentSchema.index({ householdId: 1, month: -1 });
debtPaymentSchema.index({ cardId: 1, paymentDate: -1 });

// Pre-save hook to ensure month is correctly calculated from paymentDate
debtPaymentSchema.pre('save', function(next) {
  // ALWAYS calculate month from paymentDate - this is the source of truth
  if (this.paymentDate) {
    const date = new Date(this.paymentDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const calculatedMonth = `${year}-${month}`;
    
    if (this.month !== calculatedMonth) {
      console.log('[DebtPayment Pre-save] Auto-calculating month:', {
        paymentDate: this.paymentDate,
        oldMonth: this.month,
        newMonth: calculatedMonth
      });
      this.month = calculatedMonth;
    }
  }
  next();
});

const DebtPayment = model('DebtPayment', debtPaymentSchema);

export default DebtPayment;
