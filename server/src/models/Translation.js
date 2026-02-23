import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema({
  text: { type: String, required: true, index: true },
  sourceLanguage: { type: String, default: 'en' },
  targetLanguage: { type: String, required: true, index: true },
  translatedText: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }, // Auto-delete after 30 days
});

// Compound index for efficient lookup
translationSchema.index({ text: 1, sourceLanguage: 1, targetLanguage: 1 }, { unique: true });

export default mongoose.model('Translation', translationSchema);
