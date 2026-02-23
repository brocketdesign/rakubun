import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface NewApiKeyResult {
  id: string;
  name: string;
  key: string; // Full key — shown only once
  createdAt: string;
}

// ─── Store (singleton, external to React) ────────────────────────────────────

let apiKeys: ApiKey[] = [];
let loading = false;
let loaded = false;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getApiKeysSnapshot = () => apiKeys;
const getLoadingSnapshot = () => loading;

// ─── Actions ────────────────────────────────────────────────────────────────────

export const apiKeysActions = {
  async loadApiKeys(getToken: () => Promise<string | null>) {
    if (loaded || loading) return;
    loading = true;
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ apiKeys: ApiKey[] }>('/api/agent/api-keys');
      apiKeys = data.apiKeys;
      loaded = true;
    } catch (e) {
      console.error('Failed to load API keys:', e);
    } finally {
      loading = false;
      emitChange();
    }
  },

  async createApiKey(
    getToken: () => Promise<string | null>,
    name: string,
  ): Promise<NewApiKeyResult> {
    const api = createApiClient(getToken);
    const result = await api.post<NewApiKeyResult>('/api/agent/api-keys', { name });

    // Refresh the list
    apiKeys = [
      {
        id: result.id,
        name: result.name,
        keyPrefix: result.key.substring(0, 12) + '...',
        createdAt: result.createdAt,
        lastUsedAt: null,
      },
      ...apiKeys,
    ];
    emitChange();

    return result;
  },

  async revokeApiKey(getToken: () => Promise<string | null>, keyId: string) {
    const api = createApiClient(getToken);
    await api.del(`/api/agent/api-keys?id=${keyId}`);

    apiKeys = apiKeys.filter((k) => k.id !== keyId);
    emitChange();
  },

  async refreshApiKeys(getToken: () => Promise<string | null>) {
    loading = true;
    emitChange();

    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ apiKeys: ApiKey[] }>('/api/agent/api-keys');
      apiKeys = data.apiKeys;
      loaded = true;
    } catch (e) {
      console.error('Failed to refresh API keys:', e);
    } finally {
      loading = false;
      emitChange();
    }
  },
};

// ─── React Hooks ─────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useSyncExternalStore(subscribe, getApiKeysSnapshot);
}

export function useApiKeysLoading() {
  return useSyncExternalStore(subscribe, getLoadingSnapshot);
}
