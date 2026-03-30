import AuditLog from '../models/AuditLog.js';
import { createRequestFingerprint } from '../utils/requestFingerprint.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'mfaSecret',
  'emailVerifyToken',
  'jwt',
]);

function redactSensitive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, data]) => {
    if (SENSITIVE_KEYS.has(String(key))) {
      acc[key] = '[REDACTED]';
    } else {
      acc[key] = redactSensitive(data);
    }
    return acc;
  }, {});
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

export async function createAuditLog({
  req,
  action,
  status = 'success',
  userId = null,
  householdId = null,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  try {
    const { hash } = createRequestFingerprint(req);

    await AuditLog.create({
      action,
      status,
      userId: userId || req.user?.userId || null,
      householdId: householdId || req.activeHouseholdId || req.user?.householdId || null,
      ipAddress: getRequestIp(req),
      userAgent: req.headers['user-agent'] || '',
      fingerprintHash: hash,
      targetType,
      targetId,
      metadata: redactSensitive(metadata),
    });
  } catch (error) {
    // Audit logging should not break business flow.
    console.error('[auditService] Failed to write audit log:', error.message);
  }
}

export default {
  createAuditLog,
};
