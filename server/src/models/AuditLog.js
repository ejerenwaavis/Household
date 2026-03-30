import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  action: { type: String, required: true, index: true },
  status: { type: String, enum: ['success', 'failure', 'warning'], default: 'success', index: true },
  userId: { type: String, default: null, index: true },
  householdId: { type: String, default: null, index: true },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: '' },
  fingerprintHash: { type: String, default: null, index: true },
  targetType: { type: String, default: null },
  targetId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  versionKey: false,
});

auditLogSchema.index({ timestamp: -1, action: 1 });
auditLogSchema.index({ householdId: 1, timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
