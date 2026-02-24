import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

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

export interface SubscriptionInfo {
  plan: PlanId;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string;
}

export interface UsageInfo {
  sitesCount: number;
  articlesThisPeriod: number;
  schedulesCount: number;
}

export interface SubscriptionState {
  subscription: SubscriptionInfo | null;
  plan: PlanId;
  limits: PlanLimits;
  usage: UsageInfo;
}

// ─── Default State ──────────────────────────────────────────────────────────────

const DEFAULT_LIMITS: PlanLimits = {
  maxSites: 1,
  maxArticlesPerMonth: 3,
  maxSchedules: 3,
  analysisEnabled: false,
  researchEnabled: false,
  cronJobsEnabled: false,
  imageGenerationEnabled: false,
  apiAccessEnabled: false,
};

const DEFAULT_USAGE: UsageInfo = {
  sitesCount: 0,
  articlesThisPeriod: 0,
  schedulesCount: 0,
};

// ─── Store ──────────────────────────────────────────────────────────────────────

let state: SubscriptionState = {
  subscription: null,
  plan: 'free',
  limits: DEFAULT_LIMITS,
  usage: DEFAULT_USAGE,
};
let loading = false;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getStateSnapshot(): SubscriptionState {
  return state;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Actions ────────────────────────────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

export const subscriptionActions = {
  async loadSubscription(getToken: GetToken): Promise<void> {
    if (loadPromise) return loadPromise;
    loading = true;
    emitChange();

    loadPromise = (async () => {
      try {
        const api = createApiClient(getToken);
        const data = await api.get<{
          subscription: SubscriptionInfo | null;
          plan: PlanId;
          limits: PlanLimits;
          usage: UsageInfo;
        }>('/api/stripe/status');

        state = {
          subscription: data.subscription,
          plan: data.plan,
          limits: data.limits,
          usage: data.usage,
        };
        loaded = true;
      } catch (err) {
        console.error('Failed to load subscription:', err);
      } finally {
        loading = false;
        loadPromise = null;
        emitChange();
      }
    })();

    return loadPromise;
  },

  async createCheckout(getToken: GetToken, priceId: string): Promise<string | null> {
    try {
      const api = createApiClient(getToken);
      const data = await api.post<{ url: string }>('/api/stripe/create-checkout', { priceId });
      return data.url;
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      return null;
    }
  },

  async openPortal(getToken: GetToken): Promise<string | null> {
    try {
      const api = createApiClient(getToken);
      const data = await api.post<{ url: string }>('/api/stripe/create-portal', {});
      return data.url;
    } catch (err) {
      console.error('Failed to create portal session:', err);
      return null;
    }
  },

  isLoaded(): boolean {
    return loaded;
  },

  isLoading(): boolean {
    return loading;
  },

  /** Force refresh after plan change */
  async refresh(getToken: GetToken): Promise<void> {
    loaded = false;
    loadPromise = null;
    return subscriptionActions.loadSubscription(getToken);
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionState {
  return useSyncExternalStore(subscribe, getStateSnapshot, getStateSnapshot);
}

export function useSubscriptionLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);
}

export function useCurrentPlan(): PlanId {
  const s = useSubscription();
  return s.plan;
}

export function usePlanLimits(): PlanLimits {
  const s = useSubscription();
  return s.limits;
}

export function useUsage(): UsageInfo {
  const s = useSubscription();
  return s.usage;
}

// ─── Plan display helpers ───────────────────────────────────────────────────────

export const PLAN_DISPLAY: Record<PlanId, { name: { en: string; ja: string }; color: string; badge: string }> = {
  free: {
    name: { en: 'Free', ja: 'フリー' },
    color: 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-700',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
  basic: {
    name: { en: 'Basic', ja: 'ベーシック' },
    color: 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  premium: {
    name: { en: 'Premium', ja: 'プレミアム' },
    color: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-900',
    badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
  },
};

// ─── Stripe Price IDs (from env or defaults) ───────────────────────────────────

export const STRIPE_PRICES = {
  basic_monthly: import.meta.env.VITE_STRIPE_BASIC_PRICE_MONTHLY || '',
  basic_yearly: import.meta.env.VITE_STRIPE_BASIC_PRICE_YEARLY || '',
  premium_monthly: import.meta.env.VITE_STRIPE_PREMIUM_PRICE_MONTHLY || '',
  premium_yearly: import.meta.env.VITE_STRIPE_PREMIUM_PRICE_YEARLY || '',
};
