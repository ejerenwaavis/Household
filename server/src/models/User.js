import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  householdId: { type: String, required: true, index: true },
  role: { type: String, enum: ['owner', 'member', 'viewer'], default: 'member' },
  profile: {
    name: { type: String, required: true },
    avatar: String
  },
  // Token rotation for security
  tokenVersion: { 
    type: Number, 
    default: 0,
    description: 'Incremented on logout to invalidate all tokens'
  },
  lastLogout: {
    type: Date,
    description: 'Timestamp of last logout'
  },
  lastLoginAt: {
    type: Date,
    description: 'Last successful login'
  },
  lastLoginIp: {
    type: String,
    description: 'IP address of last login'
  },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
