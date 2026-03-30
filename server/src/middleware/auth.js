import jwt from 'jsonwebtoken';
import Household from '../models/Household.js';
import { createAuditLog } from '../services/auditService.js';
import { createRequestFingerprint } from '../utils/requestFingerprint.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_BINDING_STRICT = process.env.TOKEN_BINDING_STRICT === 'true';

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx < 0) return acc;
      const key = pair.substring(0, idx).trim();
      const value = decodeURIComponent(pair.substring(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function getAccessToken(req) {
  const headerToken = req.headers.authorization?.split(' ')[1];
  if (headerToken) return headerToken;

  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.accessToken || null;
}

function getRequestedHouseholdId(req) {
  const headerHouseholdId = req.headers['x-household-id'] || req.headers['x-active-household-id'];
  if (typeof headerHouseholdId === 'string' && headerHouseholdId.trim()) {
    return headerHouseholdId.trim();
  }

  if (typeof req.query?.activeHouseholdId === 'string' && req.query.activeHouseholdId.trim()) {
    return req.query.activeHouseholdId.trim();
  }

  if (typeof req.body?.activeHouseholdId === 'string' && req.body.activeHouseholdId.trim()) {
    return req.body.activeHouseholdId.trim();
  }

  return null;
}

export function resolveActiveHouseholdId(req) {
  return req.activeHouseholdId || req.user?.activeHouseholdId || req.user?.householdId || req.params?.householdId || null;
}

export function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.userId, 
      email: user.email, 
      householdId: user.householdId, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export const authMiddleware = async (req, res, next) => {
  const token = getAccessToken(req);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const requestFingerprint = createRequestFingerprint(req);
  if (decoded.tokenFingerprint && decoded.tokenFingerprint !== requestFingerprint.hash) {
    await createAuditLog({
      req,
      action: 'auth.token_fingerprint_mismatch',
      status: 'failure',
      userId: decoded.userId,
      householdId: decoded.householdId,
      metadata: {
        tokenFingerprint: decoded.tokenFingerprint,
        requestFingerprint: requestFingerprint.hash,
      },
    });
    return res.status(401).json({ error: 'Session validation failed' });
  }

  if (!decoded.tokenFingerprint && TOKEN_BINDING_STRICT) {
    await createAuditLog({
      req,
      action: 'auth.token_fingerprint_missing',
      status: 'failure',
      userId: decoded.userId,
      householdId: decoded.householdId,
    });
    return res.status(401).json({ error: 'Session token missing fingerprint binding' });
  }

  try {
    const requestedHouseholdId = getRequestedHouseholdId(req);
    const activeHouseholdId = requestedHouseholdId || decoded.householdId || null;

    if (activeHouseholdId) {
      const household = await Household.findOne({
        householdId: activeHouseholdId,
        'members.userId': decoded.userId,
      }).select('householdId householdName').lean();

      if (!household) {
        return res.status(403).json({ error: 'Not authorized for this household' });
      }

      req.activeHouseholdId = household.householdId;
      req.user = {
        ...decoded,
        activeHouseholdId: household.householdId,
        activeHouseholdName: household.householdName,
      };
    } else {
      req.user = decoded;
      req.activeHouseholdId = null;
    }

    // Skip freeze check for verify/resend endpoints so users can still verify.
    const path = req.path || '';
    const skipFreeze = path.includes('/verify-email') || path.includes('/resend-verification') || path.includes('/logout');
    if (!skipFreeze) {
      try {
        const User = (await import('../models/User.js')).default;
        const dbUser = await User.findOne({ userId: decoded.userId }).select('emailVerified emailFrozenAt isDisabled disabledAt disableReason').lean();
        if (!dbUser) {
          return res.status(401).json({
            error: 'This account no longer exists.',
            code: 'ACCOUNT_NOT_FOUND',
          });
        }
        if (dbUser.isDisabled) {
          return res.status(403).json({
            error: 'Account is disabled. Contact support.',
            code: 'ACCOUNT_DISABLED',
            disabledAt: dbUser.disabledAt,
            reason: dbUser.disableReason || '',
          });
        }
        if (!dbUser.emailVerified && dbUser.emailFrozenAt && dbUser.emailFrozenAt <= new Date()) {
          return res.status(403).json({
            error: 'Account frozen. Please verify your email address to continue.',
            code: 'ACCOUNT_FROZEN',
          });
        }
      } catch (_) {
        // Non-fatal — proceed if DB check fails
      }
    }

    next();
  } catch (error) {
    console.error('[authMiddleware] Error resolving active household:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const householdAuthMiddleware = async (req, res, next) => {
  const { householdId } = req.params;

  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if user is a member of the requested household
  // We look up the household and check the members array instead of just checking
  // the token's householdId, since users can switch between multiple households
  try {
    const household = await Household.findOne({
      householdId,
      'members.userId': req.user.userId
    });

    if (!household) {
      return res.status(403).json({ error: 'Not authorized for this household' });
    }

    req.activeHouseholdId = household.householdId;
    req.user = {
      ...req.user,
      activeHouseholdId: household.householdId,
      activeHouseholdName: household.householdName,
    };

    next();
  } catch (error) {
    console.error('[householdAuthMiddleware] Error checking household access:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
