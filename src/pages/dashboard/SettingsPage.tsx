import { useState } from 'react';
import {
  Settings,
  Key,
  Eye,
  EyeOff,
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
  Zap,
  Globe,
  FileText,
  BarChart3,
  Bot,
  Webhook,
  X,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

// ── Dashboard API Keys ──────────────────────────────────────────────
interface DashboardApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  status: 'active' | 'revoked' | 'expired';
  created: string;
  lastUsed: string | null;
  expiresAt: string | null;
  requests30d: number;
}

const dashboardApiKeys: DashboardApiKey[] = [
  {
    id: '1',
    name: 'Production Agent',
    prefix: 'rbk_live_...a4Xb',
    permissions: ['read:articles', 'write:articles', 'read:analytics', 'read:sites'],
    status: 'active',
    created: 'Jan 15, 2026',
    lastUsed: '2 min ago',
    expiresAt: null,
    requests30d: 12847,
  },
  {
    id: '2',
    name: 'Content Automation Bot',
    prefix: 'rbk_live_...fG92',
    permissions: ['read:articles', 'write:articles', 'read:research'],
    status: 'active',
    created: 'Feb 1, 2026',
    lastUsed: '3 hours ago',
    expiresAt: 'Mar 1, 2026',
    requests30d: 3421,
  },
  {
    id: '3',
    name: 'Analytics Reporter',
    prefix: 'rbk_live_...kR7m',
    permissions: ['read:analytics', 'read:sites'],
    status: 'active',
    created: 'Feb 10, 2026',
    lastUsed: '1 day ago',
    expiresAt: null,
    requests30d: 856,
  },
  {
    id: '4',
    name: 'Old Integration Key',
    prefix: 'rbk_live_...pQ3x',
    permissions: ['read:articles'],
    status: 'revoked',
    created: 'Dec 5, 2025',
    lastUsed: 'Jan 20, 2026',
    expiresAt: null,
    requests30d: 0,
  },
];

// ── Permission scopes ───────────────────────────────────────────────
const permissionScopes = [
  { scope: 'read:articles', label: { en: 'Read Articles', ja: '記事の読み取り' }, description: { en: 'List and read articles, drafts, and metadata', ja: '記事、下書き、メタデータの一覧・読み取り' } },
  { scope: 'write:articles', label: { en: 'Write Articles', ja: '記事の書き込み' }, description: { en: 'Create, update, publish, and delete articles', ja: '記事の作成、更新、公開、削除' } },
  { scope: 'read:sites', label: { en: 'Read Sites', ja: 'サイトの読み取り' }, description: { en: 'List connected sites and their status', ja: '接続サイトとステータスの一覧' } },
  { scope: 'write:sites', label: { en: 'Manage Sites', ja: 'サイトの管理' }, description: { en: 'Add, remove, and configure WordPress sites', ja: 'WordPressサイトの追加、削除、設定' } },
  { scope: 'read:analytics', label: { en: 'Read Analytics', ja: 'アナリティクスの読み取り' }, description: { en: 'Access views, traffic, and performance data', ja: 'ビュー、トラフィック、パフォーマンスデータへのアクセス' } },
  { scope: 'read:research', label: { en: 'Read Research', ja: 'リサーチの読み取り' }, description: { en: 'Access trending topics and saved research', ja: 'トレンドトピックと保存済みリサーチへのアクセス' } },
  { scope: 'write:research', label: { en: 'Trigger Research', ja: 'リサーチの実行' }, description: { en: 'Start new research queries and AI searches', ja: '新しいリサーチクエリとAI検索の開始' } },
  { scope: 'read:scheduler', label: { en: 'Read Scheduler', ja: 'スケジューラーの読み取り' }, description: { en: 'View publishing schedule and queue', ja: '公開スケジュールとキューの閲覧' } },
  { scope: 'write:scheduler', label: { en: 'Manage Scheduler', ja: 'スケジューラーの管理' }, description: { en: 'Schedule, reschedule, and cancel publications', ja: '公開のスケジュール、再スケジュール、キャンセル' } },
  { scope: 'trigger:analysis', label: { en: 'Trigger Analysis', ja: '分析の実行' }, description: { en: 'Start AI site analysis and read reports', ja: 'AIサイト分析の開始とレポートの読み取り' } },
  { scope: 'trigger:generation', label: { en: 'Trigger Generation', ja: '生成の実行' }, description: { en: 'Start AI article generation', ja: 'AI記事生成の開始' } },
];

// ── API Docs endpoints ──────────────────────────────────────────────
const apiEndpoints = [
  { method: 'GET' as const, path: '/api/v1/articles', label: { en: 'List Articles', ja: '記事一覧' }, description: { en: 'Retrieve all articles with optional filtering by status, site, and date range.', ja: 'ステータス、サイト、日付範囲でフィルタリング可能なすべての記事を取得。' }, scope: 'read:articles', category: 'articles' },
  { method: 'POST' as const, path: '/api/v1/articles', label: { en: 'Create Article', ja: '記事作成' }, description: { en: 'Create a new article or trigger AI generation with a topic prompt.', ja: 'トピックプロンプトで新しい記事を作成またはAI生成をトリガー。' }, scope: 'write:articles', category: 'articles' },
  { method: 'GET' as const, path: '/api/v1/articles/:id', label: { en: 'Get Article', ja: '記事取得' }, description: { en: 'Retrieve a specific article by ID, including content, metadata, and SEO score.', ja: 'ID指定で記事を取得（コンテンツ、メタデータ、SEOスコア含む）。' }, scope: 'read:articles', category: 'articles' },
  { method: 'PUT' as const, path: '/api/v1/articles/:id', label: { en: 'Update Article', ja: '記事更新' }, description: { en: 'Update article content, title, metadata, or status.', ja: '記事のコンテンツ、タイトル、メタデータ、ステータスを更新。' }, scope: 'write:articles', category: 'articles' },
  { method: 'POST' as const, path: '/api/v1/articles/:id/publish', label: { en: 'Publish Article', ja: '記事公開' }, description: { en: 'Publish an article immediately to the connected WordPress site.', ja: '接続されたWordPressサイトに記事を即座に公開。' }, scope: 'write:articles', category: 'articles' },
  { method: 'GET' as const, path: '/api/v1/sites', label: { en: 'List Sites', ja: 'サイト一覧' }, description: { en: 'List all connected WordPress sites and their connection status.', ja: 'すべての接続WordPressサイトとステータスを一覧。' }, scope: 'read:sites', category: 'sites' },
  { method: 'GET' as const, path: '/api/v1/analytics/overview', label: { en: 'Analytics Overview', ja: 'アナリティクス概要' }, description: { en: 'Get aggregated analytics: views, visitors, read time, bounce rate.', ja: '集約アナリティクスを取得: ビュー、訪問者、読了時間、直帰率。' }, scope: 'read:analytics', category: 'analytics' },
  { method: 'GET' as const, path: '/api/v1/analytics/articles/:id', label: { en: 'Article Analytics', ja: '記事アナリティクス' }, description: { en: 'Get detailed analytics for a specific article.', ja: '特定の記事の詳細アナリティクスを取得。' }, scope: 'read:analytics', category: 'analytics' },
  { method: 'GET' as const, path: '/api/v1/research/trending', label: { en: 'Trending Topics', ja: 'トレンドトピック' }, description: { en: 'Get current trending topics in your configured niches.', ja: '設定済みニッチの現在のトレンドトピックを取得。' }, scope: 'read:research', category: 'research' },
  { method: 'POST' as const, path: '/api/v1/research/search', label: { en: 'AI Search', ja: 'AI検索' }, description: { en: 'Perform an AI-powered web research query and get summarized results.', ja: 'AI搭載ウェブリサーチクエリを実行し、要約結果を取得。' }, scope: 'write:research', category: 'research' },
  { method: 'POST' as const, path: '/api/v1/analysis/run', label: { en: 'Run Analysis', ja: '分析実行' }, description: { en: 'Trigger a full AI site analysis for tone, structure, SEO, and content gaps.', ja: 'トーン、構造、SEO、コンテンツギャップの完全なAIサイト分析をトリガー。' }, scope: 'trigger:analysis', category: 'analysis' },
  { method: 'GET' as const, path: '/api/v1/scheduler/queue', label: { en: 'Get Queue', ja: 'キュー取得' }, description: { en: 'Get the current publishing queue with scheduled articles.', ja: '予定記事の現在の公開キューを取得。' }, scope: 'read:scheduler', category: 'scheduler' },
  { method: 'POST' as const, path: '/api/v1/scheduler/schedule', label: { en: 'Schedule Article', ja: '記事スケジュール' }, description: { en: 'Schedule an article for publishing at a specific date and time.', ja: '特定の日時に記事の公開をスケジュール。' }, scope: 'write:scheduler', category: 'scheduler' },
];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-purple-100 text-purple-700',
};

const categoryIcons: Record<string, typeof FileText> = {
  articles: FileText,
  sites: Globe,
  analytics: BarChart3,
  research: Zap,
  analysis: Activity,
  scheduler: Clock,
};

const statusConfig = {
  active: { label: { en: 'Active', ja: '有効' }, class: 'status-badge-success', icon: CheckCircle2 },
  revoked: { label: { en: 'Revoked', ja: '無効化済' }, class: 'status-badge-error', icon: AlertTriangle },
  expired: { label: { en: 'Expired', ja: '期限切れ' }, class: 'status-badge-error', icon: AlertTriangle },
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
  const [activeTab, setActiveTab] = useState('api-keys');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewKeyResult, setShowNewKeyResult] = useState(false);
  const [showKey, setShowKey] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [docsCategory, setDocsCategory] = useState<string>('all');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [keyExpiry, setKeyExpiry] = useState('never');

  const toggleShowKey = (id: string) => {
    setShowKey(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = (id: string) => {
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePermission = (scope: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
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
                    {language === 'en' ? 'Dashboard API Keys' : 'ダッシュボードAPIキー'}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {language === 'en'
                      ? 'Create keys to let AI agents, automations, or external tools access your RakuBun dashboard via the API.'
                      : 'AIエージェント、自動化、外部ツールがAPI経由でRakuBunダッシュボードにアクセスするためのキーを作成。'}
                  </p>
                </div>
                <button onClick={() => { setShowCreateModal(true); setShowNewKeyResult(false); setSelectedPermissions(new Set()); setKeyExpiry('never'); }} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" />
                  {language === 'en' ? 'Create Key' : 'キー作成'}
                </button>
              </div>

              {/* Info banner */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-4 flex items-start gap-3">
                <Bot className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    {language === 'en' ? 'Connect AI Agents & External Tools' : 'AIエージェント＆外部ツールを接続'}
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {language === 'en'
                      ? 'Each key has fine-grained permissions so your integrations only access what they need. Use keys to connect your AI agent, automation pipelines, or any tool that speaks REST.'
                      : '各キーには細かい権限設定があり、統合は必要なデータのみにアクセス。AIエージェント、自動化パイプライン、REST対応ツールの接続に使用。'}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-4">
                  <p className="text-2xl font-heading font-bold text-rakubun-text">
                    {dashboardApiKeys.filter(k => k.status === 'active').length}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-0.5">
                    {language === 'en' ? 'Active Keys' : 'アクティブキー'}
                  </p>
                </div>
                <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-4">
                  <p className="text-2xl font-heading font-bold text-rakubun-text">
                    {dashboardApiKeys.reduce((sum, k) => sum + k.requests30d, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-0.5">
                    {language === 'en' ? 'Requests (30d)' : 'リクエスト (30日)'}
                  </p>
                </div>
                <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-4">
                  <p className="text-2xl font-heading font-bold text-emerald-600">
                    99.9%
                  </p>
                  <p className="text-xs text-rakubun-text-secondary mt-0.5">
                    {language === 'en' ? 'Uptime' : '稼働率'}
                  </p>
                </div>
              </div>

              {/* Keys List */}
              <div className="space-y-3">
                {dashboardApiKeys.map((key) => {
                  const statusCfg = statusConfig[key.status];
                  return (
                    <div
                      key={key.id}
                      className={`bg-rakubun-surface rounded-2xl border border-rakubun-border p-4 hover:shadow-md transition-all duration-300 ${
                        key.status === 'revoked' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          key.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-gray-100 dark:bg-gray-500/10'
                        }`}>
                          <Key className={`w-4 h-4 ${
                            key.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-rakubun-text">{key.name}</h4>
                            <span className={`status-badge ${statusCfg.class}`}>
                              <statusCfg.icon className="w-3 h-3" />
                              <span>{statusCfg.label[language]}</span>
                            </span>
                          </div>

                          {/* Key preview */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <code className="text-xs text-rakubun-text-secondary font-mono bg-rakubun-bg px-2 py-0.5 rounded">
                              {showKey.has(key.id) ? 'rbk_live_f8a3k29dm4x7p2ql9vbn' : key.prefix}
                            </code>
                            <button
                              onClick={() => toggleShowKey(key.id)}
                              className="p-1 rounded hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                            >
                              {showKey.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(key.id)}
                              className="p-1 rounded hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                            >
                              {copiedKey === key.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Permissions */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {key.permissions.map((perm) => (
                              <span
                                key={perm}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rakubun-bg text-rakubun-text-secondary"
                              >
                                <Hash className="w-2.5 h-2.5" />
                                {perm}
                              </span>
                            ))}
                          </div>

                          {/* Meta info */}
                          <div className="flex items-center gap-4 mt-2 text-xs text-rakubun-text-secondary">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {language === 'en' ? 'Created' : '作成'}: {key.created}
                            </span>
                            {key.lastUsed && (
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {language === 'en' ? 'Last used' : '最終使用'}: {key.lastUsed}
                              </span>
                            )}
                            {key.requests30d > 0 && (
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {key.requests30d.toLocaleString()} {language === 'en' ? 'requests' : 'リクエスト'}
                              </span>
                            )}
                            {key.expiresAt && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="w-3 h-3" />
                                {language === 'en' ? 'Expires' : '有効期限'}: {key.expiresAt}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {key.status === 'active' && (
                            <button className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors" title={language === 'en' ? 'Regenerate' : '再生成'}>
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 transition-colors" title={key.status === 'active' ? (language === 'en' ? 'Revoke' : '無効化') : (language === 'en' ? 'Delete' : '削除')}>
                            {key.status === 'active' ? <Shield className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Start Snippet */}
              <div className="bg-[#1e1e2e] rounded-2xl p-5 text-sm font-mono overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-sans font-medium flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Quick Start' : 'クイックスタート'}
                  </span>
                  <button
                    onClick={() => handleCopy('snippet')}
                    className="text-xs text-gray-400 hover:text-white font-sans flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'snippet' ? (language === 'en' ? 'Copied!' : 'コピー済!') : (language === 'en' ? 'Copy' : 'コピー')}
                  </button>
                </div>
                <div className="text-gray-300 space-y-1 text-xs leading-relaxed">
                  <div><span className="text-emerald-400">curl</span> <span className="text-blue-400">-X GET</span> \</div>
                  <div>  <span className="text-amber-300">https://api.rakubun.com/v1/articles</span> \</div>
                  <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"Authorization: Bearer rbk_live_YOUR_KEY"</span> \</div>
                  <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"Content-Type: application/json"</span></div>
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
                    ? 'Full reference for the RakuBun Dashboard REST API. Use your API key to authenticate.'
                    : 'RakuBunダッシュボードREST APIの完全リファレンス。APIキーで認証。'}
                </p>
              </div>

              {/* Base URL */}
              <div className="bg-[#1e1e2e] rounded-2xl p-4 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-sans font-medium shrink-0">Base URL</span>
                <code className="text-sm text-emerald-400 font-mono">https://api.rakubun.com</code>
                <button onClick={() => handleCopy('baseurl')} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  {copiedKey === 'baseurl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Authentication */}
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-rakubun-accent" />
                  <h4 className="font-heading font-semibold text-rakubun-text text-sm">
                    {language === 'en' ? 'Authentication' : '認証'}
                  </h4>
                </div>
                <p className="text-sm text-rakubun-text-secondary mb-3">
                  {language === 'en'
                    ? 'All API requests require a Bearer token in the Authorization header:'
                    : 'すべてのAPIリクエストにはAuthorizationヘッダーにBearerトークンが必要:'}
                </p>
                <div className="bg-rakubun-bg rounded-xl p-3 font-mono text-xs text-rakubun-text">
                  Authorization: Bearer <span className="text-rakubun-accent">rbk_live_your_api_key_here</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {language === 'en'
                      ? 'Never expose your API key in client-side code. Always make API calls from your server or AI agent backend.'
                      : 'APIキーをクライアントサイドコードに公開しないでください。常にサーバーまたはAIエージェントバックエンドからAPI呼び出しを行ってください。'}
                  </span>
                </div>
              </div>

              {/* Rate Limits */}
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <h4 className="font-heading font-semibold text-rakubun-text text-sm">
                    {language === 'en' ? 'Rate Limits' : 'レート制限'}
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-rakubun-bg rounded-xl p-3">
                    <p className="text-lg font-heading font-bold text-rakubun-text">1,000</p>
                    <p className="text-xs text-rakubun-text-secondary">{language === 'en' ? 'Requests / min' : 'リクエスト / 分'}</p>
                  </div>
                  <div className="bg-rakubun-bg rounded-xl p-3">
                    <p className="text-lg font-heading font-bold text-rakubun-text">50,000</p>
                    <p className="text-xs text-rakubun-text-secondary">{language === 'en' ? 'Requests / day' : 'リクエスト / 日'}</p>
                  </div>
                  <div className="bg-rakubun-bg rounded-xl p-3">
                    <p className="text-lg font-heading font-bold text-rakubun-text">10 MB</p>
                    <p className="text-xs text-rakubun-text-secondary">{language === 'en' ? 'Max payload' : '最大ペイロード'}</p>
                  </div>
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
                      <span className="capitalize">{cat === 'all' ? (language === 'en' ? 'All' : '全て') : cat}</span>
                    </button>
                  );
                })}
              </div>

              {/* Endpoints List */}
              <div className="space-y-2">
                {filteredEndpoints.map((ep, i) => {
                  const epKey = `${ep.method}-${ep.path}`;
                  const isExpanded = expandedEndpoint === epKey;
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
                        <code className="text-sm font-mono text-rakubun-text flex-1">{ep.path}</code>
                        <span className="text-xs text-rakubun-text-secondary hidden sm:inline">{ep.label[language]}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-rakubun-border pt-3 space-y-3">
                          <p className="text-sm text-rakubun-text-secondary">{ep.description[language]}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-rakubun-text-secondary">
                              {language === 'en' ? 'Required scope:' : '必要スコープ:'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-rakubun-accent/10 text-rakubun-accent font-mono">
                              <Hash className="w-2.5 h-2.5" />
                              {ep.scope}
                            </span>
                          </div>
                          {/* Example Request */}
                          <div className="bg-[#1e1e2e] rounded-xl p-3 text-xs font-mono text-gray-300">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-gray-500 font-sans font-medium">
                                {language === 'en' ? 'Example Request' : 'リクエスト例'}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopy(epKey); }}
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {copiedKey === epKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <div><span className="text-emerald-400">curl</span> <span className="text-blue-400">-X {ep.method}</span> \</div>
                            <div>  <span className="text-amber-300">https://api.rakubun.com{ep.path}</span> \</div>
                            <div>  <span className="text-blue-400">-H</span> <span className="text-green-300">"Authorization: Bearer rbk_live_..."</span></div>
                          </div>
                          {/* Example Response */}
                          <div className="bg-[#1e1e2e] rounded-xl p-3 text-xs font-mono text-gray-300">
                            <span className="text-[10px] text-gray-500 font-sans font-medium block mb-2">
                              {language === 'en' ? 'Example Response' : 'レスポンス例'}
                            </span>
                            <div>{'{'}</div>
                            <div>  <span className="text-blue-400">"success"</span>: <span className="text-emerald-400">true</span>,</div>
                            <div>  <span className="text-blue-400">"data"</span>: {'['} ... {']'},</div>
                            <div>  <span className="text-blue-400">"meta"</span>: {'{'} <span className="text-blue-400">"total"</span>: <span className="text-amber-300">47</span>, <span className="text-blue-400">"page"</span>: <span className="text-amber-300">1</span> {'}'}</div>
                            <div>{'}'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Webhooks Preview */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rakubun-surface/80">
                    <Webhook className="w-5 h-5 text-purple-600" />
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
                  <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2.5 py-1 rounded-full">
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
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-6 space-y-5">
                {[
                  { label: { en: 'Article published', ja: '記事公開時' }, email: true, inApp: true },
                  { label: { en: 'AI generation complete', ja: 'AI生成完了時' }, email: false, inApp: true },
                  { label: { en: 'Site connection issues', ja: 'サイト接続問題時' }, email: true, inApp: true },
                  { label: { en: 'Scheduled article reminders', ja: '予約記事リマインダー' }, email: true, inApp: true },
                  { label: { en: 'Weekly analytics report', ja: '週間アナリティクスレポート' }, email: true, inApp: false },
                  { label: { en: 'System updates', ja: 'システムアップデート' }, email: false, inApp: true },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-rakubun-border last:border-0">
                    <span className="text-sm text-rakubun-text">{pref.label[language]}</span>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked={pref.email} className="rounded border-black/20 text-rakubun-accent focus:ring-rakubun-accent/20" />
                        <span className="text-xs text-rakubun-text-secondary">
                          {language === 'en' ? 'Email' : 'メール'}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked={pref.inApp} className="rounded border-black/20 text-rakubun-accent focus:ring-rakubun-accent/20" />
                        <span className="text-xs text-rakubun-text-secondary">
                          {language === 'en' ? 'In-App' : 'アプリ内'}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
                <button className="btn-primary text-sm mt-2">
                  {language === 'en' ? 'Save Preferences' : '設定を保存'}
                </button>
              </div>
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
                    <option>UTC+9 (Tokyo)</option>
                    <option>UTC-8 (Los Angeles)</option>
                    <option>UTC-5 (New York)</option>
                    <option>UTC+0 (London)</option>
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
      {showCreateModal && !showNewKeyResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
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
                      ? 'Generate a key for AI agents or external integrations.'
                      : 'AIエージェントまたは外部統合用のキーを生成。'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Key Name' : 'キー名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. My AI Agent, Content Pipeline' : '例: マイAIエージェント、コンテンツパイプライン'}
                  className="rakubun-input"
                />
                <p className="text-xs text-rakubun-text-secondary mt-1">
                  {language === 'en'
                    ? 'A descriptive name to identify this key later.'
                    : '後でこのキーを識別するための説明的な名前。'}
                </p>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Expiration' : '有効期限'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { value: 'never', label: { en: 'Never', ja: '無期限' } },
                    { value: '30d', label: { en: '30 days', ja: '30日' } },
                    { value: '90d', label: { en: '90 days', ja: '90日' } },
                    { value: '1y', label: { en: '1 year', ja: '1年' } },
                    { value: 'custom', label: { en: 'Custom', ja: 'カスタム' } },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setKeyExpiry(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        keyExpiry === opt.value
                          ? 'border-rakubun-accent bg-rakubun-accent/5 text-rakubun-accent'
                          : 'border-rakubun-border text-rakubun-text-secondary hover:border-black/20'
                      }`}
                    >
                      {opt.label[language]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-rakubun-text">
                    {language === 'en' ? 'Permissions' : '権限'}
                  </label>
                  <button
                    onClick={() => {
                      if (selectedPermissions.size === permissionScopes.length) {
                        setSelectedPermissions(new Set());
                      } else {
                        setSelectedPermissions(new Set(permissionScopes.map(p => p.scope)));
                      }
                    }}
                    className="text-xs text-rakubun-accent font-medium hover:underline"
                  >
                    {selectedPermissions.size === permissionScopes.length
                      ? (language === 'en' ? 'Deselect All' : '全解除')
                      : (language === 'en' ? 'Select All' : '全選択')}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {permissionScopes.map((perm) => (
                    <label
                      key={perm.scope}
                      className={`
                        flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                        ${selectedPermissions.has(perm.scope)
                          ? 'border-rakubun-accent/30 bg-rakubun-accent/5'
                          : 'border-rakubun-border hover:border-rakubun-border bg-rakubun-surface'
                        }
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.has(perm.scope)}
                        onChange={() => togglePermission(perm.scope)}
                        className="rounded border-black/20 text-rakubun-accent focus:ring-rakubun-accent/20 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-rakubun-text">{perm.label[language]}</span>
                          <code className="text-[10px] font-mono text-rakubun-text-secondary bg-rakubun-bg px-1.5 py-0.5 rounded">
                            {perm.scope}
                          </code>
                        </div>
                        <p className="text-xs text-rakubun-text-secondary mt-0.5">{perm.description[language]}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary text-sm">
                  {language === 'en' ? 'Cancel' : 'キャンセル'}
                </button>
                <button
                  onClick={() => setShowNewKeyResult(true)}
                  disabled={selectedPermissions.size === 0}
                  className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="w-4 h-4" />
                  {language === 'en' ? 'Create Key' : 'キー作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Key Result Modal ───────────────────────────────────── */}
      {showCreateModal && showNewKeyResult && (
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

            <div className="bg-rakubun-bg rounded-xl p-4 mb-4">
              <label className="text-xs font-medium text-rakubun-text-secondary mb-2 block">
                {language === 'en' ? 'Your API Key' : 'あなたのAPIキー'}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-rakubun-text bg-rakubun-surface rounded-lg px-3 py-2 border border-rakubun-border select-all">
                  rbk_live_f8a3k29dm4x7p2ql9vbn6wt5je1ym8c
                </code>
                <button
                  onClick={() => handleCopy('new-key')}
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
              onClick={() => { setShowCreateModal(false); setShowNewKeyResult(false); }}
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
