import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface GA4Property {
  id: string;
  name: string;
  account: string;
}

export interface AnalyticsOverview {
  pageViews: number;
  totalUsers: number;
  avgEngagementTime: number;
  bounceRate: number;
}

export interface TopPage {
  pageTitle: string;
  pagePath: string;
  pageViews: number;
  totalUsers: number;
}

export interface DailyTrend {
  date: string;
  pageViews: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  topPages: TopPage[];
  dailyTrend: DailyTrend[];
  dateRange: { startDate: string; endDate: string };
  propertyId: string;
}

export interface AnalyticsConnectionStatus {
  connected: boolean;
  propertyId: string | null;
  propertyName: string | null;
  connectedAt?: string;
}

// ─── Store State ───────────────────────────────────────────────────────────────

interface AnalyticsState {
  properties: GA4Property[];
  propertiesLoading: boolean;
  propertiesError: string | null;
  
  data: Record<string, AnalyticsData>; // keyed by siteId
  dataLoading: Record<string, boolean>;
  dataError: Record<string, string | null>;
  
  connectionStatus: Record<string, AnalyticsConnectionStatus>; // keyed by siteId
  statusLoading: Record<string, boolean>;
}

const state: AnalyticsState = {
  properties: [],
  propertiesLoading: false,
  propertiesError: null,
  
  data: {},
  dataLoading: {},
  dataError: {},
  
  connectionStatus: {},
  statusLoading: {},
};

const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): AnalyticsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Actions ───────────────────────────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

export const analyticsActions = {
  // ─── Properties ─────────────────────────────────────────────────────────────
  
  async loadProperties(getToken: GetToken, siteId: string): Promise<void> {
    state.propertiesLoading = true;
    state.propertiesError = null;
    emitChange();
    
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ properties: GA4Property[] }>(`/api/analytics/properties?siteId=${siteId}`);
      state.properties = data.properties;
    } catch (err) {
      state.propertiesError = err instanceof Error ? err.message : 'Failed to load properties';
    } finally {
      state.propertiesLoading = false;
      emitChange();
    }
  },

  clearProperties(): void {
    state.properties = [];
    state.propertiesError = null;
    emitChange();
  },

  // ─── Connection Status ──────────────────────────────────────────────────────
  
  async loadConnectionStatus(getToken: GetToken, siteId: string): Promise<void> {
    state.statusLoading[siteId] = true;
    emitChange();
    
    try {
      const api = createApiClient(getToken);
      const data = await api.get<AnalyticsConnectionStatus>(`/api/analytics/status?siteId=${siteId}`);
      state.connectionStatus[siteId] = data;
    } catch (err) {
      state.connectionStatus[siteId] = {
        connected: false,
        propertyId: null,
        propertyName: null,
      };
    } finally {
      state.statusLoading[siteId] = false;
      emitChange();
    }
  },

  // ─── Connect/Disconnect ─────────────────────────────────────────────────────
  
  async connectProperty(getToken: GetToken, siteId: string, propertyId: string): Promise<void> {
    const api = createApiClient(getToken);
    await api.post(`/api/analytics/connect?siteId=${siteId}`, { propertyId });
    
    // Update local state
    const property = state.properties.find(p => p.id === propertyId);
    state.connectionStatus[siteId] = {
      connected: true,
      propertyId,
      propertyName: property?.name || null,
      connectedAt: new Date().toISOString(),
    };
    emitChange();
  },

  async disconnectProperty(getToken: GetToken, siteId: string): Promise<void> {
    const api = createApiClient(getToken);
    await api.post(`/api/analytics/disconnect?siteId=${siteId}`, {});
    
    // Update local state
    state.connectionStatus[siteId] = {
      connected: false,
      propertyId: null,
      propertyName: null,
    };
    // Clear any cached data
    delete state.data[siteId];
    emitChange();
  },

  // ─── Analytics Data ─────────────────────────────────────────────────────────
  
  async loadAnalyticsData(
    getToken: GetToken, 
    siteId: string, 
    dateRange: { startDate: string; endDate: string }
  ): Promise<void> {
    state.dataLoading[siteId] = true;
    state.dataError[siteId] = null;
    emitChange();
    
    try {
      const api = createApiClient(getToken);
      const data = await api.get<AnalyticsData>(
        `/api/analytics/data?siteId=${siteId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      state.data[siteId] = data;
    } catch (err) {
      state.dataError[siteId] = err instanceof Error ? err.message : 'Failed to load analytics data';
    } finally {
      state.dataLoading[siteId] = false;
      emitChange();
    }
  },

  clearAnalyticsData(siteId: string): void {
    delete state.data[siteId];
    delete state.dataError[siteId];
    emitChange();
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useAnalyticsProperties(): GA4Property[] {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().properties,
    () => getSnapshot().properties
  );
}

export function useAnalyticsPropertiesLoading(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().propertiesLoading,
    () => getSnapshot().propertiesLoading
  );
}

export function useAnalyticsPropertiesError(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().propertiesError,
    () => getSnapshot().propertiesError
  );
}

export function useAnalyticsConnectionStatus(siteId: string): AnalyticsConnectionStatus | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().connectionStatus[siteId],
    () => getSnapshot().connectionStatus[siteId]
  );
}

export function useAnalyticsConnectionStatusLoading(siteId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().statusLoading[siteId] || false,
    () => getSnapshot().statusLoading[siteId] || false
  );
}

export function useAnalyticsData(siteId: string): AnalyticsData | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().data[siteId],
    () => getSnapshot().data[siteId]
  );
}

export function useAnalyticsDataLoading(siteId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().dataLoading[siteId] || false,
    () => getSnapshot().dataLoading[siteId] || false
  );
}

export function useAnalyticsDataError(siteId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().dataError[siteId] || null,
    () => getSnapshot().dataError[siteId] || null
  );
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatPercent(num: number): string {
  return (num * 100).toFixed(1) + '%';
}

export function getDateRangeLabel(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function getRelativeDateRange(days: number): { startDate: string; endDate: string } {
  return {
    startDate: `${days}daysAgo`,
    endDate: 'today',
  };
}
