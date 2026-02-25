/**
 * Stripe Webhook Route
 * Receives and processes Stripe webhook events
 * Must use raw body — registered BEFORE express.json()
 */

import { Router } from 'express';
import express from 'express';
import * as StripeService from '../services/stripeService.js';

const router = Router();

// POST /api/webhooks/stripe — Stripe sends events here
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = StripeService.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  console.log(`[Webhook] Event received: ${event.type}`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await StripeService.handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await StripeService.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await StripeService.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await StripeService.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await StripeService.handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook] Handler error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
