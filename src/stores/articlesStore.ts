import { useSyncExternalStore } from 'react';
import { createApiClient } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ArticleStatus = 'published' | 'scheduled' | 'draft' | 'generating';

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  site: string;
  category: string;
  status: ArticleStatus;
  wordCount: number;
  seoScore: number;
  views: number;
  thumbnailUrl: string;
  imageUrls: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  wpPostId?: number;
  wpUrl?: string;
}

export type SortField = 'createdAt' | 'title' | 'wordCount' | 'seoScore' | 'views';
export type SortOrder = 'asc' | 'desc';

// ─── Store (singleton, external to React) ──────────────────────────────────────

let articles: Article[] = [];
let loading = false;
let loaded = false;
let generating = false; // global flag for any generation in progress
const listeners: Set<() => void> = new Set();

function emitChange() {
  listeners.forEach((l) => l());
}

function getArticlesSnapshot(): Article[] {
  return articles;
}

function getLoadingSnapshot(): boolean {
  return loading;
}

function getGeneratingSnapshot(): boolean {
  return generating;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mapArticleFromApi(raw: Record<string, unknown>): Article {
  return {
    id: raw.id as string,
    title: (raw.title as string) || 'Untitled',
    excerpt: (raw.excerpt as string) || '',
    content: (raw.content as string) || '',
    site: (raw.site as string) || '',
    category: (raw.category as string) || 'Uncategorized',
    status: (raw.status as ArticleStatus) || 'draft',
    wordCount: (raw.wordCount as number) || 0,
    seoScore: (raw.seoScore as number) || 0,
    views: (raw.views as number) || 0,
    thumbnailUrl: (raw.thumbnailUrl as string) || '',
    imageUrls: (raw.imageUrls as string[]) || [],
    scheduledAt: (raw.scheduledAt as string) || null,
    publishedAt: (raw.publishedAt as string) || null,
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
    wpPostId: (raw.wpPostId as number) || undefined,
    wpUrl: (raw.wpUrl as string) || undefined,
  };
}

type GetToken = () => Promise<string | null>;

// ─── Actions ────────────────────────────────────────────────────────────────────

export const articlesActions = {
  async loadArticles(getToken: GetToken): Promise<void> {
    if (loading) return;
    loading = true;
    emitChange();
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ articles: Record<string, unknown>[]; total: number }>('/api/articles');
      articles = data.articles.map(mapArticleFromApi);
      loaded = true;
      emitChange();
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      loading = false;
      emitChange();
    }
  },

  async generateArticle(
    getToken: GetToken,
    data: {
      prompt: string;
      useWebSearch: boolean;
      imageCount: number;
      generateThumbnail: boolean;
      site: string;
      category: string;
    },
  ): Promise<Article | null> {
    generating = true;
    emitChange();
    try {
      const api = createApiClient(getToken);
      const raw = await api.post<Record<string, unknown>>('/api/articles/generate', data);
      const article = mapArticleFromApi(raw);

      // Replace any existing generating placeholder or add new
      const existingIdx = articles.findIndex((a) => a.id === article.id);
      if (existingIdx >= 0) {
        articles = [...articles];
        articles[existingIdx] = article;
      } else {
        articles = [article, ...articles];
      }
      emitChange();
      return article;
    } catch (err) {
      console.error('Failed to generate article:', err);
      return null;
    } finally {
      generating = false;
      emitChange();
    }
  },

  async updateArticle(
    getToken: GetToken,
    id: string,
    updates: Partial<Omit<Article, 'id'>>,
  ): Promise<Article | null> {
    try {
      const api = createApiClient(getToken);
      const raw = await api.put<Record<string, unknown>>(`/api/articles/${id}`, updates);
      const updated = mapArticleFromApi(raw);
      articles = articles.map((a) => (a.id === id ? updated : a));
      emitChange();
      return updated;
    } catch (err) {
      console.error('Failed to update article:', err);
      return null;
    }
  },

  async deleteArticle(getToken: GetToken, id: string): Promise<boolean> {
    try {
      const api = createApiClient(getToken);
      await api.del(`/api/articles/${id}`);
      articles = articles.filter((a) => a.id !== id);
      emitChange();
      return true;
    } catch (err) {
      console.error('Failed to delete article:', err);
      return false;
    }
  },

  async duplicateArticle(getToken: GetToken, id: string): Promise<Article | null> {
    const source = articles.find((a) => a.id === id);
    if (!source) return null;
    try {
      const api = createApiClient(getToken);
      const raw = await api.post<Record<string, unknown>>('/api/articles', {
        title: `${source.title} (Copy)`,
        excerpt: source.excerpt,
        content: source.content,
        site: source.site,
        category: source.category,
        status: 'draft',
        thumbnailUrl: source.thumbnailUrl,
        imageUrls: source.imageUrls,
      });
      const newArticle = mapArticleFromApi(raw);
      articles = [newArticle, ...articles];
      emitChange();
      return newArticle;
    } catch (err) {
      console.error('Failed to duplicate article:', err);
      return null;
    }
  },

  async publishArticle(getToken: GetToken, id: string): Promise<Article | null> {
    return articlesActions.updateArticle(getToken, id, { status: 'published' });
  },

  async scheduleArticle(
    getToken: GetToken,
    id: string,
    scheduledAt: string,
  ): Promise<Article | null> {
    return articlesActions.updateArticle(getToken, id, {
      status: 'scheduled',
      scheduledAt,
    });
  },

  async saveDraft(
    getToken: GetToken,
    id: string,
    updates: Partial<Omit<Article, 'id'>>,
  ): Promise<Article | null> {
    return articlesActions.updateArticle(getToken, id, { ...updates, status: 'draft' });
  },

  isLoaded(): boolean {
    return loaded;
  },

  /** Sync article statuses from WordPress and reload the list. */
  async syncStatuses(getToken: GetToken): Promise<{ updated: number; errors: number }> {
    try {
      const api = createApiClient(getToken);
      const result = await api.post<{
        updated: { id: string; status: string; wpUrl: string }[];
        unchanged: number;
        errors: number;
      }>('/api/articles/sync-status', {});

      // Reload articles so the UI reflects any changes
      if (result.updated.length > 0) {
        await articlesActions.loadArticles(getToken);
      }

      return { updated: result.updated.length, errors: result.errors };
    } catch (err) {
      console.error('Failed to sync article statuses:', err);
      return { updated: 0, errors: -1 };
    }
  },
};

// ─── React Hooks ────────────────────────────────────────────────────────────────

export function useArticles(): Article[] {
  return useSyncExternalStore(subscribe, getArticlesSnapshot, getArticlesSnapshot);
}

export function useArticlesLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot);
}

export function useArticlesGenerating(): boolean {
  return useSyncExternalStore(subscribe, getGeneratingSnapshot, getGeneratingSnapshot);
}
