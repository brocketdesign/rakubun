import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Settings,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Shield,
  User,
  Bell,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hash,
  ChevronRight,
  ChevronDown,
  Terminal,
  Globe,
  FileText,
  Bot,
  Webhook,
  X,
  RefreshCw,
  Activity,
  Mail,
  Send,
  Loader2,
  Power,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../i18n';
import { createApiClient } from '../../lib/api';
import { useApiKeys, useApiKeysLoading, apiKeysActions } from '../../stores/apiKeysStore';
import type { NewApiKeyResult } from '../../stores/apiKeysStore';

// ── Notification Settings types ─────────────────────────────────────
interface NotificationPreference {
  email: boolean;
  inApp: boolean;
}

interface NotificationPreferences {
  articlePublished: NotificationPreference;
  aiGenerationComplete: NotificationPreference;
  siteConnectionIssues: NotificationPreference;
  scheduledReminders: NotificationPreference;
  weeklyAnalytics: NotificationPreference;
  systemUpdates: NotificationPreference;
}

interface NotificationSettings {
  emailEnabled: boolean;
  preferences: NotificationPreferences;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  preferences: {
    articlePublished: { email: true, inApp: true },
    aiGenerationComplete: { email: false, inApp: true },
    siteConnectionIssues: { email: true, inApp: true },
    scheduledReminders: { email: true, inApp: true },
    weeklyAnalytics: { email: true, inApp: false },
    systemUpdates: { email: false, inApp: true },
  },
};

const notificationKeys: { key: keyof NotificationPreferences; label: { en: string; ja: string }; description: { en: string; ja: string } }[] = [
  { key: 'articlePublished', label: { en: 'Article published', ja: '記事公開時' }, description: { en: 'When an article is published to your WordPress site', ja: 'WordPressサイトに記事が公開された時' } },
  { key: 'aiGenerationComplete', label: { en: 'AI generation complete', ja: 'AI生成完了時' }, description: { en: 'When AI finishes generating an article', ja: 'AIが記事の生成を完了した時' } },
  { key: 'siteConnectionIssues', label: { en: 'Site connection issues', ja: 'サイト接続問題時' }, description: { en: 'When a connected site has connectivity problems', ja: '接続サイトに接続問題が発生した時' } },
  { key: 'scheduledReminders', label: { en: 'Scheduled article reminders', ja: '予約記事リマインダー' }, description: { en: 'Reminders before scheduled articles are published', ja: '予約記事の公開前のリマインダー' } },
  { key: 'weeklyAnalytics', label: { en: 'Weekly analytics report', ja: '週間アナリティクスレポート' }, description: { en: 'Weekly summary of your site performance', ja: 'サイトパフォーマンスの週間サマリー' } },
  { key: 'systemUpdates', label: { en: 'System updates', ja: 'システムアップデート' }, description: { en: 'New features and important platform updates', ja: '新機能と重要なプラットフォームアップデート' } },
];

// ── API Docs endpoints — real endpoints from the codebase ───────────
const apiEndpoints = [
  // ── Agent Endpoints ──
  { method: 'POST' as const, path: '/api/agent/publish', label: { en: 'Publish Article (Agent)', ja: '記事公開（エージェント）' }, description: { en: 'Create an article in the dashboard and optionally publish it to WordPress. Supports scheduling, image uploads (URL or base64), thumbnails, categories, and tags.', ja: 'ダッシュボードに記事を作成し、オプションでWordPressに公開。スケジュール、画像アップロード（URLまたはbase64）、サムネイル、カテゴリ、タグをサポート。' }, auth: 'X-API-Key', category: 'agent',
    requestBody: {
      title: '"My Article Title"',
      content: '"# Article\\n\\nMarkdown or HTML content..."',
      siteId: '"<site-mongodb-id>"',
      status: '"draft" | "publish" | "schedule"',
      scheduledAt: '"2026-03-01T09:00:00Z" (required if status=schedule)',
      publishToBlog: 'true (default)',
      thumbnailUrl: '"https://..." (optional)',
      thumbnailBase64: '"data:image/png;base64,..." (optional)',
      images: '[{ url?: "...", base64?: "...", altText?: "...", filename?: "..." }]',
      category: '"Technology" (optional)',
      categoryId: '1 (WP category ID, optional)',
      tags: '["tag1", "tag2"] (optional)',
      insertImagesInContent: 'true (default)',
      excerpt: '"..." (auto-generated if omitted)',
    },
    responseExample: `{
  "success": true,
  "article": {
    "id": "...",
    "title": "My Article Title",
    "status": "published",
    "wpPostId": 123,
    "wpUrl": "https://example.com/my-article"
  },
  "wordpress": { "postId": 123, "url": "...", "status": "publish" },
  "uploadedImages": [{ "wpMediaId": 45, "url": "..." }]
}` },
  { method: 'POST' as const, path: '/api/agent/upload-image', label: { en: 'Upload Image (Agent)', ja: '画像アップロード（エージェント）' }, description: { en: 'Upload an image to a WordPress site\'s media library. Supports both URL-based and base64-encoded images.', ja: 'WordPressサイトのメディアライブラリに画像をアップロード。URL指定とbase64エンコードの両方をサポート。' }, auth: 'X-API-Key', category: 'agent',
    requestBody: {
      siteId: '"<site-mongodb-id>"',
      imageUrl: '"https://..." (or use base64)',
      base64: '"data:image/png;base64,..." (or use imageUrl)',
      filename: '"my-image.jpg" (optional)',
      altText: '"Description" (optional)',
    },
    responseExample: `{
  "success": true,
  "media": { "wpMediaId": 45, "url": "https://example.com/wp-content/uploads/image.jpg" }
}` },
  { method: 'GET' as const, path: '/api/agent/sites', label: { en: 'List Sites (Agent)', ja: 'サイト一覧（エージェント）' }, description: { en: 'List all WordPress sites. Add ?id=<siteId> to get a single site with its WordPress categories.', ja: 'WordPressサイト一覧。?id=<siteId>で単一サイトとWordPressカテゴリを取得。' }, auth: 'X-API-Key', category: 'agent',
    responseExample: `{
  "sites": [{ "id": "...", "name": "My Blog", "url": "example.com", "status": "connected", "articlesGenerated": 42 }],
  "total": 1
}` },
  { method: 'GET' as const, path: '/api/agent/articles', label: { en: 'List Articles (Agent)', ja: '記事一覧（エージェント）' }, description: { en: 'List articles with optional filters: ?status=draft&siteId=...&limit=20. Add ?id=<articleId> for a single article.', ja: '記事一覧（フィルター: ?status=draft&siteId=...&limit=20）。?id=<articleId>で単一記事を取得。' }, auth: 'X-API-Key', category: 'agent',
    responseExample: `{
  "articles": [{ "id": "...", "title": "...", "status": "published", "wpPostId": 123, "wpUrl": "..." }],
  "total": 5
}` },

  // ── Articles ──
  { method: 'GET' as const, path: '/api/articles', label: { en: 'List Articles', ja: '記事一覧' }, description: { en: 'Retrieve all articles with optional filtering by status, sort field, order (asc/desc), and search text.', ja: 'ステータス、ソートフィールド、並び順（asc/desc）、検索テキストでフィルタリング可能な記事一覧。' }, auth: 'Bearer', category: 'articles',
    responseExample: `{
  "articles": [{ "id": "...", "title": "...", "status": "draft", "wordCount": 1200, "seoScore": 85 }],
  "total": 47
}` },
  { method: 'POST' as const, path: '/api/articles', label: { en: 'Create Article', ja: '記事作成' }, description: { en: 'Create a new article. Set publishToBlog=true with a siteId to publish to WordPress. Supports blogStatus ("publish" or "draft") and scheduledAt for scheduling.', ja: '新しい記事を作成。publishToBlog=trueとsiteIdでWordPressに公開。blogStatus（"publish"/"draft"）とscheduledAtでスケジュール対応。' }, auth: 'Bearer', category: 'articles',
    requestBody: {
      title: '"Article Title"',
      content: '"Markdown or HTML content"',
      site: '"<site-id>" (optional)',
      category: '"Uncategorized"',
      status: '"draft" | "published" | "scheduled"',
      publishToBlog: 'true/false',
      blogStatus: '"publish" | "draft"',
      scheduledAt: '"2026-03-01T09:00:00Z"',
      thumbnailUrl: '"https://..."',
    } },
  { method: 'GET' as const, path: '/api/articles/:id', label: { en: 'Get Article', ja: '記事取得' }, description: { en: 'Retrieve a specific article by ID, including content, metadata, SEO score, WordPress post ID and URL.', ja: 'ID指定で記事取得（コンテンツ、メタデータ、SEOスコア、WP投稿ID・URL含む）。' }, auth: 'Bearer', category: 'articles' },
  { method: 'PUT' as const, path: '/api/articles/:id', label: { en: 'Update Article', ja: '記事更新' }, description: { en: 'Update article fields. Set publishToBlog=true to sync changes to WordPress. Supports re-scheduling.', ja: '記事フィールドを更新。publishToBlog=trueでWordPressに同期。再スケジュール対応。' }, auth: 'Bearer', category: 'articles' },
  { method: 'DELETE' as const, path: '/api/articles/:id', label: { en: 'Delete Article', ja: '記事削除' }, description: { en: 'Delete an article by ID.', ja: 'ID指定で記事を削除。' }, auth: 'Bearer', category: 'articles' },
  { method: 'POST' as const, path: '/api/articles/generate', label: { en: 'Generate Article (AI)', ja: '記事生成（AI）' }, description: { en: 'Generate an article using AI from a topic prompt. Supports web search, image generation (up to 4), and thumbnail generation. Images are automatically uploaded to WordPress.', ja: 'トピックプロンプトからAIで記事を生成。Web検索、画像生成（最大4枚）、サムネイル生成対応。画像は自動的にWordPressにアップロード。' }, auth: 'Bearer', category: 'articles',
    requestBody: {
      prompt: '"Write about AI in healthcare"',
      useWebSearch: 'true/false',
      imageCount: '0-4',
      generateThumbnail: 'true/false',
      site: '"<site-id>"',
      category: '"Technology"',
    } },
  { method: 'POST' as const, path: '/api/articles/auto-schedule', label: { en: 'Auto-Schedule Topics', ja: 'トピック自動スケジュール' }, description: { en: 'AI analyzes a website and suggests N article topics with optimal publishing days and times.', ja: 'AIがウェブサイトを分析し、最適な公開日時でN件の記事トピックを提案。' }, auth: 'Bearer', category: 'articles' },
  { method: 'POST' as const, path: '/api/articles/sync-status', label: { en: 'Sync WP Statuses', ja: 'WPステータス同期' }, description: { en: 'Sync the status of all published articles with WordPress. Returns updated, unchanged, and error counts.', ja: '公開済み記事のステータスをWordPressと同期。更新件数、未変更件数、エラー件数を返却。' }, auth: 'Bearer', category: 'articles' },

  // ── Sites ──
  { method: 'GET' as const, path: '/api/sites', label: { en: 'List Sites', ja: 'サイト一覧' }, description: { en: 'List all connected WordPress sites with status, article count, and settings.', ja: '接続済みWordPressサイト一覧（ステータス、記事数、設定含む）。' }, auth: 'Bearer', category: 'sites',
    responseExample: `{
  "sites": [{
    "id": "...", "name": "My Blog", "url": "example.com",
    "status": "connected", "articlesGenerated": 42,
    "settings": { "autoSync": true, "defaultStatus": "draft" }
  }]
}` },
  { method: 'POST' as const, path: '/api/sites', label: { en: 'Add Website', ja: 'ウェブサイト追加' }, description: { en: 'Connect a new WordPress site. Requires the site URL, WordPress username, and an Application Password.', ja: '新しいWordPressサイトを接続。サイトURL、WordPressユーザー名、アプリケーションパスワードが必要。' }, auth: 'Bearer', category: 'sites',
    requestBody: {
      name: '"My WordPress Blog"',
      url: '"https://example.com"',
      username: '"admin"',
      applicationPassword: '"xxxx xxxx xxxx xxxx"',
    } },
  { method: 'GET' as const, path: '/api/sites/:id', label: { en: 'Get Site', ja: 'サイト取得' }, description: { en: 'Get a single site\'s details (credentials are hidden — only hasApplicationPassword is shown).', ja: '単一サイトの詳細を取得（認証情報は非表示 — hasApplicationPasswordのみ表示）。' }, auth: 'Bearer', category: 'sites' },
  { method: 'PUT' as const, path: '/api/sites/:id', label: { en: 'Update Site Credentials', ja: 'サイト認証情報更新' }, description: { en: 'Update WordPress username and/or application password.', ja: 'WordPressのユーザー名・アプリケーションパスワードを更新。' }, auth: 'Bearer', category: 'sites',
    requestBody: {
      username: '"new_admin"',
      applicationPassword: '"new xxxx xxxx xxxx"',
    } },
  { method: 'DELETE' as const, path: '/api/sites/:id', label: { en: 'Delete Site', ja: 'サイト削除' }, description: { en: 'Remove a connected WordPress site.', ja: '接続済みWordPressサイトを削除。' }, auth: 'Bearer', category: 'sites' },
  { method: 'PUT' as const, path: '/api/sites/:id/settings', label: { en: 'Update Site Settings', ja: 'サイト設定更新' }, description: { en: 'Update site settings: autoSync, syncInterval, defaultCategory, defaultStatus, autoImages, seoOptimization, language, timezone.', ja: 'サイト設定を更新: autoSync、syncInterval、defaultCategory、defaultStatus、autoImages、seoOptimization、language、timezone。' }, auth: 'Bearer', category: 'sites' },
  { method: 'GET' as const, path: '/api/sites/:id/categories', label: { en: 'Get WP Categories', ja: 'WPカテゴリ取得' }, description: { en: 'Fetch all WordPress categories from the site. Paginates automatically.', ja: 'サイトからすべてのWordPressカテゴリを取得。自動ページネーション。' }, auth: 'Bearer', category: 'sites',
    responseExample: `{
  "categories": [{ "id": 1, "name": "Uncategorized", "slug": "uncategorized", "count": 12, "parent": 0 }]
}` },
  { method: 'POST' as const, path: '/api/sites/:id/sync', label: { en: 'Sync Site', ja: 'サイト同期' }, description: { en: 'Update the site\'s last sync timestamp and set status to connected.', ja: 'サイトの最終同期タイムスタンプを更新し、ステータスをconnectedに設定。' }, auth: 'Bearer', category: 'sites' },

  // ── Schedules ──
  { method: 'GET' as const, path: '/api/schedules', label: { en: 'List Schedules', ja: 'スケジュール一覧' }, description: { en: 'List all publishing schedules. Optionally filter by ?status=active.', ja: '公開スケジュール一覧。?status=activeでフィルタ可能。' }, auth: 'Bearer', category: 'schedules',
    responseExample: `{
  "schedules": [{
    "id": "...", "siteId": "...", "status": "active",
    "topics": [{ "title": "...", "description": "...", "date": "2026-03-01", "time": "09:00" }]
  }]
}` },
  { method: 'POST' as const, path: '/api/schedules', label: { en: 'Create Schedule', ja: 'スケジュール作成' }, description: { en: 'Create a new publishing schedule with a siteId and an array of topics (each with title, description, date, time).', ja: 'siteIdとトピック配列（各トピック: title、description、date、time）で新しい公開スケジュールを作成。' }, auth: 'Bearer', category: 'schedules',
    requestBody: {
      siteId: '"<site-id>"',
      topics: '[{ "title": "...", "description": "...", "date": "2026-03-01", "time": "09:00" }]',
    } },
  { method: 'PUT' as const, path: '/api/schedules/:id', label: { en: 'Update Schedule', ja: 'スケジュール更新' }, description: { en: 'Update a schedule\'s status or topics.', ja: 'スケジュールのステータスまたはトピックを更新。' }, auth: 'Bearer', category: 'schedules' },
  { method: 'DELETE' as const, path: '/api/schedules/:id', label: { en: 'Delete Schedule', ja: 'スケジュール削除' }, description: { en: 'Delete a publishing schedule.', ja: '公開スケジュールを削除。' }, auth: 'Bearer', category: 'schedules' },

  // ── Cron Jobs ──
  { method: 'GET' as const, path: '/api/cron-jobs', label: { en: 'List Cron Jobs', ja: 'Cronジョブ一覧' }, description: { en: 'List all automated cron jobs with their schedules, language, word count, and image settings.', ja: '自動Cronジョブ一覧（スケジュール、言語、文字数、画像設定含む）。' }, auth: 'Bearer', category: 'cron-jobs',
    responseExample: `{
  "cronJobs": [{
    "id": "...", "siteId": "...", "siteName": "My Blog",
    "schedule": [{ "day": "Monday", "articleType": "Tech News" }],
    "articlesPerWeek": 7, "imagesPerArticle": 4, "status": "active"
  }]
}` },
  { method: 'POST' as const, path: '/api/cron-jobs', label: { en: 'Create Cron Job', ja: 'Cronジョブ作成' }, description: { en: 'Create an automated content cron job with schedule, language, word count range, images per article, style, and email notification settings.', ja: '自動コンテンツCronジョブを作成（スケジュール、言語、文字数範囲、画像数、スタイル、メール通知設定）。' }, auth: 'Bearer', category: 'cron-jobs',
    requestBody: {
      siteId: '"<site-id>"',
      siteName: '"My Blog"',
      siteUrl: '"example.com"',
      schedule: '[{ "day": "Monday", "articleType": "Tech News" }]',
      language: '"ja"',
      wordCountMin: '1000',
      wordCountMax: '1500',
      imagesPerArticle: '4',
      articlesPerWeek: '7',
      style: '"Professional and informative"',
      emailNotification: '"user@example.com"',
    } },
  { method: 'PUT' as const, path: '/api/cron-jobs/:id', label: { en: 'Update Cron Job', ja: 'Cronジョブ更新' }, description: { en: 'Update cron job fields: schedule, language, word count, images, articles per week, style, email notification, or status.', ja: 'Cronジョブを更新: スケジュール、言語、文字数、画像数、週間記事数、スタイル、メール通知、ステータス。' }, auth: 'Bearer', category: 'cron-jobs' },
  { method: 'DELETE' as const, path: '/api/cron-jobs/:id', label: { en: 'Delete Cron Job', ja: 'Cronジョブ削除' }, description: { en: 'Delete an automated cron job.', ja: '自動Cronジョブを削除。' }, auth: 'Bearer', category: 'cron-jobs' },
  { method: 'POST' as const, path: '/api/cron-jobs/generate-schedule', label: { en: 'AI Generate Schedule', ja: 'AIスケジュール生成' }, description: { en: 'Use AI to analyze a website and generate an optimal weekly publishing schedule with article types. Uses web search to understand the site.', ja: 'AIでウェブサイトを分析し、最適な週間公開スケジュールを記事タイプ付きで生成。Web検索でサイトを理解。' }, auth: 'Bearer', category: 'cron-jobs',
    requestBody: {
      siteId: '"<site-id>"',
      articlesPerWeek: '7 (1-7)',
    } },

  // ── API Key Management ──
  { method: 'GET' as const, path: '/api/agent/api-keys', label: { en: 'List API Keys', ja: 'APIキー一覧' }, description: { en: 'List all active API keys for the authenticated user. Returns key prefix, name, and last used timestamp.', ja: '認証ユーザーのアクティブAPIキー一覧。キープレフィックス、名前、最終使用日時を返却。' }, auth: 'Bearer', category: 'api-keys' },
  { method: 'POST' as const, path: '/api/agent/api-keys', label: { en: 'Create API Key', ja: 'APIキー作成' }, description: { en: 'Create a new API key for agent access. The full key is returned ONLY at creation time. Store it securely.', ja: 'エージェントアクセス用の新しいAPIキーを作成。完全なキーは作成時のみ返却。安全に保管してください。' }, auth: 'Bearer', category: 'api-keys',
    requestBody: {
      name: '"My AI Agent"',
    },
    responseExample: `{
  "id": "...",
  "name": "My AI Agent",
  "key": "rkb_a1b2c3d4...",
  "createdAt": "2026-02-23T...",
  "message": "Store this API key securely. It will not be shown again."
}` },
  { method: 'DELETE' as const, path: '/api/agent/api-keys?id=:id', label: { en: 'Revoke API Key', ja: 'APIキー無効化' }, description: { en: 'Revoke an API key by ID. The key will immediately stop working.', ja: 'ID指定でAPIキーを無効化。キーは即座に使用不可になります。' }, auth: 'Bearer', category: 'api-keys' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
};

const categoryIcons: Record<string, typeof FileText> = {
  agent: Bot,
  articles: FileText,
  sites: Globe,
  schedules: Calendar,
  'cron-jobs': Clock,
  'api-keys': Key,
};

const categoryLabels: Record<string, { en: string; ja: string }> = {
  all: { en: 'All', ja: '全て' },
  agent: { en: 'Agent', ja: 'エージェント' },
  articles: { en: 'Articles', ja: '記事' },
  sites: { en: 'Sites', ja: 'サイト' },
  schedules: { en: 'Schedules', ja: 'スケジュール' },
  'cron-jobs': { en: 'Cron Jobs', ja: 'Cronジョブ' },
  'api-keys': { en: 'API Keys', ja: 'APIキー' },
};

// ── Settings Tabs ───────────────────────────────────────────────────
const settingsTabs = [
  { id: 'api-keys', label: { en: 'API Keys', ja: 'APIキー' }, icon: Key },
  { id: 'api-docs', label: { en: 'API Docs', ja: 'APIドキュメント' }, icon: BookOpen },
  { id: 'profile', label: { en: 'Profile', ja: 'プロフィール' }, icon: User },
  { id: 'notifications', label: { en: 'Notifications', ja: '通知設定' }, icon: Bell },
  { id: 'general', label: { en: 'General', ja: '一般' }, icon: Settings },
];

// ── Component ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('api-keys');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<NewApiKeyResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [docsCategory, setDocsCategory] = useState<string>('all');
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);

  // Real API keys from store
  const liveApiKeys = useApiKeys();
  const apiKeysLoading = useApiKeysLoading();

  // Load API keys on mount / tab switch
  useEffect(() => {
    if (activeTab === 'api-keys') {
      apiKeysActions.loadApiKeys(getToken);
    }
  }, [activeTab, getToken]);

  // ── Notification settings state ─────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifDirty, setNotifDirty] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const fetchNotificationSettings = useCallback(async () => {
    setNotifLoading(true);
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ settings: NotificationSettings }>('/api/notifications/settings');
      setNotifSettings(data.settings);
    } catch {
      // Use defaults on error
    } finally {
      setNotifLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationSettings();
    }
  }, [activeTab, fetchNotificationSettings]);

  const saveNotificationSettings = async () => {
    setNotifSaving(true);
    try {
      const api = createApiClient(getToken);
      const data = await api.put<{ settings: NotificationSettings }>('/api/notifications/settings', notifSettings);
      setNotifSettings(data.settings);
      setNotifDirty(false);
      toast.success(language === 'en' ? 'Notification preferences saved' : '通知設定を保存しました');
    } catch {
      toast.error(language === 'en' ? 'Failed to save preferences' : '設定の保存に失敗しました');
    } finally {
      setNotifSaving(false);
    }
  };

  const toggleEmailEnabled = () => {
    setNotifSettings(prev => ({ ...prev, emailEnabled: !prev.emailEnabled }));
    setNotifDirty(true);
  };

  const toggleNotifPref = (key: keyof NotificationPreferences, channel: 'email' | 'inApp') => {
    setNotifSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: { ...prev.preferences[key], [channel]: !prev.preferences[key][channel] },
      },
    }));
    setNotifDirty(true);
  };

  const sendTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error(language === 'en' ? 'Please enter an email address' : 'メールアドレスを入力してください');
      return;
    }
    setTestEmailSending(true);
    try {
      const api = createApiClient(getToken);
      await api.post('/api/notifications/test-email', { email: testEmailAddress });
      toast.success(language === 'en' ? 'Test email sent successfully!' : 'テストメールを送信しました！');
    } catch {
      toast.error(language === 'en' ? 'Failed to send test email' : 'テストメールの送信に失敗しました');
    } finally {
      setTestEmailSending(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(id);
      toast.success(language === 'en' ? 'Copied to clipboard' : 'クリップボードにコピーしました');
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error(language === 'en' ? 'Please enter a name for the key' : 'キー名を入力してください');
      return;
    }
    setCreatingKey(true);
    try {
      const result = await apiKeysActions.createApiKey(getToken, newKeyName.trim());
      setNewKeyResult(result);
      toast.success(language === 'en' ? 'API key created!' : 'APIキーが作成されました！');
    } catch {
      toast.error(language === 'en' ? 'Failed to create API key' : 'APIキーの作成に失敗しました');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    setRevokingKey(keyId);
    try {
      await apiKeysActions.revokeApiKey(getToken, keyId);
      toast.success(language === 'en' ? 'API key revoked' : 'APIキーを無効化しました');
    } catch {
      toast.error(language === 'en' ? 'Failed to revoke key' : 'キーの無効化に失敗しました');
    } finally {
      setRevokingKey(null);
    }
  };

  const filteredEndpoints = docsCategory === 'all'
    ? apiEndpoints
    : apiEndpoints.filter(e => e.category === docsCategory);

  const docCategories = ['all', ...Array.from(new Set(apiEndpoints.map(e => e.category)))];

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <h2 className="text-xl font-heading font-bold text-rakubun-text">
          {language === 'en' ? 'Settings' : '設定'}
        </h2>
        <p className="text-sm text-rakubun-text-secondary mt-1">
          {language === 'en'
            ? 'Manage your account, dashboard API keys, and preferences.'
            : 'アカウント、ダッシュボードAPIキー、設定の管理。'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Settings Tabs */}
        <div className="w-[200px] shrink-0 space-y-1">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-rakubun-accent/8 text-rakubun-accent'
                  : 'text-rakubun-text-secondary hover:bg-rakubun-bg-secondary hover:text-rakubun-text'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label[language]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── API Keys Tab ─────────────────────────────────────── */}
          {activeTab === 'api-keys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {language === 'en' ? 'API Keys' : 'APIキー'}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {language === 'en'
                      ? 'Create keys to let AI agents, automations, or external tools access your RakuBun dashboard via the API.'
                      : 'AIエージェント、自動化、外部ツールがAPI経由でRakuBunダッシュボードにアクセスするためのキーを作成。'}
                  </p>
                </div>
                <button onClick={() => { setShowCreateModal(true); setNewKeyResult(null); setNewKeyName(''); }} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" />
                  {language === 'en' ? 'Create Key' : 'キー作成'}
                </button>
              </div>

              {/* Info banner */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20 p-4 flex items-start gap-3">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    {language === 'en' ? 'Connect AI Agents & External Tools' : 'AIエージェント＆外部ツールを接続'}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    {language === 'en'
                      ? 'Use API keys with the X-API-Key header to authenticate agent requests. Keys grant full access to publish articles, upload images, and manage your WordPress sites.'
                      : 'X-API-Keyヘッダーを使用してエージェントリクエストを認証。キーは記事の公開、画像のアップロード、WordPressサイトの管理へのフルアクセスを付与。'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('api-docs')}
                  className="btn-secondary text-xs py-1.5 shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {language === 'en' ? 'View Docs' : 'ドキュメント'}
                </button>
              </div>

              {/* Usage summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-4">
                  <p className="text-2xl font-heading font-bold text-rakubun-text">
                    {apiKeysLoading ? '—' : liveApiKeys.length}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-0.5">
                    {language === 'en' ? 'Active Keys' : 'アクティブキー'}
                  </p>
                </div>
                <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-4">
                  <p className="text-2xl font-heading font-bold text-emerald-600">
                    {apiEndpoints.filter(ep => ep.auth === 'X-API-Key').length}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-0.5">
                    {language === 'en' ? 'Agent Endpoints' : 'エージェントエンドポイント'}
                  </p>
                </div>
              </div>

              {/* Keys List */}
              {apiKeysLoading ? (
                <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
                </div>
              ) : liveApiKeys.length === 0 ? (
                <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rakubun-bg-secondary flex items-center justify-center mx-auto mb-3">
                    <Key className="w-6 h-6 text-rakubun-text-secondary" />
                  </div>
                  <p className="text-sm font-medium text-rakubun-text">
                    {language === 'en' ? 'No API keys yet' : 'APIキーがありません'}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-1">
                    {language === 'en'
                      ? 'Create your first API key to start using the agent API.'
                      : '最初のAPIキーを作成してエージェントAPIの使用を開始しましょう。'}
                  </p>
                  <button
                    onClick={() => { setShowCreateModal(true); setNewKeyResult(null); setNewKeyName(''); }}
                    className="btn-primary text-sm mt-4"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'en' ? 'Create Your First Key' : '最初のキーを作成'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveApiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-xl shrink-0 bg-emerald-50 dark:bg-emerald-500/10">
                          <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-rakubun-text">{key.name}</h4>
                            <span className="status-badge status-badge-success">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{language === 'en' ? 'Active' : '有効'}</span>
                            </span>
                          </div>

                          {/* Key prefix */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <code className="text-xs text-rakubun-text-secondary font-mono bg-rakubun-bg px-2 py-0.5 rounded">
                              {key.keyPrefix}
                            </code>
                          </div>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-rakubun-text-secondary flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {language === 'en' ? 'Created' : '作成'}: {new Date(key.createdAt).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            {key.lastUsedAt && (
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {language === 'en' ? 'Last used' : '最終使用'}: {new Date(key.lastUsedAt).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={revokingKey === key.id}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 transition-colors disabled:opacity-50"
                            title={language === 'en' ? 'Revoke' : '無効化'}
                          >
                            {revokingKey === key.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Refresh link */}
                  <div className="text-center pt-1">
                    <button
                      onClick={() => apiKeysActions.refreshApiKeys(getToken)}
                      className="text-xs text-rakubun-text-secondary hover:text-rakubun-accent transition-colors inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {language === 'en' ? 'Refresh' : '更新'}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Start Snippet */}
              <div className="bg-[#1e1e2e] rounded-2xl p-5 text-sm font-mono overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-sans font-medium flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Quick Start — Publish via Agent API' : 'クイックスタート — エージェントAPIで公開'}
                  </span>
                  <button
                    onClick={() => handleCopy(
                      `curl -X POST ${window.location.origin}/api/agent/publish \\\n  -H "X-API-Key: rkb_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"My Article","content":"# Hello\\nArticle content...","siteId":"YOUR_SITE_ID","status":"draft"}'`,
                      'snippet',
                    )}
                    className="text-xs text-gray-400 hover:text-white font-sans flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'snippet' ? (language === 'en' ? 'Copied!' : 'コピー済!') : (language === 'en' ? 'Copy' : 'コピー')}
                  </button>
                </div>
                <div className="text-gray-300 space-y-1 text-xs leading-relaxed">
                  <div><span className="text-emerald-400">curl</span> <span className="text-blue-400">-X POST</span> \</div>
                  <div>  <span className="text-amber-300">{window.location.origin}/api/agent/publish</span> \</div>
                  <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"X-API-Key: rkb_YOUR_KEY"</span> \</div>
                  <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"Content-Type: application/json"</span> \</div>
                  <div>  <span className="text-blue-400">-d</span> <span className="text-green-300">'{`{"title":"My Article","content":"...","siteId":"...","status":"draft"}`}'</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── API Docs Tab ─────────────────────────────────────── */}
          {activeTab === 'api-docs' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading font-semibold text-rakubun-text">
                  {language === 'en' ? 'API Documentation' : 'APIドキュメント'}
                </h3>
                <p className="text-sm text-rakubun-text-secondary mt-0.5">
                  {language === 'en'
                    ? 'Complete reference for all RakuBun API endpoints. Agent endpoints use X-API-Key auth; dashboard endpoints use Clerk Bearer tokens.'
                    : 'すべてのRakuBun APIエンドポイントの完全リファレンス。エージェントはX-API-Key認証、ダッシュボードはClerk Bearerトークンを使用。'}
                </p>
              </div>

              {/* Base URL */}
              <div className="bg-[#1e1e2e] rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-sans font-medium shrink-0">{language === 'en' ? 'Base URL' : 'ベースURL'}</span>
                <code className="text-sm text-emerald-400 font-mono">{window.location.origin}</code>
                <button onClick={() => handleCopy(window.location.origin, 'baseurl')} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  {copiedKey === 'baseurl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Authentication */}
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-rakubun-accent" />
                  <h4 className="font-heading font-semibold text-rakubun-text text-sm">
                    {language === 'en' ? 'Authentication' : '認証'}
                  </h4>
                </div>
                <div>
                  <p className="text-sm font-medium text-rakubun-text mb-1.5">
                    {language === 'en' ? '1. Agent API (for AI agents & automations)' : '1. エージェントAPI（AIエージェント＆自動化用）'}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mb-2">
                    {language === 'en'
                      ? 'Use your API key in the X-API-Key header:'
                      : 'X-API-Keyヘッダーにあなたのログインキーを使用:'}
                  </p>
                  <div className="bg-rakubun-bg rounded-xl p-3 font-mono text-xs text-rakubun-text">
                    X-API-Key: <span className="text-rakubun-accent">rkb_your_api_key_here</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-rakubun-text mb-1.5">
                    {language === 'en' ? '2. Dashboard API (for frontend / user sessions)' : '2. ダッシュボードAPI（フロントエンド/ユーザーセッション用）'}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mb-2">
                    {language === 'en'
                      ? 'Use a Clerk JWT Bearer token in the Authorization header:'
                      : 'AuthorizationヘッダーにClerk JWT Bearerトークンを使用:'}
                  </p>
                  <div className="bg-rakubun-bg rounded-xl p-3 font-mono text-xs text-rakubun-text">
                    Authorization: Bearer <span className="text-rakubun-accent">clerk_jwt_token</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {language === 'en'
                      ? 'Never expose your API key in client-side code. Always make API calls from your server or AI agent backend.'
                      : 'APIキーをクライアントサイドコードに公開しないでください。常にサーバーまたはAIエージェントバックエンドからAPI呼び出しを行ってください。'}
                  </span>
                </div>
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1 w-fit flex-wrap">
                {docCategories.map((cat) => {
                  const CatIcon = cat === 'all' ? BookOpen : (categoryIcons[cat] || FileText);
                  return (
                    <button
                      key={cat}
                      onClick={() => setDocsCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        docsCategory === cat
                          ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                          : 'text-rakubun-text-secondary hover:text-rakubun-text'
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      <span>{categoryLabels[cat]?.[language] || cat}</span>
                    </button>
                  );
                })}
              </div>

              {/* Endpoints count */}
              <p className="text-xs text-rakubun-text-secondary">
                {language === 'en'
                  ? `Showing ${filteredEndpoints.length} endpoints`
                  : `${filteredEndpoints.length}件のエンドポイントを表示`}
              </p>

              {/* Endpoints List */}
              <div className="space-y-2">
                {filteredEndpoints.map((ep, i) => {
                  const epKey = `${ep.method}-${ep.path}`;
                  const isExpanded = expandedEndpoint === epKey;
                  const epWithBody = ep as typeof ep & { requestBody?: Record<string, string>; responseExample?: string };
                  return (
                    <div
                      key={i}
                      className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden hover:shadow-sm transition-all"
                    >
                      <button
                        onClick={() => setExpandedEndpoint(isExpanded ? null : epKey)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
                      >
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                        <code className="text-sm font-mono text-rakubun-text flex-1 truncate">{ep.path}</code>
                        <span className="text-[10px] font-medium text-rakubun-text-secondary bg-rakubun-bg px-1.5 py-0.5 rounded hidden sm:inline">
                          {ep.auth === 'X-API-Key' ? 'API Key' : 'Bearer'}
                        </span>
                        <span className="text-xs text-rakubun-text-secondary hidden md:inline">{ep.label[language]}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-rakubun-border pt-3 space-y-3">
                          <p className="text-sm text-rakubun-text-secondary">{ep.description[language]}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-rakubun-text-secondary">
                              {language === 'en' ? 'Auth:' : '認証:'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rakubun-accent/10 text-rakubun-accent font-mono">
                              <Shield className="w-2.5 h-2.5" />
                              {ep.auth}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rakubun-bg text-rakubun-text-secondary">
                              <Hash className="w-2.5 h-2.5" />
                              {ep.category}
                            </span>
                          </div>

                          {/* Request body */}
                          {epWithBody.requestBody && (
                            <div>
                              <span className="text-xs font-medium text-rakubun-text block mb-1.5">
                                {language === 'en' ? 'Request Body (JSON)' : 'リクエストボディ（JSON）'}
                              </span>
                              <div className="bg-[#1e1e2e] rounded-xl p-3 text-xs font-mono text-gray-300 space-y-0.5">
                                <div>{'{'}</div>
                                {Object.entries(epWithBody.requestBody).map(([field, desc], fi) => (
                                  <div key={fi}>{'  '}<span className="text-blue-400">"{field}"</span>: <span className="text-green-300">{desc}</span>{fi < Object.entries(epWithBody.requestBody!).length - 1 ? ',' : ''}</div>
                                ))}
                                <div>{'}'}</div>
                              </div>
                            </div>
                          )}

                          {/* Example Request */}
                          <div className="bg-[#1e1e2e] rounded-xl p-3 text-xs font-mono text-gray-300">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-gray-500 font-sans font-medium">
                                {language === 'en' ? 'Example Request' : 'リクエスト例'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const authHeader = ep.auth === 'X-API-Key'
                                    ? '-H "X-API-Key: rkb_YOUR_KEY"'
                                    : '-H "Authorization: Bearer YOUR_TOKEN"';
                                  handleCopy(
                                    `curl -X ${ep.method} ${window.location.origin}${ep.path} \\\n  ${authHeader} \\\n  -H "Content-Type: application/json"`,
                                    epKey,
                                  );
                                }}
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {copiedKey === epKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <div><span className="text-emerald-400">curl</span> <span className="text-blue-400">-X {ep.method}</span> \</div>
                            <div>  <span className="text-amber-300">{window.location.origin}{ep.path}</span> \</div>
                            <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"{ep.auth === 'X-API-Key' ? 'X-API-Key: rkb_...' : 'Authorization: Bearer ...'}"</span></div>
                          </div>

                          {/* Example Response */}
                          {epWithBody.responseExample && (
                            <div className="bg-[#1e1e2e] rounded-xl p-3 text-xs font-mono text-gray-300">
                              <span className="text-[10px] text-gray-500 font-sans font-medium block mb-2">
                                {language === 'en' ? 'Example Response' : 'レスポンス例'}
                              </span>
                              <pre className="whitespace-pre-wrap text-green-300">{epWithBody.responseExample}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Webhooks Preview */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rakubun-surface/80">
                    <Webhook className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-heading font-semibold text-rakubun-text text-sm">
                      {language === 'en' ? 'Webhooks' : 'Webhook'}
                    </h4>
                    <p className="text-xs text-rakubun-text-secondary mt-0.5">
                      {language === 'en'
                        ? 'Receive real-time notifications when articles are published, analyses complete, or schedules trigger.'
                        : '記事公開、分析完了、スケジュールトリガー時にリアルタイム通知を受信。'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-2.5 py-1 rounded-full">
                    {language === 'en' ? 'Coming Soon' : '近日公開'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Profile Tab ──────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Profile' : 'プロフィール'}
              </h3>
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rakubun-accent to-blue-400 flex items-center justify-center text-white text-xl font-bold">
                    U
                  </div>
                  <div>
                    <button className="btn-secondary text-sm">
                      {language === 'en' ? 'Change Avatar' : 'アバター変更'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                      {language === 'en' ? 'Full Name' : '氏名'}
                    </label>
                    <input type="text" defaultValue="User" className="rakubun-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                      {language === 'en' ? 'Email' : 'メール'}
                    </label>
                    <input type="email" defaultValue="user@example.com" className="rakubun-input" />
                  </div>
                </div>
                <button className="btn-primary text-sm">
                  {language === 'en' ? 'Save Changes' : '変更を保存'}
                </button>
              </div>
            </div>
          )}

          {/* ── Notifications Tab ────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Notification Preferences' : '通知設定'}
              </h3>

              {notifLoading ? (
                <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
                </div>
              ) : (
                <>
                  {/* Master Email Toggle */}
                  <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${notifSettings.emailEnabled ? 'bg-rakubun-accent/10' : 'bg-rakubun-bg-secondary'}`}>
                          <Power className={`w-5 h-5 ${notifSettings.emailEnabled ? 'text-rakubun-accent' : 'text-rakubun-text-secondary'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-rakubun-text">
                            {language === 'en' ? 'Email Notifications' : 'メール通知'}
                          </h4>
                          <p className="text-xs text-rakubun-text-secondary mt-0.5">
                            {language === 'en'
                              ? 'Enable or disable all email notifications at once'
                              : 'すべてのメール通知を一括で有効・無効にする'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={toggleEmailEnabled}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 ${
                          notifSettings.emailEnabled ? 'bg-rakubun-accent' : 'bg-rakubun-border'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            notifSettings.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Individual Notification Preferences */}
                  <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 space-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-rakubun-text">
                        {language === 'en' ? 'Notification Channels' : '通知チャンネル'}
                      </h4>
                      <div className="flex items-center gap-8 pr-1">
                        <span className="text-[11px] font-medium text-rakubun-text-secondary uppercase tracking-wider w-12 text-center">
                          {language === 'en' ? 'Email' : 'メール'}
                        </span>
                        <span className="text-[11px] font-medium text-rakubun-text-secondary uppercase tracking-wider w-12 text-center">
                          {language === 'en' ? 'In-App' : 'アプリ内'}
                        </span>
                      </div>
                    </div>
                    {notificationKeys.map((item) => {
                      const pref = notifSettings.preferences[item.key];
                      const emailDisabled = !notifSettings.emailEnabled;
                      return (
                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-rakubun-border last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-rakubun-text">{item.label[language]}</span>
                            <p className="text-xs text-rakubun-text-secondary mt-0.5">{item.description[language]}</p>
                          </div>
                          <div className="flex items-center gap-8 shrink-0">
                            <div className="w-12 flex justify-center">
                              <button
                                onClick={() => toggleNotifPref(item.key, 'email')}
                                disabled={emailDisabled}
                                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 ${
                                  emailDisabled
                                    ? 'bg-rakubun-border/50 cursor-not-allowed opacity-50'
                                    : pref.email
                                      ? 'bg-rakubun-accent'
                                      : 'bg-rakubun-border'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    pref.email ? 'translate-x-5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="w-12 flex justify-center">
                              <button
                                onClick={() => toggleNotifPref(item.key, 'inApp')}
                                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 ${
                                  pref.inApp ? 'bg-rakubun-accent' : 'bg-rakubun-border'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                    pref.inApp ? 'translate-x-5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-4">
                      <button
                        onClick={saveNotificationSettings}
                        disabled={!notifDirty || notifSaving}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {notifSaving ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'en' ? 'Saving...' : '保存中...'}</>
                        ) : (
                          <>{language === 'en' ? 'Save Preferences' : '設定を保存'}</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Send Test Email */}
                  <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-rakubun-text">
                          {language === 'en' ? 'Send Test Email' : 'テストメール送信'}
                        </h4>
                        <p className="text-xs text-rakubun-text-secondary mt-0.5">
                          {language === 'en'
                            ? 'Verify that email notifications are working correctly'
                            : 'メール通知が正しく動作しているか確認する'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder={language === 'en' ? 'Enter your email address' : 'メールアドレスを入力'}
                        className="rakubun-input flex-1"
                      />
                      <button
                        onClick={sendTestEmail}
                        disabled={testEmailSending || !testEmailAddress}
                        className="btn-primary text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testEmailSending ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'en' ? 'Sending...' : '送信中...'}</>
                        ) : (
                          <><Send className="w-4 h-4" /> {language === 'en' ? 'Send Test' : 'テスト送信'}</>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── General Tab ──────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'General Settings' : '一般設定'}
              </h3>
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                    {language === 'en' ? 'Default Language' : 'デフォルト言語'}
                  </label>
                  <select className="rakubun-input">
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                    {language === 'en' ? 'Timezone' : 'タイムゾーン'}
                  </label>
                  <select className="rakubun-input">
                    <option>{language === 'en' ? 'UTC+9 (Tokyo)' : 'UTC+9（東京）'}</option>
                    <option>{language === 'en' ? 'UTC-8 (Los Angeles)' : 'UTC-8（ロサンゼルス）'}</option>
                    <option>{language === 'en' ? 'UTC-5 (New York)' : 'UTC-5（ニューヨーク）'}</option>
                    <option>{language === 'en' ? 'UTC+0 (London)' : 'UTC+0（ロンドン）'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                    {language === 'en' ? 'Default AI Model' : 'デフォルトAIモデル'}
                  </label>
                  <select className="rakubun-input">
                    <option>GPT-4o</option>
                    <option>Claude Opus 4.6</option>
                    <option>Claude Sonnet 4</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-rakubun-border">
                  <h4 className="text-sm font-medium text-red-600 mb-2">
                    {language === 'en' ? 'Danger Zone' : '危険ゾーン'}
                  </h4>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    {language === 'en' ? 'Delete Account' : 'アカウント削除'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Key Modal ──────────────────────────────────────── */}
      {showCreateModal && !newKeyResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 pt-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rakubun-accent/10">
                  <Key className="w-5 h-5 text-rakubun-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-rakubun-text">
                    {language === 'en' ? 'Create API Key' : 'APIキーを作成'}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary">
                    {language === 'en'
                      ? 'Generate a key for AI agents or external tools.'
                      : 'AIエージェントまたは外部ツール用のキーを生成。'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-8 pb-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Key Name' : 'キー名'}
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. My AI Agent, Content Pipeline' : '例: マイAIエージェント、コンテンツパイプライン'}
                  className="rakubun-input"
                  autoFocus
                />
                <p className="text-xs text-rakubun-text-secondary mt-1">
                  {language === 'en'
                    ? 'A descriptive name to identify this key later.'
                    : '後でこのキーを識別するための説明的な名前。'}
                </p>
              </div>

              <div className="bg-rakubun-bg rounded-xl p-3 text-xs text-rakubun-text-secondary flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rakubun-accent" />
                <span>
                  {language === 'en'
                    ? 'This key will have full access to all agent endpoints — publish articles, upload images, manage sites, and more.'
                    : 'このキーはすべてのエージェントエンドポイントへのフルアクセスを持ちます — 記事公開、画像アップロード、サイト管理など。'}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary text-sm">
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || creatingKey}
                  className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingKey ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'en' ? 'Creating...' : '作成中...'}</>
                  ) : (
                    <><Key className="w-4 h-4" /> {language === 'en' ? 'Create Key' : 'キー作成'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Key Result Modal ───────────────────────────────────── */}
      {showCreateModal && newKeyResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-heading font-bold text-rakubun-text">
                {language === 'en' ? 'API Key Created!' : 'APIキーが作成されました！'}
              </h3>
              <p className="text-sm text-rakubun-text-secondary mt-1">
                {language === 'en'
                  ? 'Copy your key now — it won\'t be shown again.'
                  : 'キーを今コピーしてください — 再表示されません。'}
              </p>
            </div>

            <div className="bg-rakubun-bg rounded-xl p-4 mb-3">
              <label className="text-xs font-medium text-rakubun-text-secondary mb-1 block">
                {language === 'en' ? 'Key Name' : 'キー名'}
              </label>
              <p className="text-sm font-medium text-rakubun-text">{newKeyResult.name}</p>
            </div>

            <div className="bg-rakubun-bg rounded-xl p-4 mb-4">
              <label className="text-xs font-medium text-rakubun-text-secondary mb-2 block">
                {language === 'en' ? 'Your API Key' : 'あなたのAPIキー'}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-rakubun-text bg-rakubun-surface rounded-lg px-3 py-2 border border-rakubun-border select-all break-all">
                  {newKeyResult.key}
                </code>
                <button
                  onClick={() => handleCopy(newKeyResult.key, 'new-key')}
                  className="btn-secondary text-xs py-2 px-3 shrink-0"
                >
                  {copiedKey === 'new-key' ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-600" /> {language === 'en' ? 'Copied!' : 'コピー済!'}</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> {language === 'en' ? 'Copy' : 'コピー'}</>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-400 mb-6">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                {language === 'en'
                  ? 'Store this key securely. For security reasons, we cannot show the full key again. If lost, you\'ll need to create a new one.'
                  : 'このキーを安全に保管してください。セキュリティ上の理由から、完全なキーを再表示することはできません。紛失した場合、新しいキーを作成する必要があります。'}
              </span>
            </div>

            <button
              onClick={() => { setShowCreateModal(false); setNewKeyResult(null); }}
              className="w-full btn-primary text-sm"
            >
              {language === 'en' ? 'Done' : '完了'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
