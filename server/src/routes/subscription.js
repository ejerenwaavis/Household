/**
 * Subscription Routes
 * Handles Stripe checkout, portal, and subscription management
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireFeature } from '../middleware/featureGate.js';
import * as StripeService from '../services/stripeService.js';
import Subscription from '../models/Subscription.js';
import Household from '../models/Household.js';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// GET /api/subscription — Get current subscription
router.get('/', async (req, res) => {
  try {
    const sub = await StripeService.getSubscription(req.user.householdId);
    const plan = StripeService.PLANS[sub.plan?.type || 'free'];
    res.json({ subscription: sub, plan, plans: Object.values(StripeService.PLANS) });
  } catch (err) {
    console.error('[Subscription GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subscription/plans — List all plans (public)
router.get('/plans', async (req, res) => {
  res.json({ plans: Object.values(StripeService.PLANS) });
});

// POST /api/subscription/checkout — Create Stripe checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId || planId === 'free') {
      return res.status(400).json({ error: 'Select a paid plan to upgrade' });
    }

    const household = await Household.findOne({ householdId: req.user.householdId });
    const owner = household?.members?.find(m => m.role === 'owner') || household?.members?.[0];

    const session = await StripeService.createCheckoutSession({
      householdId: req.user.householdId,
      planId,
      email: owner?.email || req.user.email,
      name: owner?.name || 'Household',
      successUrl: req.body.successUrl,
      cancelUrl: req.body.cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Subscription Checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription/portal — Create Stripe billing portal session
router.post('/portal', async (req, res) => {
  try {
    const session = await StripeService.createPortalSession(
      req.user.householdId,
      req.body.returnUrl
    );
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Subscription Portal]', err.message);
    res.status(500).json({ error: 'No billing portal available. Please subscribe first.' });
  }
});

// POST /api/subscription/cancel — Cancel at period end
router.post('/cancel', async (req, res) => {
  try {
    await StripeService.cancelSubscription(req.user.householdId);
    res.json({ success: true, message: 'Subscription will cancel at end of billing period.' });
  } catch (err) {
    console.error('[Subscription Cancel]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subscription/reactivate — Undo cancellation
router.post('/reactivate', async (req, res) => {
  try {
    await StripeService.reactivateSubscription(req.user.householdId);
    res.json({ success: true, message: 'Subscription reactivated.' });
  } catch (err) {
    console.error('[Subscription Reactivate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
