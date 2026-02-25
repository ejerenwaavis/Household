import mongoose from 'mongoose';
import crypto from 'crypto';

const householdInviteSchema = new mongoose.Schema({
  householdId: { type: String, required: true }, // UUID string, not ObjectId
  householdName: String,
  invitedBy: { type: String, required: true }, // User's userId (UUID string)
  invitedByName: String,
  email: { type: String, required: true, lowercase: true },
  inviteToken: { type: String, unique: true, sparse: true }, // One-time use token
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  isExistingUser: { type: Boolean, default: false }, // True if user already has account
  acceptedAt: Date,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Generate unique token before saving
householdInviteSchema.pre('save', async function (next) {
  if (!this.inviteToken) {
    this.inviteToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Compound index to prevent duplicate invites
householdInviteSchema.index({ householdId: 1, email: 1, status: 1 }, { unique: false });

export default mongoose.model('HouseholdInvite', householdInviteSchema);
