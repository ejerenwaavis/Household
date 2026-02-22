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
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
