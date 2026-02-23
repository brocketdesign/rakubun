import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  Loader2,
  Globe,
  Sparkles,
  Image,
  Send,
  X,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Calendar,
  BarChart3,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useSites } from '../../stores/sitesStore';
import { createApiClient } from '../../lib/api';
import { SiteSelector } from '../../components/SiteSelector';
import {
  useArticles,
  useArticlesLoading,
  useArticlesGenerating,
  articlesActions,
  type Article,
  type ArticleStatus,
  type SortField,
  type SortOrder,
} from '../../stores/articlesStore';
import { useSchedules, schedulesActions } from '../../stores/schedulesStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

// ─── Status config ──────────────────────────────────────────────────────────────

const statusConfig: Record<
  ArticleStatus,
  { label: { en: string; ja: string }; class: string; icon: typeof CheckCircle2 }
> = {
  published: {
    label: { en: 'Published', ja: '公開済み' },
    class: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
    icon: CheckCircle2,
  },
  scheduled: {
    label: { en: 'Scheduled', ja: '予約済み' },
    class: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
    icon: Clock,
  },
  draft: {
    label: { en: 'Draft', ja: '下書き' },
    class: 'text-gray-700 bg-gray-50 dark:text-gray-300 dark:bg-gray-500/10',
    icon: FileText,
  },
  generating: {
    label: { en: 'Generating', ja: '生成中' },
    class: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
    icon: Loader2,
  },
};

const statusFilters = ['all', 'published', 'scheduled', 'draft', 'generating'] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: 'en' | 'ja' = 'en'): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function seoColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function seoBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const articles = useArticles();
  const isLoading = useArticlesLoading();
  const isGeneratingGlobal = useArticlesGenerating();
  const sites = useSites();

  // List state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorSite, setEditorSite] = useState('');
  const [editorCategory, setEditorCategory] = useState('Uncategorized');
  const [editorThumbnailUrl, setEditorThumbnailUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [siteCategories, setSiteCategories] = useState<string[]>(['Uncategorized']);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Generate state
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [generateThumbnail, setGenerateThumbnail] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Schedule state
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  // Saving state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // ─── Load articles on mount (always re-fetch to reflect scheduler changes) ──
  useEffect(() => {
    articlesActions.loadArticles(getToken);
  }, [getToken]);

  // Poll for generating articles to check completion
  useEffect(() => {
    const hasGenerating = articles.some((a) => a.status === 'generating');
    if (!hasGenerating) return;
    const interval = setInterval(() => {
      articlesActions.loadArticles(getToken);
    }, 5000);
    return () => clearInterval(interval);
  }, [articles, getToken]);

  // Fetch categories when site changes
  useEffect(() => {
    if (!editorSite) {
      setSiteCategories(['Uncategorized']);
      return;
    }

    const siteObj = sites.find(s => s.id === editorSite);
    if (!siteObj) {
      setSiteCategories(['Uncategorized']);
      return;
    }

    let isMounted = true;
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const url = siteObj.url.startsWith('http') ? siteObj.url : `https://${siteObj.url}`;
        const res = await fetch(`${url}/wp-json/wp/v2/categories`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            const categories = data.map((c: any) => c.name);
            if (categories.length > 0) {
              setSiteCategories(categories);
              setEditorCategory((prev) => (categories.includes(prev) ? prev : categories[0]));
            } else {
              setSiteCategories(['Uncategorized']);
            }
          }
        } else if (isMounted) {
          setSiteCategories(['Uncategorized']);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        if (isMounted) {
          setSiteCategories(['Uncategorized']);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, [editorSite, sites]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filtering & sorting ──────────────────────────────────────────────────────
  const filteredArticles = articles
    .filter((a) => {
      if (activeFilter !== 'all' && a.status !== activeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.site.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'wordCount':
          cmp = a.wordCount - b.wordCount;
          break;
        case 'seoScore':
          cmp = a.seoScore - b.seoScore;
          break;
        case 'views':
          cmp = a.views - b.views;
          break;
        case 'createdAt':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  // ─── Editor actions ──────────────────────────────────────────────────────────
  const openNewArticle = useCallback(() => {
    setEditingArticle(null);
    setEditorTitle('');
    setEditorContent('');
    const defaultSite = sites[0];
    setEditorSite(defaultSite?.id || '');
    setEditorCategory(defaultSite?.settings?.defaultCategory || 'Uncategorized');
    setEditorThumbnailUrl('');
    setShowPreview(false);
    setShowGeneratePanel(true);
    setPrompt('');
    setShowEditor(true);
  }, [sites]);

  const openEditArticle = useCallback((article: Article) => {
    setEditingArticle(article);
    setEditorTitle(article.title);
    setEditorContent(article.content);
    setEditorSite(article.site);
    setEditorCategory(article.category);
    setEditorThumbnailUrl(article.thumbnailUrl);
    setShowPreview(false);
    setShowGeneratePanel(false);
    setShowEditor(true);
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingArticle(null);
    setShowGeneratePanel(false);
    setShowPreview(false);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
      if (editingArticle) {
        await articlesActions.saveDraft(getToken, editingArticle.id, {
          title: editorTitle,
          content: editorContent,
          site: editorSite,  // already a site ID
          category: editorCategory,
          thumbnailUrl: editorThumbnailUrl,
        });
      } else {
        // Create new article as draft
        const api = createApiClient(getToken);
        const raw = await api.post<Record<string, unknown>>('/api/articles', {
          title: editorTitle || (language === 'en' ? 'Untitled Article' : '無題の記事'),
          content: editorContent,
          site: editorSite,  // already a site ID
          category: editorCategory,
          status: 'draft',
          thumbnailUrl: editorThumbnailUrl,
        });
        await articlesActions.loadArticles(getToken);
        const newId = raw.id as string;
        const found = articles.find((a) => a.id === newId);
        if (found) setEditingArticle(found);
      }
    } finally {
      setIsSavingDraft(false);
    }
  }, [editingArticle, editorTitle, editorContent, editorSite, editorCategory, editorThumbnailUrl, getToken, articles]);

  const handlePublish = useCallback(async (blogStatus: 'publish' | 'draft') => {
    setIsPublishing(true);
    try {
      const siteId = editorSite;  // editorSite is already a site ID

      if (editingArticle) {
        // Save content first, then publish
        const api = createApiClient(getToken);
        await api.put(`/api/articles/${editingArticle.id}`, {
          title: editorTitle,
          content: editorContent,
          site: siteId,
          category: editorCategory,
          thumbnailUrl: editorThumbnailUrl,
          status: blogStatus === 'draft' ? 'draft' : 'published',
          publishToBlog: true,
          blogStatus,
        });
        await articlesActions.loadArticles(getToken);
      } else {
        const api = createApiClient(getToken);
        await api.post('/api/articles', {
          title: editorTitle || (language === 'en' ? 'Untitled Article' : '無題の記事'),
          content: editorContent,
          site: siteId,
          category: editorCategory,
          status: blogStatus === 'draft' ? 'draft' : 'published',
          thumbnailUrl: editorThumbnailUrl,
          publishToBlog: true,
          blogStatus,
        });
        await articlesActions.loadArticles(getToken);
      }
      closeEditor();
    } finally {
      setIsPublishing(false);
    }
  }, [editingArticle, editorTitle, editorContent, editorSite, editorCategory, editorThumbnailUrl, getToken, closeEditor]);

  const handleSchedule = useCallback(async () => {
    if (!scheduleDate) return;
    setIsSavingDraft(true);
    try {
      if (editingArticle) {
        await articlesActions.updateArticle(getToken, editingArticle.id, {
          title: editorTitle,
          content: editorContent,
          site: editorSite,  // already a site ID
          category: editorCategory,
          thumbnailUrl: editorThumbnailUrl,
          status: 'scheduled',
          scheduledAt: new Date(scheduleDate).toISOString(),
        });
      } else {
        const api = createApiClient(getToken);
        await api.post('/api/articles', {
          title: editorTitle || (language === 'en' ? 'Untitled Article' : '無題の記事'),
          content: editorContent,
          site: editorSite,  // already a site ID
          category: editorCategory,
          status: 'scheduled',
          scheduledAt: new Date(scheduleDate).toISOString(),
          thumbnailUrl: editorThumbnailUrl,
        });
        await articlesActions.loadArticles(getToken);
      }
      setShowSchedule(false);
      closeEditor();
    } finally {
      setIsSavingDraft(false);
    }
  }, [editingArticle, editorTitle, editorContent, editorSite, editorCategory, editorThumbnailUrl, scheduleDate, getToken, closeEditor]);

  const handleGenerate = useCallback(async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const article = await articlesActions.generateArticle(getToken, {
        prompt,
        useWebSearch,
        imageCount,
        generateThumbnail,
        site: editorSite,
        category: editorCategory,
      });
      if (article) {
        setEditorTitle(article.title);
        setEditorContent(article.content);
        setEditorThumbnailUrl(article.thumbnailUrl);
        setEditingArticle(article);
        setShowGeneratePanel(false);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, useWebSearch, imageCount, generateThumbnail, editorSite, editorCategory, getToken]);

  const handleDelete = useCallback(
    async (id: string) => {
      await articlesActions.deleteArticle(getToken, id);
      setDeleteConfirm(null);
      if (editingArticle?.id === id) closeEditor();
    },
    [getToken, editingArticle, closeEditor],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      await articlesActions.duplicateArticle(getToken, id);
    },
    [getToken],
  );

  const handleSyncStatuses = useCallback(async () => {
    setIsSyncing(true);
    try {
      await articlesActions.syncStatuses(getToken);
    } finally {
      setIsSyncing(false);
    }
  }, [getToken]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField],
  );

  const wordCount = editorContent
    .replace(/[#*_~`>\-|![\]()]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  // ─── Schedules (plan topics) ────────────────────────────────────────────────
  const schedules = useSchedules();

  useEffect(() => {
    if (!schedulesActions.isLoaded()) {
      schedulesActions.loadSchedules(getToken);
    }
  }, [getToken]);

  const plannedCount = schedules.reduce((sum, s) => {
    if (s.status !== 'active') return sum;
    return sum + s.topics.length;
  }, 0);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === 'published').length,
    drafts: articles.filter((a) => a.status === 'draft').length,
    scheduled: articles.filter((a) => a.status === 'scheduled').length + plannedCount,
    generating: articles.filter((a) => a.status === 'generating').length,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Articles' : '記事'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Create, edit, and manage your AI-generated articles.'
              : 'AI生成記事の作成、編集、管理。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncStatuses}
            disabled={isSyncing}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title={language === 'en' ? 'Sync statuses from WordPress' : 'WordPressからステータスを同期'}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {language === 'en' ? 'Sync Status' : 'ステータス同期'}
          </button>
          <button onClick={openNewArticle} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            {language === 'en' ? 'New Article' : '新しい記事'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: language === 'en' ? 'Total' : '合計',
            value: stats.total,
            icon: FileText,
            color: 'text-rakubun-accent',
            bg: 'bg-rakubun-accent/10',
          },
          {
            label: language === 'en' ? 'Published' : '公開済み',
            value: stats.published,
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          },
          {
            label: language === 'en' ? 'Drafts' : '下書き',
            value: stats.drafts,
            icon: Edit3,
            color: 'text-gray-600 dark:text-gray-400',
            bg: 'bg-gray-50 dark:bg-gray-500/10',
          },
          {
            label: language === 'en' ? 'Scheduled' : '予約済み',
            value: stats.scheduled,
            icon: Clock,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-rakubun-text">{stat.value}</p>
                <p className="text-xs text-rakubun-text-secondary">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Sort Bar */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rakubun-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search articles...' : '記事を検索...'}
              className="w-full pl-10 pr-4 py-2 bg-rakubun-bg rounded-lg text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-rakubun-bg rounded-xl p-1">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === filter
                    ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                {filter === 'all'
                  ? language === 'en'
                    ? `All (${stats.total})`
                    : `全て (${stats.total})`
                  : `${statusConfig[filter].label[language]} (${articles.filter((a) => a.status === filter).length})`}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            {(
              [
                { field: 'createdAt' as SortField, label: language === 'en' ? 'Date' : '日付' },
                { field: 'seoScore' as SortField, label: 'SEO' },
                { field: 'wordCount' as SortField, label: language === 'en' ? 'Words' : '語数' },
                { field: 'views' as SortField, label: language === 'en' ? 'Views' : '閲覧' },
              ] as const
            ).map(({ field, label }) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortField === field
                    ? 'bg-rakubun-accent/10 text-rakubun-accent'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                {label}
                {sortField === field ? (
                  sortOrder === 'asc' ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && articles.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
          <span className="ml-2 text-sm text-rakubun-text-secondary">
            {language === 'en' ? 'Loading articles...' : '記事を読み込み中...'}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && articles.length === 0 && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 text-center">
          <div className="p-4 rounded-2xl bg-rakubun-accent/10 w-fit mx-auto mb-4">
            <FileText className="w-8 h-8 text-rakubun-accent" />
          </div>
          <h3 className="text-lg font-heading font-semibold text-rakubun-text mb-2">
            {language === 'en' ? 'No articles yet' : 'まだ記事がありません'}
          </h3>
          <p className="text-sm text-rakubun-text-secondary mb-6 max-w-md mx-auto">
            {language === 'en'
              ? 'Create your first AI-generated article. Just describe what you want to write about and let AI do the rest.'
              : '最初のAI生成記事を作成しましょう。書きたい内容を説明するだけで、AIが記事を作成します。'}
          </p>
          <button onClick={openNewArticle} className="btn-primary text-sm">
            <Sparkles className="w-4 h-4" />
            {language === 'en' ? 'Generate Your First Article' : '最初の記事を生成'}
          </button>
        </div>
      )}

      {/* No results for filter */}
      {!isLoading && articles.length > 0 && filteredArticles.length === 0 && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-8 text-center">
          <Search className="w-6 h-6 text-rakubun-text-secondary mx-auto mb-2" />
          <p className="text-sm text-rakubun-text-secondary">
            {language === 'en' ? 'No articles match your filters.' : 'フィルターに一致する記事がありません。'}
          </p>
        </div>
      )}

      {/* Generating indicator */}
      {isGeneratingGlobal && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20 p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
          <span className="text-sm text-purple-700 dark:text-purple-300">
            {language === 'en'
              ? 'Generating article with GPT-5.2... This may take a moment.'
              : 'GPT-5.2で記事を生成中...少々お待ちください。'}
          </span>
        </div>
      )}

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => {
          const statusCfg = statusConfig[article.status];
          return (
            <div
              key={article.id}
              className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 group cursor-pointer"
              onClick={() => openEditArticle(article)}
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                {article.thumbnailUrl && (
                  <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-rakubun-bg">
                    <img
                      src={article.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.class}`}
                    >
                      {article.status === 'generating' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <statusCfg.icon className="w-3 h-3" />
                      )}
                      <span>{statusCfg.label[language]}</span>
                    </span>
                    {article.site && (
                      <span className="text-xs text-rakubun-text-secondary flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {article.site}
                      </span>
                    )}
                    {article.category && article.category !== 'Uncategorized' && (
                      <span className="text-xs text-rakubun-accent bg-rakubun-accent/10 px-1.5 py-0.5 rounded">
                        {article.category}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-rakubun-text group-hover:text-rakubun-accent transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary mt-1 line-clamp-1">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-rakubun-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.createdAt, language)}
                    </span>
                    {article.wordCount > 0 && (
                      <span>
                        {article.wordCount.toLocaleString()}{' '}
                        {language === 'en' ? 'words' : '語'}
                      </span>
                    )}
                    {article.views > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.views.toLocaleString()}
                      </span>
                    )}
                    {article.seoScore > 0 && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        <span className={`font-medium ${seoColor(article.seoScore)}`}>
                          SEO: {article.seoScore}/100
                        </span>
                        <div className="w-12 h-1.5 bg-rakubun-bg rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${seoBg(article.seoScore)}`}
                            style={{ width: `${article.seoScore}%` }}
                          />
                        </div>
                      </span>
                    )}
                    {article.imageUrls.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        {article.imageUrls.length}
                      </span>
                    )}
                    {article.wpUrl && (
                      <a
                        href={article.wpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-rakubun-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="w-3 h-3" />
                        {language === 'en' ? 'View on Blog' : 'ブログで見る'}
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditArticle(article);
                    }}
                    className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary hover:text-rakubun-accent transition-colors"
                    title={language === 'en' ? 'Edit' : '編集'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(article.id);
                    }}
                    className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
                    title={language === 'en' ? 'Duplicate' : '複製'}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(article.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 transition-colors"
                    title={language === 'en' ? 'Delete' : '削除'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Delete Article' : '記事を削除'}
              </h3>
            </div>
            <p className="text-sm text-rakubun-text-secondary mb-6">
              {language === 'en'
                ? 'Are you sure you want to delete this article? This action cannot be undone.'
                : 'この記事を削除してもよろしいですか？この操作は取り消せません。'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary text-sm"
              >
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {language === 'en' ? 'Delete' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rakubun-accent/10">
                  <FileText className="w-4 h-4 text-rakubun-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {editingArticle
                      ? language === 'en'
                        ? 'Edit Article'
                        : '記事を編集'
                      : language === 'en'
                        ? 'New Article'
                        : '新しい記事'}
                  </h3>
                  {editingArticle && (
                    <p className="text-xs text-rakubun-text-secondary">
                      {language === 'en' ? 'Last updated:' : '最終更新:'}{' '}
                      {formatDate(editingArticle.updatedAt, language)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`btn-secondary text-xs py-1.5 px-3 ${showPreview ? 'bg-rakubun-accent/10 text-rakubun-accent' : ''}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Preview' : 'プレビュー'}
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isPublishing}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {isSavingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {language === 'en' ? 'Save Draft' : '下書き保存'}
                </button>
                <button
                  onClick={() => setShowSchedule(true)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Schedule' : '予約'}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isSavingDraft || isPublishing}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      {isPublishing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      {language === 'en' ? 'Send to Blog' : 'ブログへ送信'}
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handlePublish('publish')}>
                      <Globe className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Publish to Blog' : 'ブログに公開'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePublish('draft')}>
                      <FileText className="w-4 h-4 mr-2" />
                      {language === 'en' ? 'Save to Blog as Draft' : 'ブログに下書き保存'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={closeEditor}
                  className="p-2 rounded-lg hover:bg-rakubun-bg text-rakubun-text-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* AI Generate Panel (collapsible) */}
              <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 overflow-hidden">
                <button
                  onClick={() => setShowGeneratePanel(!showGeneratePanel)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-500/15 dark:hover:to-blue-500/15 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      {language === 'en' ? 'AI Article Generator — GPT-5.2' : 'AI記事ジェネレーター — GPT-5.2'}
                    </span>
                  </div>
                  <span className="text-xs text-purple-500">{showGeneratePanel ? '▲' : '▼'}</span>
                </button>

                {showGeneratePanel && (
                  <div className="p-4 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-500/5 dark:to-blue-500/5 space-y-4">
                    {/* Prompt */}
                    <div>
                      <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1.5">
                        {language === 'en' ? 'Article Topic' : '記事のトピック'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                          placeholder={
                            language === 'en'
                              ? 'e.g. "10 React Performance Tips for 2026"'
                              : '例: 「2026年のReactパフォーマンス最適化10選」'
                          }
                          className="flex-1 px-4 py-2.5 bg-white dark:bg-rakubun-bg rounded-xl text-sm text-rakubun-text placeholder:text-purple-300 dark:placeholder:text-purple-500/50 border border-purple-200 dark:border-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                        />
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating || !prompt}
                          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {language === 'en'
                            ? isGenerating
                              ? 'Generating...'
                              : 'Generate'
                            : isGenerating
                              ? '生成中...'
                              : '生成'}
                        </button>
                      </div>
                    </div>

                    {/* Options Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Web Search Toggle */}
                      <div className="bg-white dark:bg-rakubun-bg rounded-xl border border-purple-100 dark:border-purple-500/15 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-rakubun-text">
                            {language === 'en' ? 'Web Search' : 'ウェブ検索'}
                          </span>
                          <button
                            onClick={() => setUseWebSearch(!useWebSearch)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              useWebSearch
                                ? 'bg-purple-600'
                                : 'bg-gray-200 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                useWebSearch ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[10px] text-rakubun-text-secondary leading-tight">
                          {language === 'en'
                            ? 'Search the web for up-to-date info'
                            : '最新情報をウェブで検索'}
                        </p>
                      </div>

                      {/* Thumbnail Toggle */}
                      <div className="bg-white dark:bg-rakubun-bg rounded-xl border border-purple-100 dark:border-purple-500/15 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-rakubun-text">
                            {language === 'en' ? 'Thumbnail' : 'サムネイル'}
                          </span>
                          <button
                            onClick={() => setGenerateThumbnail(!generateThumbnail)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              generateThumbnail
                                ? 'bg-purple-600'
                                : 'bg-gray-200 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                generateThumbnail ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[10px] text-rakubun-text-secondary leading-tight">
                          {language === 'en'
                            ? 'Generate with Grok AI'
                            : 'Grok AIで生成'}
                        </p>
                      </div>

                      {/* Image Count */}
                      <div className="bg-white dark:bg-rakubun-bg rounded-xl border border-purple-100 dark:border-purple-500/15 p-3">
                        <span className="text-xs font-medium text-rakubun-text block mb-2">
                          {language === 'en' ? 'Article Images' : '記事画像'}
                        </span>
                        <div className="flex items-center gap-1">
                          {[0, 1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              onClick={() => setImageCount(n)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                imageCount === n
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20'
                              }`}
                            >
                              {n === 0 ? (language === 'en' ? 'None' : 'なし') : n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Site & Category Selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                    {language === 'en' ? 'Target Site' : '対象サイト'}
                  </label>
                  <SiteSelector
                    value={editorSite}
                    onChange={setEditorSite}
                    sites={sites}
                    placeholder={language === 'en' ? 'No site selected' : 'サイト未選択'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
                    {language === 'en' ? 'Category' : 'カテゴリ'}
                  </label>
                  <div className="relative">
                    <select
                      value={editorCategory}
                      onChange={(e) => setEditorCategory(e.target.value)}
                      disabled={isLoadingCategories || siteCategories.length === 0}
                      className="w-full px-4 py-2.5 bg-rakubun-bg rounded-xl text-sm text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 appearance-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingCategories ? (
                        <option>{language === 'en' ? 'Loading...' : '読み込み中...'}</option>
                      ) : (
                        siteCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isLoadingCategories ? (
                        <Loader2 className="w-4 h-4 text-rakubun-text-secondary animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 text-rakubun-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnail preview */}
              {editorThumbnailUrl && (
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-rakubun-border">
                  <img
                    src={editorThumbnailUrl}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setEditorThumbnailUrl('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Title */}
              <input
                type="text"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder={language === 'en' ? 'Article Title' : '記事タイトル'}
                className="w-full text-2xl font-heading font-bold text-rakubun-text placeholder:text-rakubun-text-secondary/40 outline-none border-0 bg-transparent"
              />

              {/* Word count & SEO info bar */}
              <div className="flex items-center gap-4 text-xs text-rakubun-text-secondary bg-rakubun-bg rounded-xl px-4 py-2.5">
                <span>
                  {wordCount.toLocaleString()} {language === 'en' ? 'words' : '語'}
                </span>
                <span className="w-px h-3 bg-rakubun-border" />
                <span>
                  {editorContent.length.toLocaleString()} {language === 'en' ? 'characters' : '文字'}
                </span>
                {editorTitle.length > 0 && (
                  <>
                    <span className="w-px h-3 bg-rakubun-border" />
                    <span className={editorTitle.length >= 30 && editorTitle.length <= 60 ? 'text-emerald-600' : 'text-amber-600'}>
                      {language === 'en' ? 'Title:' : 'タイトル:'} {editorTitle.length}{' '}
                      {language === 'en' ? 'chars' : '文字'}
                      {editorTitle.length >= 30 && editorTitle.length <= 60
                        ? ' ✓'
                        : editorTitle.length < 30
                          ? ` (${language === 'en' ? 'too short' : '短すぎ'})`
                          : ` (${language === 'en' ? 'too long' : '長すぎ'})`}
                    </span>
                  </>
                )}
              </div>

              {/* Content Area / Preview */}
              {showPreview ? (
                <div className="prose dark:prose-invert max-w-none min-h-[300px] p-4 bg-rakubun-bg rounded-xl border border-rakubun-border text-sm">
                  {editorContent ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: editorContent
                          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full" />')
                          .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-rakubun-accent">$1</a>')
                          .replace(/^- (.*$)/gm, '<li>$1</li>')
                          .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
                          .replace(/\n\n/g, '</p><p>')
                          .replace(/\n/g, '<br/>'),
                      }}
                    />
                  ) : (
                    <p className="text-rakubun-text-secondary italic">
                      {language === 'en' ? 'Nothing to preview yet.' : 'まだプレビューする内容がありません。'}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder={
                    language === 'en'
                      ? 'Start writing your article or use AI to generate content...'
                      : '記事を書き始めるか、AIでコンテンツを生成...'
                  }
                  className="w-full min-h-[300px] text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/40 outline-none border border-rakubun-border bg-rakubun-bg rounded-xl p-4 resize-none leading-relaxed focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Schedule Article' : '記事を予約'}
              </h3>
            </div>
            <label className="block text-xs font-medium text-rakubun-text-secondary mb-1.5">
              {language === 'en' ? 'Publish Date & Time' : '公開日時'}
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-rakubun-bg rounded-xl text-sm text-rakubun-text border border-rakubun-border focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowSchedule(false)} className="btn-secondary text-sm">
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate || isSavingDraft}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {isSavingDraft ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {language === 'en' ? 'Schedule' : '予約'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
