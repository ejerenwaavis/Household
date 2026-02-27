import mongoose from 'mongoose';

// Temporary storage for WebAuthn challenges — auto-expires after 5 minutes
const passkeyChallengeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  challenge: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // TTL: 5 minutes
});

export default mongoose.model('PasskeyChallenge', passkeyChallengeSchema);
