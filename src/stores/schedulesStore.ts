import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleTopic {
  title: string;
  description: string;
  date: string;
  time: string;
}

export interface Schedule {
  id: string;
  siteId: string;
  topics: ScheduleTopic[];
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// ─── Store (singleton, external to React) ──────────────────────────────────────

let schedules: Schedule[] = [];
let loading = false;
let loaded = false;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSchedulesSnapshot(): Schedule[] {
  return schedules;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mapScheduleFromApi(raw: Record<string, unknown>): Schedule {
  return {
    id: raw.id as string,
    siteId: (raw.siteId as string) || '',
    topics: (raw.topics as ScheduleTopic[]) || [],
    status: (raw.status as Schedule['status']) || 'active',
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
  };
}

type GetToken = () => Promise<string | null>;

// ─── Actions ────────────────────────────────────────────────────────────────────

export const schedulesActions = {
  async loadSchedules(getToken: GetToken): Promise<void> {
    if (loading) return;
    loading = true;
    emitChange();
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ schedules: Record<string, unknown>[] }>('/api/schedules');
      schedules = data.schedules.map(mapScheduleFromApi);
      loaded = true;
      emitChange();
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      loading = false;
      emitChange();
    }
  },

  async createSchedule(
    getToken: GetToken,
    siteId: string,
    topics: ScheduleTopic[],
  ): Promise<Schedule | null> {
    try {
      const api = createApiClient(getToken);
      const raw = await api.post<Record<string, unknown>>('/api/schedules', { siteId, topics });
      const schedule = mapScheduleFromApi(raw);
      schedules = [schedule, ...schedules];
      emitChange();
      return schedule;
    } catch (err) {
      console.error('Failed to create schedule:', err);
      return null;
    }
  },

  async updateSchedule(
    getToken: GetToken,
    id: string,
    updates: { status?: string; topics?: ScheduleTopic[] },
  ): Promise<Schedule | null> {
    try {
      const api = createApiClient(getToken);
      const raw = await api.put<Record<string, unknown>>(`/api/schedules/${id}`, updates);
      const updated = mapScheduleFromApi(raw);
      schedules = schedules.map((s) => (s.id === id ? updated : s));
      emitChange();
      return updated;
    } catch (err) {
      console.error('Failed to update schedule:', err);
      return null;
    }
  },

  async deleteSchedule(getToken: GetToken, id: string): Promise<boolean> {
    try {
      const api = createApiClient(getToken);
      await api.del(`/api/schedules/${id}`);
      schedules = schedules.filter((s) => s.id !== id);
      emitChange();
      return true;
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      return false;
    }
  },

  isLoaded(): boolean {
    return loaded;
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useSchedules(): Schedule[] {
  return useSyncExternalStore(subscribe, getSchedulesSnapshot, getSchedulesSnapshot);
}

export function useSchedulesLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);
}
