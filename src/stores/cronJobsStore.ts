import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CronDaySchedule {
  day: string; // 'Monday' | 'Tuesday' | ... | 'Sunday'
  time: string; // 24h format e.g. '11:00'
  articleType: string; // e.g. 'Drama/Movie News / ドラマ・映画'
  enabled: boolean;
}

export interface CronJob {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  schedule: CronDaySchedule[];
  language: string;
  wordCountMin: number;
  wordCountMax: number;
  imagesPerArticle: number;
  articlesPerWeek: number;
  style: string;
  emailNotification: string;
  cronJobId: string; // UUID like '3174f211-7579-4a82-aff5-1e3c2ede9d1d'
  status: 'active' | 'paused' | 'draft';
  createdAt: string;
  updatedAt: string;
}

// ─── Store (singleton, external to React) ──────────────────────────────────────

let cronJobs: CronJob[] = [];
let loading = false;
let loaded = false;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getCronJobsSnapshot(): CronJob[] {
  return cronJobs;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mapCronJobFromApi(raw: Record<string, unknown>): CronJob {
  return {
    id: raw.id as string,
    siteId: (raw.siteId as string) || '',
    siteName: (raw.siteName as string) || '',
    siteUrl: (raw.siteUrl as string) || '',
    schedule: (raw.schedule as CronDaySchedule[]) || [],
    language: (raw.language as string) || 'ja',
    wordCountMin: (raw.wordCountMin as number) || 1000,
    wordCountMax: (raw.wordCountMax as number) || 1500,
    imagesPerArticle: (raw.imagesPerArticle as number) || 4,
    articlesPerWeek: (raw.articlesPerWeek as number) || 7,
    style: (raw.style as string) || '',
    emailNotification: (raw.emailNotification as string) || '',
    cronJobId: (raw.cronJobId as string) || '',
    status: (raw.status as CronJob['status']) || 'draft',
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
  };
}

type GetToken = () => Promise<string | null>;

// ─── Actions ────────────────────────────────────────────────────────────────────

export const cronJobsActions = {
  async loadCronJobs(getToken: GetToken): Promise<void> {
    if (loading) return;
    loading = true;
    emitChange();
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ cronJobs: Record<string, unknown>[] }>('/api/cron-jobs');
      cronJobs = data.cronJobs.map(mapCronJobFromApi);
      loaded = true;
      emitChange();
    } catch (err) {
      console.error('Failed to load cron jobs:', err);
    } finally {
      loading = false;
      emitChange();
    }
  },

  async createCronJob(
    getToken: GetToken,
    data: Omit<CronJob, 'id' | 'createdAt' | 'updatedAt' | 'cronJobId'>,
  ): Promise<CronJob | null> {
    try {
      const api = createApiClient(getToken);
      const raw = await api.post<Record<string, unknown>>('/api/cron-jobs', data);
      const job = mapCronJobFromApi(raw);
      cronJobs = [job, ...cronJobs];
      emitChange();
      return job;
    } catch (err) {
      console.error('Failed to create cron job:', err);
      return null;
    }
  },

  async updateCronJob(
    getToken: GetToken,
    id: string,
    updates: Partial<Omit<CronJob, 'id' | 'createdAt'>>,
  ): Promise<CronJob | null> {
    try {
      const api = createApiClient(getToken);
      const raw = await api.put<Record<string, unknown>>(`/api/cron-jobs/${id}`, updates);
      const updated = mapCronJobFromApi(raw);
      cronJobs = cronJobs.map((j) => (j.id === id ? updated : j));
      emitChange();
      return updated;
    } catch (err) {
      console.error('Failed to update cron job:', err);
      return null;
    }
  },

  async deleteCronJob(getToken: GetToken, id: string): Promise<boolean> {
    try {
      const api = createApiClient(getToken);
      await api.del(`/api/cron-jobs/${id}`);
      cronJobs = cronJobs.filter((j) => j.id !== id);
      emitChange();
      return true;
    } catch (err) {
      console.error('Failed to delete cron job:', err);
      return false;
    }
  },

  async analyzeSiteCategories(
    getToken: GetToken,
    siteId: string,
  ): Promise<{ categories: { id: number; name: string; slug: string; count: number }[] } | null> {
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ categories: { id: number; name: string; slug: string; count: number }[] }>(
        `/api/sites/${siteId}/categories`,
      );
      return data;
    } catch (err) {
      console.error('Failed to fetch site categories:', err);
      return null;
    }
  },

  async generateSchedule(
    getToken: GetToken,
    siteId: string,
    articlesPerWeek: number = 7,
  ): Promise<{ schedule: CronDaySchedule[]; style: string; language: string } | null> {
    try {
      const api = createApiClient(getToken);
      const data = await api.post<{ schedule: CronDaySchedule[]; style: string; language: string }>(
        '/api/cron-jobs/generate-schedule',
        { siteId, articlesPerWeek },
      );
      return data;
    } catch (err) {
      console.error('Failed to generate schedule:', err);
      return null;
    }
  },

  isLoaded(): boolean {
    return loaded;
  },

  isLoading(): boolean {
    return loading;
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useCronJobs(): CronJob[] {
  return useSyncExternalStore(subscribe, getCronJobsSnapshot, getCronJobsSnapshot);
}

export function useCronJobsLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);
}

export function useCronJobBySiteId(siteId: string): CronJob | undefined {
  const jobs = useCronJobs();
  return jobs.find((j) => j.siteId === siteId);
}
