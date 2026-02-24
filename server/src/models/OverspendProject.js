import mongoose from 'mongoose';

const overspendProjectSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  type: { type: String, default: 'overspend' }, // identifies this as overspend project
  memberId: { type: String, required: true }, // member who overspent
  memberName: { type: String, required: true },
  
  // Overspend details
  originalChargeAmount: { type: Number, required: true }, // e.g., $2000
  memberResponsibilityPercent: { type: Number, default: 50 }, // e.g., 50%
  memberResponsibilityAmount: { type: Number, required: true }, // e.g., $1000
  
  // Weekly contribution breakdown
  weeklyContribution: { type: Number, required: true }, // $250/week in example
  weekCount: { type: Number, default: 4 }, // usually 4 weeks
  
  // Status
  status: { type: String, enum: ['active', 'completed', 'on_hold'], default: 'active' },
  requiresApproval: { type: Boolean, default: false }, // true if > $1000
  approvedBy: [{ type: String }], // array of userIds who approved
  approvalDate: { type: Date },
  
  // Payments
  totalCollected: { type: Number, default: 0 },
  payments: [{
    amount: { type: Number },
    date: { type: Date, default: Date.now },
    week: { type: Number },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
  }],
  
  // Timeline
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  // Metadata
  statementId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCardStatement' },
  description: { type: String } // "Overspend project for charge on 02/24/2026: $2000"
});

export default mongoose.model('OverspendProject', overspendProjectSchema);
