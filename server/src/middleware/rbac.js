import User from '../models/User.js';

export function requireRoles(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

export async function requireActiveUser(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const user = await User.findOne({ userId }).select('isDisabled disabledAt disableReason').lean();
    if (!user) {
      return res.status(401).json({ error: 'This account no longer exists.', code: 'ACCOUNT_NOT_FOUND' });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        error: 'Account is disabled. Contact support.',
        code: 'ACCOUNT_DISABLED',
        disabledAt: user.disabledAt,
        reason: user.disableReason || '',
      });
    }

    return next();
  } catch (error) {
    console.error('[rbac] Active user check failed:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

export default {
  requireRoles,
  requireActiveUser,
};
