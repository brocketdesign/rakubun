import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getDb } from './lib/mongodb.js';
import { authenticateRequest, AuthError } from './lib/auth.js';
import {
  getUserSubscription,
  STRIPE_PRICE_TO_PLAN,
  type PlanId,
  type SubscriptionDoc,
} from './lib/subscription.js';

const stripe = new Stripe(process.env.STRIPE_SECRET!, { apiVersion: '2026-01-28.clover' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query._action as string) || '';

  switch (action) {
    case 'create-checkout':
      return handleCreateCheckout(req, res);
    case 'create-portal':
      return handleCreatePortal(req, res);
    case 'webhook':
      return handleWebhook(req, res);
    case 'status':
      return handleStatus(req, res);
    default:
      return res.status(404).json({ error: 'Not found' });
  }
}

// ─── Create Stripe Checkout Session ─────────────────────────────────────────

async function handleCreateCheckout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const { priceId } = req.body || {};

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    // Find or create Stripe customer
    const db = await getDb();
    const existingSub = await getUserSubscription(userId);
    let customerId = existingSub?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { clerkUserId: userId },
      });
      customerId = customer.id;
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://rakubun.com';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?billing=success`,
      cancel_url: `${origin}/dashboard/settings?billing=canceled`,
      metadata: { clerkUserId: userId },
      subscription_data: {
        metadata: { clerkUserId: userId },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Stripe] Checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

// ─── Create Stripe Customer Portal ──────────────────────────────────────────

async function handleCreatePortal(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const sub = await getUserSubscription(userId);

    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://rakubun.com';

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/dashboard/settings?tab=billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Stripe] Portal error:', err);
    return res.status(500).json({ error: 'Failed to create portal session' });
  }
}

// ─── Webhook ────────────────────────────────────────────────────────────────

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    // For Vercel, the body comes as a parsed object; we need the raw body
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  const db = await getDb();
  const collection = db.collection('subscriptions');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        if (!clerkUserId || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        const priceId = subscription.items.data[0]?.price?.id || '';
        const plan: PlanId = STRIPE_PRICE_TO_PLAN[priceId] || 'basic';

        const now = new Date().toISOString();
        const nextReset = new Date();
        nextReset.setMonth(nextReset.getMonth() + 1);

        await collection.updateOne(
          { userId: clerkUserId },
          {
            $set: {
              userId: clerkUserId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              plan,
              status: 'active',
              currentPeriodStart: new Date((subscription.current_period_start || subscription.start_date) * 1000).toISOString(),
              currentPeriodEnd: new Date((subscription.current_period_end || (subscription.start_date + 30 * 86400)) * 1000).toISOString(),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              periodResetAt: nextReset.toISOString(),
              updatedAt: now,
            },
            $setOnInsert: {
              articlesUsedThisPeriod: 0,
              createdAt: now,
            },
          },
          { upsert: true },
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const clerkUserId = subscription.metadata?.clerkUserId;
        if (!clerkUserId) break;

        const priceId = subscription.items?.data?.[0]?.price?.id || '';
        const plan: PlanId = STRIPE_PRICE_TO_PLAN[priceId] || 'basic';
        const status = mapStripeStatus(subscription.status);

        await collection.updateOne(
          { userId: clerkUserId },
          {
            $set: {
              stripePriceId: priceId,
              plan,
              status,
              currentPeriodStart: new Date((subscription.current_period_start || subscription.start_date) * 1000).toISOString(),
              currentPeriodEnd: new Date((subscription.current_period_end || (subscription.start_date + 30 * 86400)) * 1000).toISOString(),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              updatedAt: new Date().toISOString(),
            },
          },
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const clerkUserId = subscription.metadata?.clerkUserId;
        if (!clerkUserId) break;

        await collection.updateOne(
          { userId: clerkUserId },
          {
            $set: {
              plan: 'free',
              status: 'canceled',
              cancelAtPeriodEnd: false,
              updatedAt: new Date().toISOString(),
            },
          },
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subId = (invoice.subscription as string) || invoice.parent?.subscription_details?.subscription;
        if (!subId) break;

        await collection.updateOne(
          { stripeSubscriptionId: subId },
          {
            $set: {
              status: 'past_due',
              updatedAt: new Date().toISOString(),
            },
          },
        );
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Stripe] Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// ─── Subscription Status ────────────────────────────────────────────────────

async function handleStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await authenticateRequest(req);
    const sub = await getUserSubscription(userId);
    const db = await getDb();

    // Get actual usage counts
    const [sitesCount, schedulesCount, articlesCount] = await Promise.all([
      db.collection('sites').countDocuments({ userId }),
      db.collection('schedules').countDocuments({ userId }),
      Promise.resolve(sub?.articlesUsedThisPeriod || 0),
    ]);

    const plan: PlanId = (sub?.status === 'active' || sub?.status === 'trialing')
      ? (sub.plan as PlanId) || 'free'
      : 'free';

    const { PLAN_LIMITS } = await import('./lib/subscription.js');
    const limits = PLAN_LIMITS[plan];

    return res.status(200).json({
      subscription: sub ? {
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        stripePriceId: sub.stripePriceId,
      } : null,
      plan,
      limits,
      usage: {
        sitesCount,
        articlesThisPeriod: articlesCount,
        schedulesCount,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[Stripe] Status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Utils ──────────────────────────────────────────────────────────────────

function mapStripeStatus(status: string): SubscriptionDoc['status'] {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'canceled';
  }
}
