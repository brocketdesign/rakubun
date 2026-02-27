import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type NotificationType = 'article' | 'ai' | 'site' | 'system' | 'schedule';

export interface Notification {
  id: string;
  type: NotificationType;
  title: { en: string; ja: string };
  message: { en: string; ja: string };
  read: boolean;
  actionUrl?: string;
  createdAt: number;
}

export interface NotificationPreference {
  email: boolean;
  inApp: boolean;
}

export interface NotificationPreferences {
  articlePublished: NotificationPreference;
  aiGenerationComplete: NotificationPreference;
  siteConnectionIssues: NotificationPreference;
  scheduledReminders: NotificationPreference;
  weeklyAnalytics: NotificationPreference;
  systemUpdates: NotificationPreference;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  primaryEmail: string;
  additionalEmail: string;
  preferences: NotificationPreferences;
}

// ─── Store (singleton, external to React) ──────────────────────────────────────

let notifications: Notification[] = [];
let unreadCount = 0;
let loading = false;
let loaded = false;
let settings: NotificationSettings | null = null;
let settingsLoading = false;
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getNotificationsSnapshot(): Notification[] {
  return notifications;
}

function getUnreadCountSnapshot(): number {
  return unreadCount;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function getSettingsSnapshot(): NotificationSettings | null {
  return settings;
}

function getSettingsLoadingSnapshot(): boolean {
  return settingsLoading;
}

// ─── Actions ────────────────────────────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

async function loadNotifications(getToken: GetToken, filter?: string): Promise<void> {
  loading = true;
  emitChange();
  try {
    const api = createApiClient(getToken);
    const params = filter && filter !== 'all' ? `?filter=${filter}` : '';
    const data = await api.get<{ notifications: Notification[]; total: number; unreadCount: number }>(
      `/api/notifications/list${params}`,
    );
    notifications = data.notifications;
    unreadCount = data.unreadCount;
    loaded = true;
  } catch (err) {
    console.error('Failed to load notifications:', err);
  } finally {
    loading = false;
    emitChange();
  }
}

async function loadUnreadCount(getToken: GetToken): Promise<void> {
  try {
    const api = createApiClient(getToken);
    const data = await api.get<{ unreadCount: number }>('/api/notifications/unread-count');
    unreadCount = data.unreadCount;
    emitChange();
  } catch {
    // Silently fail — badge just stays at old count
  }
}

async function markRead(getToken: GetToken, id: string): Promise<void> {
  // Optimistic update
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  unreadCount = notifications.filter((n) => !n.read).length;
  emitChange();

  try {
    const api = createApiClient(getToken);
    await api.put('/api/notifications/read', { id });
  } catch {
    // Revert on failure — just reload
    // No-op for now; notification already marked locally
  }
}

async function markAllRead(getToken: GetToken): Promise<void> {
  // Optimistic update
  notifications = notifications.map((n) => ({ ...n, read: true }));
  unreadCount = 0;
  emitChange();

  try {
    const api = createApiClient(getToken);
    await api.put('/api/notifications/read-all', {});
  } catch {
    // No-op
  }
}

async function deleteNotification(getToken: GetToken, id: string): Promise<void> {
  // Optimistic update
  const wasUnread = notifications.find((n) => n.id === id && !n.read);
  notifications = notifications.filter((n) => n.id !== id);
  if (wasUnread) unreadCount = Math.max(0, unreadCount - 1);
  emitChange();

  try {
    const api = createApiClient(getToken);
    await api.del(`/api/notifications/delete?id=${id}`);
  } catch {
    // No-op
  }
}

async function loadSettings(getToken: GetToken): Promise<void> {
  settingsLoading = true;
  emitChange();
  try {
    const api = createApiClient(getToken);
    const data = await api.get<{ settings: NotificationSettings }>('/api/notifications/settings');
    settings = data.settings;
  } catch {
    // Use null — component will use default
  } finally {
    settingsLoading = false;
    emitChange();
  }
}

async function saveSettings(getToken: GetToken, newSettings: NotificationSettings): Promise<NotificationSettings> {
  const api = createApiClient(getToken);
  const data = await api.put<{ settings: NotificationSettings }>('/api/notifications/settings', newSettings);
  settings = data.settings;
  emitChange();
  return data.settings;
}

async function updateEmailSettings(getToken: GetToken, primaryEmail: string, additionalEmail: string): Promise<NotificationSettings> {
  const api = createApiClient(getToken);
  const data = await api.put<{ settings: NotificationSettings }>('/api/notifications/settings', { 
    primaryEmail, 
    additionalEmail 
  });
  settings = data.settings;
  emitChange();
  return data.settings;
}

async function sendTestEmail(getToken: GetToken, email: string): Promise<void> {
  const api = createApiClient(getToken);
  await api.post('/api/notifications/test-email', { email });
}

function isLoaded(): boolean {
  return loaded;
}

function isLoading(): boolean {
  return loading;
}

// ─── Exports ────────────────────────────────────────────────────────────────────

export const notificationsActions = {
  loadNotifications,
  loadUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  loadSettings,
  saveSettings,
  updateEmailSettings,
  sendTestEmail,
  isLoaded,
  isLoading,
};

export function useNotifications(): Notification[] {
  return useSyncExternalStore(subscribe, getNotificationsSnapshot);
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, getUnreadCountSnapshot);
}

export function useNotificationsLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot);
}

export function useNotificationSettings(): NotificationSettings | null {
  return useSyncExternalStore(subscribe, getSettingsSnapshot);
}

export function useNotificationSettingsLoading(): boolean {
  return useSyncExternalStore(subscribe, getSettingsLoadingSnapshot);
}
