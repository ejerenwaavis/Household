/**
 * Stripe Service
 * Handles all subscription billing logic via Stripe
 */

import Stripe from 'stripe';
import Subscription from '../models/Subscription.js';
import Household from '../models/Household.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia',
});

// ============================================================
// Pricing Tiers & Plan Config
// ============================================================

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: {
      maxMembers: 2,
      historyMonths: 3,
      forecastingEnabled: false,
      aiInsightsEnabled: false,
      customReports: false,
      apiAccess: false,
    },
    limits: {
      monthlyExpenses: 50,
      goals: 2,
      linkedAccounts: 0,
    },
    description: 'For individuals getting started',
    highlight: false,
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 4.99,
    priceId: process.env.STRIPE_PRICE_BASIC_MONTHLY,
    features: {
      maxMembers: 3,
      historyMonths: 12,
      forecastingEnabled: false,
      aiInsightsEnabled: false,
      customReports: false,
      apiAccess: false,
    },
    limits: {
      monthlyExpenses: 200,
      goals: 5,
      linkedAccounts: 1,
    },
    description: 'For small households',
    highlight: false,
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    price: 9.99,
    priceId: process.env.STRIPE_PRICE_PLUS_MONTHLY,
    features: {
      maxMembers: 6,
      historyMonths: 24,
      forecastingEnabled: true,
      aiInsightsEnabled: true,
      customReports: false,
      apiAccess: false,
    },
    limits: {
      monthlyExpenses: -1, // unlimited
      goals: 20,
      linkedAccounts: 3,
    },
    description: 'Most popular for families',
    highlight: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    features: {
      maxMembers: -1, // unlimited
      historyMonths: -1, // unlimited
      forecastingEnabled: true,
      aiInsightsEnabled: true,
      customReports: true,
      apiAccess: true,
    },
    limits: {
      monthlyExpenses: -1,
      goals: -1,
      linkedAccounts: -1,
    },
    description: 'For power users & large households',
    highlight: false,
  },
};

export const TRIAL_DAYS = 14;

// ============================================================
// Customer Management
// ============================================================

export async function getOrCreateCustomer(householdId, email, name) {
  const household = await Household.findOne({ householdId });
  if (!household) throw new Error('Household not found');

  // Return existing customer
  if (household.subscription?.stripeCustomerId) {
    return stripe.customers.retrieve(household.subscription.stripeCustomerId);
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { householdId },
  });

  // Save customer ID to household
  await Household.updateOne(
    { householdId },
    { $set: { 'subscription.stripeCustomerId': customer.id } }
  );

  return customer;
}

// ============================================================
// Checkout Session
// ============================================================

export async function createCheckoutSession({ householdId, planId, email, name, successUrl, cancelUrl }) {
  const plan = PLANS[planId];
  if (!plan || !plan.priceId) throw new Error(`Invalid plan: ${planId}`);

  const customer = await getOrCreateCustomer(householdId, email, name);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: plan.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { householdId, planId },
    },
    success_url: successUrl || `${process.env.FRONTEND_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    metadata: { householdId, planId },
  });

  return session;
}

// ============================================================
// Subscription Management
// ============================================================

export async function getSubscription(householdId) {
  let sub = await Subscription.findOne({ householdId });
  if (!sub) {
    sub = await Subscription.create({
      householdId,
      plan: { type: 'free' },
      billing: { status: 'active' },
      features: PLANS.free.features,
    });
  }
  return sub;
}

export async function cancelSubscription(householdId) {
  const sub = await Subscription.findOne({ householdId });
  if (!sub?.stripeSubscriptionId) throw new Error('No active subscription found');

  const cancelled = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await Subscription.updateOne(
    { householdId },
    { $set: { 'billing.autoRenew': false } }
  );

  return cancelled;
}

export async function reactivateSubscription(householdId) {
  const sub = await Subscription.findOne({ householdId });
  if (!sub?.stripeSubscriptionId) throw new Error('No subscription to reactivate');

  const reactivated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await Subscription.updateOne(
    { householdId },
    { $set: { 'billing.autoRenew': true } }
  );

  return reactivated;
}

export async function createPortalSession(householdId, returnUrl) {
  const household = await Household.findOne({ householdId });
  const customerId = household?.subscription?.stripeCustomerId;
  if (!customerId) throw new Error('No Stripe customer found');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${process.env.FRONTEND_URL}/subscription`,
  });

  return session;
}

// ============================================================
// Webhook Event Handling
// ============================================================

export function constructWebhookEvent(payload, sig) {
  return stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
}

export async function handleSubscriptionCreated(stripeSubscription) {
  const { householdId, planId } = stripeSubscription.metadata;
  if (!householdId) return;

  const plan = PLANS[planId] || PLANS.free;

  await Subscription.findOneAndUpdate(
    { householdId },
    {
      $set: {
        stripeSubscriptionId: stripeSubscription.id,
        'plan.type': planId,
        'billing.status': stripeSubscription.status === 'trialing' ? 'active' : stripeSubscription.status,
        'billing.currentPeriodStart': new Date(stripeSubscription.current_period_start * 1000),
        'billing.currentPeriodEnd': new Date(stripeSubscription.current_period_end * 1000),
        'billing.autoRenew': true,
        features: plan.features,
      },
    },
    { upsert: true, new: true }
  );

  await Household.updateOne(
    { householdId },
    { $set: { 'subscription.planId': planId, 'subscription.status': 'active' } }
  );
}

export async function handleSubscriptionUpdated(stripeSubscription) {
  const { householdId, planId } = stripeSubscription.metadata;
  if (!householdId) return;

  const plan = PLANS[planId] || PLANS.free;
  const status = stripeSubscription.cancel_at_period_end ? 'active' : stripeSubscription.status;

  await Subscription.findOneAndUpdate(
    { householdId },
    {
      $set: {
        'plan.type': planId || 'free',
        'billing.status': status,
        'billing.currentPeriodStart': new Date(stripeSubscription.current_period_start * 1000),
        'billing.currentPeriodEnd': new Date(stripeSubscription.current_period_end * 1000),
        'billing.autoRenew': !stripeSubscription.cancel_at_period_end,
        features: plan.features,
      },
    },
    { upsert: true }
  );
}

export async function handleSubscriptionDeleted(stripeSubscription) {
  const { householdId } = stripeSubscription.metadata;
  if (!householdId) return;

  await Subscription.findOneAndUpdate(
    { householdId },
    {
      $set: {
        'plan.type': 'free',
        'billing.status': 'canceled',
        'billing.autoRenew': false,
        features: PLANS.free.features,
        stripeSubscriptionId: null,
      },
    },
    { upsert: true }
  );

  await Household.updateOne(
    { householdId },
    { $set: { 'subscription.planId': 'free', 'subscription.status': 'inactive' } }
  );
}

export async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;
  const household = await Household.findOne({ 'subscription.stripeCustomerId': customerId });
  if (!household) return;

  await Subscription.updateOne(
    { householdId: household.householdId },
    { $set: { 'billing.status': 'active' } }
  );
}

export async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const household = await Household.findOne({ 'subscription.stripeCustomerId': customerId });
  if (!household) return;

  await Subscription.updateOne(
    { householdId: household.householdId },
    { $set: { 'billing.status': 'past_due' } }
  );
}

export default stripe;
