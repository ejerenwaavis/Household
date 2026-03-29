import jwt from 'jsonwebtoken';
import Household from '../models/Household.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
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
        const dbUser = await User.findOne({ userId: decoded.userId }).select('emailVerified emailFrozenAt').lean();
        if (!dbUser) {
          return res.status(401).json({
            error: 'This account no longer exists.',
            code: 'ACCOUNT_NOT_FOUND',
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
