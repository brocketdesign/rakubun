import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ResearchResult {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  date: string;
  relevance: number;
  provider?: 'openai' | 'firecrawl';
}

// ─── Store (singleton, external to React) ──────────────────────────────────────

let results: ResearchResult[] = [];
let loading = false;
let deepResearchLoading = false;
let deepResearchReport = '';
let lastQuery = '';
let savedIds: Set<string> = new Set();
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

function getResultsSnapshot(): ResearchResult[] {
  return results;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function getLastQuerySnapshot(): string {
  return lastQuery;
}

function getSavedIdsSnapshot(): Set<string> {
  return savedIds;
}

function getDeepResearchLoadingSnapshot(): boolean {
  return deepResearchLoading;
}

function getDeepResearchReportSnapshot(): string {
  return deepResearchReport;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

export const researchActions = {
  async search(
    getToken: GetToken,
    params: { query?: string; siteId?: string },
  ): Promise<void> {
    loading = true;
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.post<{
        results: ResearchResult[];
        query: string;
        total: number;
      }>('/api/research/search', params);

      results = data.results;
      lastQuery = data.query;
    } catch (err) {
      console.error('Research search failed:', err);
      results = [];
    } finally {
      loading = false;
      emitChange();
    }
  },

  async deepResearch(
    getToken: GetToken,
    params: { query: string; siteId?: string },
  ): Promise<void> {
    deepResearchLoading = true;
    deepResearchReport = '';
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.post<{
        report: string;
        query: string;
      }>('/api/research/deep-research', params);

      deepResearchReport = data.report;
    } catch (err) {
      console.error('Deep research failed:', err);
      deepResearchReport = '';
    } finally {
      deepResearchLoading = false;
      emitChange();
    }
  },

  toggleSave(id: string) {
    const next = new Set(savedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    savedIds = next;
    emitChange();
  },

  isSaved(id: string): boolean {
    return savedIds.has(id);
  },

  clearResults() {
    results = [];
    lastQuery = '';
    emitChange();
  },

  clearDeepResearch() {
    deepResearchReport = '';
    emitChange();
  },
};

// ─── Hooks ──────────────────────────────────────────────────────────────────────

export function useResearchResults(): ResearchResult[] {
  return useSyncExternalStore(subscribe, getResultsSnapshot);
}

export function useResearchLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot);
}

export function useResearchLastQuery(): string {
  return useSyncExternalStore(subscribe, getLastQuerySnapshot);
}

export function useResearchSavedIds(): Set<string> {
  return useSyncExternalStore(subscribe, getSavedIdsSnapshot);
}

export function useDeepResearchLoading(): boolean {
  return useSyncExternalStore(subscribe, getDeepResearchLoadingSnapshot);
}

export function useDeepResearchReport(): string {
  return useSyncExternalStore(subscribe, getDeepResearchReportSnapshot);
}
