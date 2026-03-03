import mongoose from 'mongoose';

/**
 * A payment suggestion is created when a bank statement upload contains a debit
 * row that fuzzy-matches a credit card's name or linkedBankName. Instead of
 * auto-creating a DebtPayment, we create a suggestion so the user can confirm.
 */
const paymentSuggestionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  bankTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankTransaction', required: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCard', required: true },
  cardName:  { type: String, default: '' },
  amount:    { type: Number, required: true },
  date:      { type: String, default: '' },
  month:     { type: String, default: '' }, // YYYY-MM
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
    index: true,
  },
  // Set when confirmed — points to the created DebtPayment
  debtPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DebtPayment', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Prevent duplicate suggestions for the same bank transaction + card
paymentSuggestionSchema.index({ bankTransactionId: 1, cardId: 1 }, { unique: true });

paymentSuggestionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('PaymentSuggestion', paymentSuggestionSchema);
