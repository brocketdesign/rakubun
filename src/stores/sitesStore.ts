import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SiteSettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  defaultCategory: string;
  defaultStatus: 'draft' | 'publish' | 'pending';
  autoImages: boolean;
  seoOptimization: boolean;
  language: string;
  timezone: string;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  username: string;
  status: 'connected' | 'warning' | 'disconnected';
  articlesGenerated: number;
  lastSync: string;
  lastSyncTimestamp: number;
  wpVersion: string;
  favicon: string;
  settings: SiteSettings;
}

// ─── Default settings ─────────────────────────────────────────────────────────

const defaultSettings: SiteSettings = {
  autoSync: true,
  syncInterval: 30,
  defaultCategory: 'Uncategorized',
  defaultStatus: 'draft',
  autoImages: true,
  seoOptimization: true,
  language: 'en',
  timezone: 'UTC',
};

// ─── Store (singleton, external to React) ──────────────────────────────────────

let sites: Site[] = [];
let loading = false;
let loaded = false;
let loadingPromise: Promise<void> | null = null;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): Site[] {
  return sites;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Helper: format relative time ────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function mapSiteFromApi(raw: Record<string, unknown>): Site {
  const ts = (raw.lastSyncTimestamp as number) || Date.now();
  return {
    id: raw.id as string,
    name: raw.name as string,
    url: raw.url as string,
    username: (raw.username as string) || '',
    status: (raw.status as Site['status']) || 'connected',
    articlesGenerated: (raw.articlesGenerated as number) || 0,
    lastSync: formatRelativeTime(ts),
    lastSyncTimestamp: ts,
    wpVersion: (raw.wpVersion as string) || '6.7',
    favicon: (raw.favicon as string) || '🌐',
    settings: { ...defaultSettings, ...(raw.settings as Partial<SiteSettings>) },
  };
}

// ─── Actions (async, API-backed) ─────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

export const sitesActions = {
  async loadSites(getToken: GetToken): Promise<void> {
    if (loadingPromise) return loadingPromise;
    loading = true;
    loadingPromise = (async () => {
      try {
        const api = createApiClient(getToken);
        const data = await api.get<{ sites: Record<string, unknown>[]; total: number }>('/api/sites');
        sites = data.sites.map(mapSiteFromApi);
        loaded = true;
        emitChange();
      } finally {
        loading = false;
        loadingPromise = null;
      }
    })();
    return loadingPromise;
  },

  async addSite(
    getToken: GetToken,
    data: { name: string; url: string; username: string; applicationPassword: string },
  ): Promise<Site> {
    const api = createApiClient(getToken);
    const raw = await api.post<Record<string, unknown>>('/api/sites', data);
    const newSite = mapSiteFromApi(raw);
    sites = [...sites, newSite];
    emitChange();
    return newSite;
  },

  async deleteSite(getToken: GetToken, id: string): Promise<boolean> {
    const api = createApiClient(getToken);
    await api.del(`/api/sites/${id}`);
    sites = sites.filter((s) => s.id !== id);
    emitChange();
    return true;
  },

  async syncSite(getToken: GetToken, id: string): Promise<Site | null> {
    const api = createApiClient(getToken);
    const raw = await api.post<Record<string, unknown>>(`/api/sites/${id}/sync`, {});
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const updated: Site = {
      ...sites[idx],
      status: 'connected',
      lastSync: 'Just now',
      lastSyncTimestamp: (raw.lastSyncTimestamp as number) || Date.now(),
    };
    sites = [...sites];
    sites[idx] = updated;
    emitChange();
    return updated;
  },

  async updateSettings(
    getToken: GetToken,
    id: string,
    settings: Partial<SiteSettings>,
  ): Promise<Site | null> {
    const api = createApiClient(getToken);
    const raw = await api.put<Record<string, unknown>>(`/api/sites/${id}/settings`, settings);
    const idx = sites.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const updated: Site = {
      ...sites[idx],
      settings: { ...sites[idx].settings, ...(raw.settings as Partial<SiteSettings>) },
    };
    sites = [...sites];
    sites[idx] = updated;
    emitChange();
    return updated;
  },

  async updateCredentials(
    getToken: GetToken,
    id: string,
    credentials: { username?: string; applicationPassword?: string },
  ): Promise<boolean> {
    const api = createApiClient(getToken);
    const raw = await api.put<Record<string, unknown>>(`/api/sites/${id}`, credentials);
    const idx = sites.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const updated: Site = {
        ...sites[idx],
        username: (raw.username as string) || sites[idx].username,
      };
      sites = [...sites];
      sites[idx] = updated;
      emitChange();
    }
    return !!(raw.success);
  },

  isLoaded(): boolean {
    return loaded;
  },

  isLoading(): boolean {
    return loading;
  },

  /** Refresh lastSync display strings based on timestamps */
  refreshRelativeTimes(): void {
    let changed = false;
    const updated = sites.map((s) => {
      const newLastSync = formatRelativeTime(s.lastSyncTimestamp);
      if (newLastSync !== s.lastSync) {
        changed = true;
        return { ...s, lastSync: newLastSync };
      }
      return s;
    });
    if (changed) {
      sites = updated;
      emitChange();
    }
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useSites(): Site[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSiteById(id: string): Site | undefined {
  const all = useSites();
  return all.find((s) => s.id === id);
}

export function useTotalArticlesGenerated(): number {
  const all = useSites();
  return all.reduce((sum, s) => sum + s.articlesGenerated, 0);
}

export function useConnectedSitesCount(): number {
  const all = useSites();
  return all.length;
}

export { defaultSettings };
