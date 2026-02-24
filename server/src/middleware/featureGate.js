/**
 * Feature Gate Middleware
 * Controls access to features based on subscription plan
 * Tasks 10.1, 10.2, 10.4
 */

import Subscription from '../models/Subscription.js';
import { PLANS } from '../services/stripeService.js';

// ============================================================
// Subscription loader (cached on request)
// ============================================================

async function loadSubscription(householdId) {
  let sub = await Subscription.findOne({ householdId }).lean();
  if (!sub) {
    // Auto-provision free tier
    sub = await Subscription.create({
      householdId,
      plan: { type: 'free' },
      billing: { status: 'active' },
      features: PLANS.free.features,
    });
  }
  return sub;
}

// ============================================================
// Task 10.1: Generic feature access check
// ============================================================

export function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      const sub = await loadSubscription(req.user.householdId);
      const plan = PLANS[sub.plan?.type || 'free'];

      // Check billing status — past_due still gets access but warn
      if (sub.billing?.status === 'canceled') {
        return res.status(403).json({
          error: 'Subscription expired',
          code: 'SUBSCRIPTION_CANCELED',
          upgradeUrl: '/pricing',
        });
      }

      // Check feature flag
      const hasFeature = sub.features?.[featureName] ?? plan?.features?.[featureName] ?? false;
      if (!hasFeature) {
        return res.status(403).json({
          error: `Feature "${featureName}" requires a higher plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          currentPlan: sub.plan?.type,
          upgradeUrl: '/pricing',
        });
      }

      req.subscription = sub;
      next();
    } catch (err) {
      console.error('[featureGate]', err.message);
      next(); // Fail open — don't block on gate errors
    }
  };
}

// ============================================================
// Task 10.2: Usage limits enforcement
// ============================================================

export function enforceLimit(resourceType) {
  return async (req, res, next) => {
    try {
      const sub = await loadSubscription(req.user.householdId);
      const planId = sub.plan?.type || 'free';
      const plan = PLANS[planId];
      const limit = plan?.limits?.[resourceType] ?? -1;

      if (limit === -1) return next(); // unlimited

      const currentUsage = sub.usage?.[resourceType] || 0;
      if (currentUsage >= limit) {
        return res.status(403).json({
          error: `You've reached the ${resourceType} limit for your plan (${limit})`,
          code: 'USAGE_LIMIT_REACHED',
          limit,
          current: currentUsage,
          upgradeUrl: '/pricing',
        });
      }

      req.subscription = sub;
      next();
    } catch (err) {
      console.error('[enforceLimit]', err.message);
      next();
    }
  };
}

// ============================================================
// Task 10.4: Trial period logic
// ============================================================

export async function checkTrialStatus(householdId) {
  const sub = await Subscription.findOne({ householdId }).lean();
  if (!sub) return { inTrial: false, trialEnded: false, daysLeft: 0 };

  const now = new Date();
  const periodEnd = sub.billing?.currentPeriodEnd;

  // Stripe sets status to 'trialing' during trial
  // We store it as 'active' but track period end
  const inTrial = sub.billing?.status === 'trialing';
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((new Date(periodEnd) - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return { inTrial, daysLeft, trialEnded: inTrial && daysLeft === 0 };
}

// Middleware: attach subscription to req for use in route handlers
export function attachSubscription() {
  return async (req, res, next) => {
    try {
      if (req.user?.householdId) {
        req.subscription = await loadSubscription(req.user.householdId);
        req.planId = req.subscription?.plan?.type || 'free';
      }
      next();
    } catch (err) {
      next();
    }
  };
}
