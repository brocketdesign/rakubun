import { getDb } from './mongodb.js';

// ─── Plan Definitions ──────────────────────────────────────────────────────────

export type PlanId = 'free' | 'basic' | 'premium';

export interface PlanLimits {
  maxSites: number;
  maxArticlesPerMonth: number;
  maxSchedules: number;
  analysisEnabled: boolean;
  researchEnabled: boolean;
  cronJobsEnabled: boolean;
  imageGenerationEnabled: boolean;
  apiAccessEnabled: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxSites: 1,
    maxArticlesPerMonth: 3,
    maxSchedules: 3,
    analysisEnabled: false,
    researchEnabled: false,
    cronJobsEnabled: false,
    imageGenerationEnabled: false,
    apiAccessEnabled: false,
  },
  basic: {
    maxSites: 3,
    maxArticlesPerMonth: 30,
    maxSchedules: 10,
    analysisEnabled: false,
    researchEnabled: false,
    cronJobsEnabled: true,
    imageGenerationEnabled: true,
    apiAccessEnabled: false,
  },
  premium: {
    maxSites: -1, // unlimited
    maxArticlesPerMonth: -1, // unlimited
    maxSchedules: -1, // unlimited
    analysisEnabled: true,
    researchEnabled: true,
    cronJobsEnabled: true,
    imageGenerationEnabled: true,
    apiAccessEnabled: true,
  },
};

// Stripe Price IDs → Plan mapping (set in .env or Stripe dashboard)
// These must be created in Stripe and the IDs placed here or in env vars
export const STRIPE_PRICE_TO_PLAN: Record<string, PlanId> = {
  [process.env.STRIPE_BASIC_PRICE_MONTHLY || 'price_basic_monthly']: 'basic',
  [process.env.STRIPE_BASIC_PRICE_YEARLY || 'price_basic_yearly']: 'basic',
  [process.env.STRIPE_PREMIUM_PRICE_MONTHLY || 'price_premium_monthly']: 'premium',
  [process.env.STRIPE_PREMIUM_PRICE_YEARLY || 'price_premium_yearly']: 'premium',
};

// ─── Subscription Document ─────────────────────────────────────────────────────

export interface SubscriptionDoc {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: PlanId;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  articlesUsedThisPeriod: number;
  periodResetAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

export async function getUserSubscription(userId: string): Promise<SubscriptionDoc | null> {
  const db = await getDb();
  const doc = await db.collection('subscriptions').findOne({ userId });
  return doc as unknown as SubscriptionDoc | null;
}

export async function getEffectivePlan(userId: string): Promise<PlanId> {
  const sub = await getUserSubscription(userId);
  if (!sub) return 'free';
  if (sub.status === 'active' || sub.status === 'trialing') {
    return sub.plan;
  }
  return 'free';
}

export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const plan = await getEffectivePlan(userId);
  return PLAN_LIMITS[plan];
}

export async function getUsage(userId: string): Promise<{
  sitesCount: number;
  articlesThisPeriod: number;
  schedulesCount: number;
}> {
  const db = await getDb();
  const [sitesCount, schedulesCount] = await Promise.all([
    db.collection('sites').countDocuments({ userId }),
    db.collection('schedules').countDocuments({ userId }),
  ]);

  const sub = await getUserSubscription(userId);
  const articlesThisPeriod = sub?.articlesUsedThisPeriod || 0;

  return { sitesCount, articlesThisPeriod, schedulesCount };
}

export async function incrementArticleUsage(userId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Check if period needs resetting
  const sub = await getUserSubscription(userId);
  if (sub && sub.periodResetAt && new Date(sub.periodResetAt) <= new Date()) {
    // Reset counter for new period
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    await db.collection('subscriptions').updateOne(
      { userId },
      {
        $set: {
          articlesUsedThisPeriod: 1,
          periodResetAt: nextReset.toISOString(),
          updatedAt: now,
        },
      },
    );
  } else if (sub) {
    await db.collection('subscriptions').updateOne(
      { userId },
      {
        $inc: { articlesUsedThisPeriod: 1 },
        $set: { updatedAt: now },
      },
    );
  } else {
    // No subscription doc yet (free user) — create a tracking doc
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    await db.collection('subscriptions').updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          stripeCustomerId: '',
          stripeSubscriptionId: '',
          stripePriceId: '',
          plan: 'free' as PlanId,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: nextReset.toISOString(),
          cancelAtPeriodEnd: false,
          periodResetAt: nextReset.toISOString(),
          createdAt: now,
        },
        $inc: { articlesUsedThisPeriod: 1 },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
  }
}

// ─── Feature Gate Checks ────────────────────────────────────────────────────────

export class FeatureGateError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.status = 403;
    this.code = code;
  }
}

export async function enforceSiteLimit(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (limits.maxSites === -1) return; // unlimited

  const usage = await getUsage(userId);
  if (usage.sitesCount >= limits.maxSites) {
    const plan = await getEffectivePlan(userId);
    throw new FeatureGateError(
      'SITE_LIMIT_REACHED',
      `Your ${plan} plan allows up to ${limits.maxSites} site${limits.maxSites === 1 ? '' : 's'}. Please upgrade to add more sites.`,
    );
  }
}

export async function enforceArticleLimit(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (limits.maxArticlesPerMonth === -1) return; // unlimited

  const usage = await getUsage(userId);
  if (usage.articlesThisPeriod >= limits.maxArticlesPerMonth) {
    const plan = await getEffectivePlan(userId);
    throw new FeatureGateError(
      'ARTICLE_LIMIT_REACHED',
      `Your ${plan} plan allows up to ${limits.maxArticlesPerMonth} articles per month. Please upgrade for more.`,
    );
  }
}

export async function enforceScheduleLimit(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (limits.maxSchedules === -1) return; // unlimited

  const usage = await getUsage(userId);
  if (usage.schedulesCount >= limits.maxSchedules) {
    const plan = await getEffectivePlan(userId);
    throw new FeatureGateError(
      'SCHEDULE_LIMIT_REACHED',
      `Your ${plan} plan allows up to ${limits.maxSchedules} schedules. Please upgrade for more.`,
    );
  }
}

export async function enforceAnalysisAccess(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (!limits.analysisEnabled) {
    throw new FeatureGateError(
      'ANALYSIS_PREMIUM_ONLY',
      'AI Analysis is a premium feature. Please upgrade to access it.',
    );
  }
}

export async function enforceResearchAccess(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (!limits.researchEnabled) {
    throw new FeatureGateError(
      'RESEARCH_PREMIUM_ONLY',
      'Research is a premium feature. Please upgrade to access it.',
    );
  }
}

export async function enforceCronJobAccess(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (!limits.cronJobsEnabled) {
    throw new FeatureGateError(
      'CRON_JOBS_PREMIUM_ONLY',
      'Cron Jobs are available on Basic and Premium plans. Please upgrade to access them.',
    );
  }
}

export async function enforceApiAccess(userId: string): Promise<void> {
  const limits = await getPlanLimits(userId);
  if (!limits.apiAccessEnabled) {
    throw new FeatureGateError(
      'API_ACCESS_PREMIUM_ONLY',
      'API access is a premium feature. Please upgrade to access it.',
    );
  }
}
