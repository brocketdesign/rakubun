import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AnalysisScores {
  seoScore: number;
  toneScore: number;
  structureScore: number;
  contentGaps: number;
}

export interface AnalysisCategory {
  category: string;
  score: number;
  issues: string[];
  suggestions: string[];
}

export interface AnalysisReport {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  scores: AnalysisScores | null;
  categories: AnalysisCategory[];
  summary: string | null;
  pagesAnalyzed: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Store State ───────────────────────────────────────────────────────────────

interface AnalysisState {
  reports: AnalysisReport[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  runningAnalysis: boolean;
  selectedReport: AnalysisReport | null;
  selectedReportLoading: boolean;
}

const state: AnalysisState = {
  reports: [],
  loading: false,
  loaded: false,
  error: null,
  runningAnalysis: false,
  selectedReport: null,
  selectedReportLoading: false,
};

const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): AnalysisState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Polling logic ──────────────────────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling(getToken: GetToken, siteId?: string) {
  stopPolling();
  pollInterval = setInterval(() => {
    const hasInProgress = state.reports.some((r) => r.status === 'in-progress' || r.status === 'pending');
    if (hasInProgress) {
      analysisActions.loadReports(getToken, siteId, true);
    } else {
      stopPolling();
    }
  }, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ─── Actions ───────────────────────────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

export const analysisActions = {
  async loadReports(getToken: GetToken, siteId?: string, silent = false): Promise<void> {
    if (!silent) {
      state.loading = true;
      state.error = null;
      emitChange();
    }

    try {
      const api = createApiClient(getToken);
      const params = siteId ? `?siteId=${siteId}` : '';
      const data = await api.get<{ reports: AnalysisReport[] }>(`/api/analysis/list${params}`);
      state.reports = data.reports;
      state.loaded = true;

      // Auto-poll if any report is in-progress
      const hasInProgress = data.reports.some((r) => r.status === 'in-progress' || r.status === 'pending');
      if (hasInProgress && !pollInterval) {
        startPolling(getToken, siteId);
      }
    } catch (err) {
      if (!silent) {
        state.error = err instanceof Error ? err.message : 'Failed to load reports';
      }
    } finally {
      if (!silent) {
        state.loading = false;
      }
      emitChange();
    }
  },

  async runAnalysis(getToken: GetToken, siteId: string): Promise<string | null> {
    state.runningAnalysis = true;
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.post<{ id: string; status: string }>('/api/analysis/run', { siteId });

      // Add the new in-progress report to the list
      const newReport: AnalysisReport = {
        id: data.id,
        siteId,
        siteName: '',
        siteUrl: '',
        status: 'in-progress',
        progress: 0,
        scores: null,
        categories: [],
        summary: null,
        pagesAnalyzed: 0,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      state.reports = [newReport, ...state.reports];

      // Start polling
      startPolling(getToken, undefined);

      return data.id;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to start analysis';
      return null;
    } finally {
      state.runningAnalysis = false;
      emitChange();
    }
  },

  async loadReportDetail(getToken: GetToken, reportId: string): Promise<void> {
    state.selectedReportLoading = true;
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.get<AnalysisReport>(`/api/analysis/detail?reportId=${reportId}`);
      state.selectedReport = data;
    } catch (err) {
      console.error('Failed to load report detail:', err);
    } finally {
      state.selectedReportLoading = false;
      emitChange();
    }
  },

  async deleteReport(getToken: GetToken, reportId: string): Promise<void> {
    try {
      const api = createApiClient(getToken);
      await api.del(`/api/analysis/delete?reportId=${reportId}`);
      state.reports = state.reports.filter((r) => r.id !== reportId);
      if (state.selectedReport?.id === reportId) {
        state.selectedReport = null;
      }
      emitChange();
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  },

  clearSelectedReport(): void {
    state.selectedReport = null;
    emitChange();
  },

  cleanup(): void {
    stopPolling();
  },

  isLoaded(): boolean {
    return state.loaded;
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useAnalysisReports(): AnalysisReport[] {
  return useSyncExternalStore(subscribe, () => getSnapshot().reports, () => getSnapshot().reports);
}

export function useAnalysisLoading(): boolean {
  return useSyncExternalStore(subscribe, () => getSnapshot().loading, () => getSnapshot().loading);
}

export function useAnalysisError(): string | null {
  return useSyncExternalStore(subscribe, () => getSnapshot().error, () => getSnapshot().error);
}

export function useRunningAnalysis(): boolean {
  return useSyncExternalStore(subscribe, () => getSnapshot().runningAnalysis, () => getSnapshot().runningAnalysis);
}

export function useSelectedReport(): AnalysisReport | null {
  return useSyncExternalStore(subscribe, () => getSnapshot().selectedReport, () => getSnapshot().selectedReport);
}

export function useSelectedReportLoading(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().selectedReportLoading,
    () => getSnapshot().selectedReportLoading,
  );
}
