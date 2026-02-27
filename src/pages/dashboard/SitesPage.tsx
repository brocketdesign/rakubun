import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  ExternalLink,
  Settings,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  MoreVertical,
  Eye,
  EyeOff,
  Link2,
  BookOpen,
  X,
  Copy,
  Loader2,
  Globe,
  Clock,
  FileText,
  Tag,
  Image,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '../../i18n';
import {
  useSites,
  sitesActions,
  type Site,
  type SiteSettings as SiteSettingsType,
} from '../../stores/sitesStore';
import { createApiClient } from '../../lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { useSchedules, schedulesActions } from '../../stores/schedulesStore';
import GoogleAnalyticsConnect from '../../components/GoogleAnalyticsConnect';
import { useCronJobs, cronJobsActions } from '../../stores/cronJobsStore';
import { usePlanLimits, useUsage } from '../../stores/subscriptionStore';
import { UsageMeter } from '../../components/UpgradePrompt';
import { ApiError } from '../../lib/api';

const statusConfig = {
  connected: {
    label: { en: 'Connected', ja: '接続済み' },
    class: 'status-badge-success',
    icon: CheckCircle2,
  },
  warning: {
    label: { en: 'Needs Attention', ja: '注意必要' },
    class: 'status-badge-warning',
    icon: AlertTriangle,
  },
  disconnected: {
    label: { en: 'Disconnected', ja: '切断済み' },
    class: 'status-badge-error',
    icon: AlertTriangle,
  },
};

// ─── Three-dot dropdown menu ────────────────────────────────────────────────

function SiteCardMenu({
  site,
  language,
  onSync,
  onSettings,
  onDelete,
}: {
  site: Site;
  language: 'en' | 'ja';
  onSync: () => void;
  onSettings: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://${site.url}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary opacity-0 group-hover:opacity-100 transition-all"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-48 bg-rakubun-surface border border-rakubun-border rounded-xl shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            onClick={() => { onSettings(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rakubun-text hover:bg-rakubun-bg-secondary transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-rakubun-text-secondary" />
            {language === 'en' ? 'Settings' : '設定'}
          </button>
          <button
            onClick={() => { onSync(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rakubun-text hover:bg-rakubun-bg-secondary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rakubun-text-secondary" />
            {language === 'en' ? 'Sync Now' : '今すぐ同期'}
          </button>
          <button
            onClick={copyUrl}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rakubun-text hover:bg-rakubun-bg-secondary transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-rakubun-text-secondary" />
            {language === 'en' ? 'Copy URL' : 'URLをコピー'}
          </button>
          <a
            href={`https://${site.url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rakubun-text hover:bg-rakubun-bg-secondary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-rakubun-text-secondary" />
            {language === 'en' ? 'Visit Site' : 'サイトを訪問'}
          </a>
          <div className="border-t border-rakubun-border my-1" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {language === 'en' ? 'Delete Site' : 'サイトを削除'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────

interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

function SettingsField({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-rakubun-border/60 bg-rakubun-bg/40 p-4 transition-all hover:border-rakubun-accent/30 hover:bg-rakubun-bg/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 p-1.5 rounded-lg bg-rakubun-accent/8 text-rakubun-accent shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-rakubun-text">{label}</p>
            {description && (
              <p className="text-xs text-rakubun-text-secondary mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}

function SettingsSelect({
  icon: Icon,
  label,
  description,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  placeholder?: string;
}) {
  return (
    <div className="group rounded-2xl border border-rakubun-border/60 bg-rakubun-bg/40 p-4 transition-all hover:border-rakubun-accent/30 hover:bg-rakubun-bg/60">
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 p-1.5 rounded-lg bg-rakubun-accent/8 text-rakubun-accent shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-rakubun-text">{label}</p>
          {description && (
            <p className="text-xs text-rakubun-text-secondary mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-auto min-h-10 py-2 rounded-xl border-rakubun-border bg-rakubun-surface text-rakubun-text text-sm px-3.5 text-left items-start focus:ring-2 focus:ring-rakubun-accent/20 focus:border-rakubun-accent transition-all hover:border-rakubun-accent/40 [&>span]:items-start whitespace-normal overflow-hidden">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-rakubun-border bg-rakubun-surface shadow-xl">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="rounded-lg text-sm text-rakubun-text focus:bg-rakubun-accent/10 focus:text-rakubun-accent cursor-pointer"
            >
              <div className="flex flex-col">
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-rakubun-text-secondary">{opt.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsModal({
  site,
  language,
  onClose,
  onSave,
}: {
  site: Site;
  language: 'en' | 'ja';
  onClose: () => void;
  onSave: (settings: Partial<SiteSettingsType>) => void;
}) {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<SiteSettingsType>({ ...site.settings });

  // WordPress categories
  const [categories, setCategories] = useState<WpCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');

  // Credentials state
  const [credUsername, setCredUsername] = useState(site.username || '');
  const [credPassword, setCredPassword] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credSuccess, setCredSuccess] = useState(false);
  const [credError, setCredError] = useState('');

  // Fetch WordPress categories on mount
  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const api = createApiClient(getToken);
      const data = await api.get<{ categories: WpCategory[] }>(
        `/api/sites/${site.id}/categories`,
      );
      setCategories(data.categories);
    } catch {
      setCategoriesError(
        language === 'en'
          ? 'Could not load categories'
          : 'カテゴリを読み込めませんでした',
      );
    } finally {
      setCategoriesLoading(false);
    }
  }, [getToken, site.id, language]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const save = () => {
    onSave(settings);
    onClose();
  };

  const saveCredentials = async () => {
    if (!credUsername.trim()) {
      setCredError(language === 'en' ? 'Username is required' : 'ユーザー名は必須です');
      return;
    }
    setCredSaving(true);
    setCredError('');
    setCredSuccess(false);
    try {
      const creds: { username: string; applicationPassword?: string } = {
        username: credUsername.trim(),
      };
      if (credPassword.trim()) {
        creds.applicationPassword = credPassword.trim();
      }
      const ok = await sitesActions.updateCredentials(getToken, site.id, creds);
      if (ok) {
        setCredSuccess(true);
        setCredPassword('');
        setTimeout(() => setCredSuccess(false), 3000);
      } else {
        setCredError(language === 'en' ? 'Failed to update credentials' : '認証情報の更新に失敗しました');
      }
    } catch {
      setCredError(language === 'en' ? 'Failed to update credentials' : '認証情報の更新に失敗しました');
    } finally {
      setCredSaving(false);
    }
  };

  // Build category options from WordPress data
  const categoryOptions = categories.map((c) => ({
    value: c.name,
    label: c.name,
    description: `${c.count} ${language === 'en' ? 'posts' : '件'}`,
  }));

  // If the current defaultCategory isn't in the fetched list, add it
  if (
    settings.defaultCategory &&
    !categoryOptions.find((o) => o.value === settings.defaultCategory)
  ) {
    categoryOptions.unshift({
      value: settings.defaultCategory,
      label: settings.defaultCategory,
      description: language === 'en' ? 'Current' : '現在',
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-rakubun-surface rounded-t-3xl px-8 pt-8 pb-4 border-b border-rakubun-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rakubun-accent/10">
                <Settings className="w-5 h-5 text-rakubun-accent" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-rakubun-text">
                  {language === 'en' ? 'Site Settings' : 'サイト設定'}
                </h3>
                <p className="text-sm text-rakubun-text-secondary">{site.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* ─── Publishing Section ─────────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3">
              {language === 'en' ? 'Publishing' : '公開設定'}
            </h4>
            <div className="space-y-3">
              {/* Default Post Status */}
              <SettingsSelect
                icon={FileText}
                label={language === 'en' ? 'Default Post Status' : 'デフォルト投稿ステータス'}
                description={
                  language === 'en'
                    ? 'Status assigned to new posts'
                    : '新規投稿に割り当てられるステータス'
                }
                value={settings.defaultStatus}
                onValueChange={(v) =>
                  setSettings({
                    ...settings,
                    defaultStatus: v as 'draft' | 'publish' | 'pending',
                  })
                }
                options={[
                  {
                    value: 'draft',
                    label: language === 'en' ? 'Draft' : '下書き',
                    description: language === 'en' ? 'Save without publishing' : '公開せずに保存',
                  },
                  {
                    value: 'publish',
                    label: language === 'en' ? 'Published' : '公開',
                    description: language === 'en' ? 'Immediately visible' : 'すぐに表示',
                  },
                  {
                    value: 'pending',
                    label: language === 'en' ? 'Pending Review' : 'レビュー待ち',
                    description: language === 'en' ? 'Awaits editor approval' : '編集者の承認待ち',
                  },
                ]}
              />

              {/* Default Category */}
              <div className="group rounded-2xl border border-rakubun-border/60 bg-rakubun-bg/40 p-4 transition-all hover:border-rakubun-accent/30 hover:bg-rakubun-bg/60">
                <div className="flex items-start gap-3 mb-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-rakubun-accent/8 text-rakubun-accent shrink-0">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-rakubun-text">
                      {language === 'en' ? 'Default Category' : 'デフォルトカテゴリ'}
                    </p>
                    <p className="text-xs text-rakubun-text-secondary mt-0.5">
                      {language === 'en'
                        ? 'Category assigned to new posts'
                        : '新規投稿に割り当てられるカテゴリ'}
                    </p>
                  </div>
                </div>
                {categoriesLoading ? (
                  <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-rakubun-border bg-rakubun-surface text-sm text-rakubun-text-secondary">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {language === 'en' ? 'Loading categories…' : 'カテゴリを読み込み中…'}
                  </div>
                ) : categoriesError ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{categoriesError}</span>
                      <button
                        onClick={fetchCategories}
                        className="ml-auto shrink-0 text-xs font-medium underline underline-offset-2 hover:no-underline"
                      >
                        {language === 'en' ? 'Retry' : '再試行'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={settings.defaultCategory}
                      onChange={(e) =>
                        setSettings({ ...settings, defaultCategory: e.target.value })
                      }
                      placeholder={language === 'en' ? 'Type category name' : 'カテゴリ名を入力'}
                      className="w-full h-10 px-3.5 rounded-xl border border-rakubun-border bg-rakubun-surface text-sm text-rakubun-text focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 focus:border-rakubun-accent transition-all"
                    />
                  </div>
                ) : (
                  <Select
                    value={settings.defaultCategory}
                    onValueChange={(v) =>
                      setSettings({ ...settings, defaultCategory: v })
                    }
                  >
                    <SelectTrigger className="w-full h-auto min-h-10 py-2 rounded-xl border-rakubun-border bg-rakubun-surface text-rakubun-text text-sm px-3.5 text-left items-start focus:ring-2 focus:ring-rakubun-accent/20 focus:border-rakubun-accent transition-all hover:border-rakubun-accent/40 [&>span]:items-start">
                      <SelectValue
                        placeholder={
                          language === 'en' ? 'Select a category' : 'カテゴリを選択'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-rakubun-border bg-rakubun-surface shadow-xl max-h-60">
                      {categoryOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="rounded-lg text-sm text-rakubun-text focus:bg-rakubun-accent/10 focus:text-rakubun-accent cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{opt.label}</span>
                            <span className="text-[11px] text-rakubun-text-secondary tabular-nums">
                              {opt.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* ─── Sync Section ─────────────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3">
              {language === 'en' ? 'Synchronization' : '同期'}
            </h4>
            <div className="space-y-3">
              {/* Auto Sync */}
              <SettingsField
                icon={RefreshCw}
                label={language === 'en' ? 'Auto Sync' : '自動同期'}
                description={
                  language === 'en'
                    ? 'Automatically sync content at intervals'
                    : 'コンテンツを定期的に自動同期'
                }
              >
                <button
                  onClick={() => setSettings({ ...settings, autoSync: !settings.autoSync })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.autoSync ? 'bg-rakubun-accent' : 'bg-rakubun-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.autoSync ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </SettingsField>

              {/* Sync Interval */}
              {settings.autoSync && (
                <SettingsSelect
                  icon={Clock}
                  label={language === 'en' ? 'Sync Interval' : '同期間隔'}
                  description={
                    language === 'en'
                      ? 'How often to sync content'
                      : 'コンテンツを同期する頻度'
                  }
                  value={String(settings.syncInterval)}
                  onValueChange={(v) =>
                    setSettings({ ...settings, syncInterval: Number(v) })
                  }
                  options={[
                    { value: '15', label: language === 'en' ? '15 minutes' : '15分' },
                    { value: '30', label: language === 'en' ? '30 minutes' : '30分' },
                    { value: '60', label: language === 'en' ? '1 hour' : '1時間' },
                    { value: '120', label: language === 'en' ? '2 hours' : '2時間' },
                  ]}
                />
              )}
            </div>
          </div>

          {/* ─── Content Section ───────────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3">
              {language === 'en' ? 'Content' : 'コンテンツ'}
            </h4>
            <div className="space-y-3">
              {/* Auto Images */}
              <SettingsField
                icon={Image}
                label={language === 'en' ? 'Auto Images' : '自動画像'}
                description={
                  language === 'en'
                    ? 'Automatically generate featured images'
                    : 'アイキャッチ画像を自動生成'
                }
              >
                <button
                  onClick={() =>
                    setSettings({ ...settings, autoImages: !settings.autoImages })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.autoImages ? 'bg-rakubun-accent' : 'bg-rakubun-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.autoImages ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </SettingsField>

              {/* SEO Optimization */}
              <SettingsField
                icon={Sparkles}
                label={language === 'en' ? 'SEO Optimization' : 'SEO最適化'}
                description={
                  language === 'en'
                    ? 'Auto-generate meta tags and optimize content'
                    : 'メタタグを自動生成しコンテンツを最適化'
                }
              >
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      seoOptimization: !settings.seoOptimization,
                    })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.seoOptimization ? 'bg-rakubun-accent' : 'bg-rakubun-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.seoOptimization ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </SettingsField>
            </div>
          </div>

          {/* ─── Locale Section ────────────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3">
              {language === 'en' ? 'Locale' : 'ロケール'}
            </h4>
            <div className="space-y-3">
              {/* Content Language */}
              <SettingsSelect
                icon={Globe}
                label={language === 'en' ? 'Content Language' : 'コンテンツ言語'}
                description={
                  language === 'en'
                    ? 'Language for generated content'
                    : '生成されるコンテンツの言語'
                }
                value={settings.language}
                onValueChange={(v) => setSettings({ ...settings, language: v })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ja', label: '日本語' },
                  { value: 'es', label: 'Español' },
                  { value: 'fr', label: 'Français' },
                  { value: 'de', label: 'Deutsch' },
                ]}
              />

              {/* Timezone */}
              <SettingsSelect
                icon={Clock}
                label={language === 'en' ? 'Timezone' : 'タイムゾーン'}
                description={
                  language === 'en'
                    ? 'Timezone for scheduling posts'
                    : '投稿スケジュールのタイムゾーン'
                }
                value={settings.timezone}
                onValueChange={(v) => setSettings({ ...settings, timezone: v })}
                options={[
                  { value: 'UTC', label: 'UTC' },
                  { value: 'America/New_York', label: 'Eastern Time (ET)' },
                  { value: 'America/Chicago', label: 'Central Time (CT)' },
                  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
                  { value: 'Europe/London', label: 'London (GMT)' },
                  { value: 'Europe/Paris', label: 'Paris (CET)' },
                  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
                ]}
              />
            </div>
          </div>

          {/* ─── Google Analytics ──────────────────────────────── */}
          <div className="pt-2 border-t border-rakubun-border/40">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              {language === 'en' ? 'Analytics' : 'アナリティクス'}
            </h4>
            <GoogleAnalyticsConnect 
              siteId={site.id} 
              siteName={site.name}
              variant="card"
            />
          </div>

          {/* ─── WordPress Credentials ─────────────────────────── */}
          <div className="pt-2 border-t border-rakubun-border/40">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-rakubun-text-secondary mb-3 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              {language === 'en' ? 'WordPress Credentials' : 'WordPress認証情報'}
            </h4>

            {credError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
                {credError}
              </div>
            )}
            {credSuccess && (
              <div className="mb-3 p-2.5 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'en' ? 'Credentials updated successfully' : '認証情報を更新しました'}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Username' : 'ユーザー名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'WordPress username' : 'WordPressユーザー名'}
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  className="rakubun-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Application Password' : 'アプリケーションパスワード'}
                </label>
                <div className="relative">
                  <input
                    type={showCredPassword ? 'text' : 'password'}
                    placeholder={language === 'en' ? 'Leave blank to keep current' : '変更しない場合は空欄'}
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    className="rakubun-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCredPassword(!showCredPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
                  >
                    {showCredPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-rakubun-text-secondary mt-1.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {language === 'en'
                    ? 'Generate in WordPress → Users → Application Passwords'
                    : 'WordPress→ユーザー→アプリケーションパスワードで生成'}
                </p>
              </div>
            </div>

            <button
              onClick={saveCredentials}
              disabled={credSaving}
              className="mt-4 w-full btn-secondary text-sm flex items-center justify-center gap-2"
            >
              {credSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {language === 'en' ? 'Update Credentials' : '認証情報を更新'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-rakubun-surface rounded-b-3xl px-8 py-5 border-t border-rakubun-border/40">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 btn-secondary text-sm">
              {language === 'en' ? 'Cancel' : 'キャンセル'}
            </button>
            <button onClick={save} className="flex-1 btn-primary text-sm">
              {language === 'en' ? 'Save Settings' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

function DeleteModal({
  site,
  language,
  onClose,
  onConfirm,
}: {
  site: Site;
  language: 'en' | 'ja';
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-md p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-heading font-bold text-rakubun-text mb-2">
            {language === 'en' ? 'Delete Site' : 'サイトを削除'}
          </h3>
          <p className="text-sm text-rakubun-text-secondary mb-1">
            {language === 'en'
              ? `Are you sure you want to disconnect and delete "${site.name}"?`
              : `「${site.name}」を切断して削除しますか？`}
          </p>
          <p className="text-xs text-rakubun-text-secondary">
            {language === 'en'
              ? 'This action cannot be undone. Articles already published will not be affected.'
              : 'この操作は取り消せません。既に公開済みの記事には影響しません。'}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm">
            {language === 'en' ? 'Cancel' : 'キャンセル'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
          >
            {language === 'en' ? 'Delete' : '削除'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SitesPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const sites = useSites();
  const schedules = useSchedules();
  const cronJobs = useCronJobs();
  const limits = usePlanLimits();
  const usage = useUsage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settingsSite, setSettingsSite] = useState<Site | null>(null);
  const [deleteSiteState, setDeleteSiteState] = useState<Site | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(!sitesActions.isLoaded());

  // Add-site form state
  const [addForm, setAddForm] = useState({
    name: '',
    url: '',
    username: '',
    applicationPassword: '',
  });
  const [addError, setAddError] = useState('');

  // Load sites on mount (also triggered by DashboardLayout, but await the promise here)
  useEffect(() => {
    if (!sitesActions.isLoaded()) {
      sitesActions.loadSites(getToken).then(
        () => setInitialLoading(false),
        () => setInitialLoading(false),
      );
    } else {
      setInitialLoading(false);
    }
  }, [getToken]);

  // Load schedules & cron jobs so indicator dots can show
  useEffect(() => {
    if (!schedulesActions.isLoaded()) schedulesActions.loadSchedules(getToken);
    if (!cronJobsActions.isLoaded()) cronJobsActions.loadCronJobs(getToken);
  }, [getToken]);

  // Refresh relative times every 30s
  useEffect(() => {
    const interval = setInterval(() => sitesActions.refreshRelativeTimes(), 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleAddSite = async () => {
    if (!addForm.name.trim() || !addForm.url.trim() || !addForm.username.trim() || !addForm.applicationPassword.trim()) {
      setAddError(language === 'en' ? 'All fields are required.' : 'すべてのフィールドが必要です。');
      return;
    }
    try {
      await sitesActions.addSite(getToken, addForm);
      setAddForm({ name: '', url: '', username: '', applicationPassword: '' });
      setAddError('');
      setShowAddModal(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAddError(language === 'en' ? 'Site limit reached. Please upgrade your plan.' : 'サイト数の上限に達しました。プランをアップグレードしてください。');
      } else {
        setAddError(language === 'en' ? 'Failed to connect site. Please try again.' : 'サイトの接続に失敗しました。再度お試しください。');
      }
    }
  };

  const handleSync = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      await sitesActions.syncSite(getToken, id);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (deleteSiteState) {
      await sitesActions.deleteSite(getToken, deleteSiteState.id);
      setDeleteSiteState(null);
    }
  };

  const handleSaveSettings = async (settings: Partial<SiteSettingsType>) => {
    if (settingsSite) {
      await sitesActions.updateSettings(getToken, settingsSite.id, settings);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rakubun-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'WordPress Sites' : 'WordPressサイト'}
          </h2>
          <p className="text-xs sm:text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Manage your connected WordPress sites via Application Password.'
              : 'アプリケーションパスワードで接続されたWordPressサイトを管理。'}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm shrink-0 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          {language === 'en' ? 'Add Site' : 'サイト追加'}
        </button>
      </div>

      {/* Usage Meter */}
      <UsageMeter
        label={language === 'en' ? 'Sites' : 'サイト'}
        used={usage.sitesCount}
        limit={limits.maxSites}
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-rakubun-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
          {language === 'en' ? 'Cron Job' : 'クロンジョブ'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
          {language === 'en' ? 'Scheduler' : 'スケジューラー'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
          {language === 'en' ? 'Has Articles' : '記事あり'}
        </span>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.map((site) => {
          const statusCfg = statusConfig[site.status];
          const isSyncing = syncingIds.has(site.id);
          const hasCronJob = cronJobs.some((c) => c.siteId === site.id && c.status === 'active');
          const hasSchedule = schedules.some((s) => s.siteId === site.id && s.status === 'active');
          const hasArticles = site.articlesGenerated > 0;
          return (
            <div
              key={site.id}
              className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 group relative"
            >
              {/* Status indicator dots */}
              {(hasCronJob || hasSchedule || hasArticles) && (
                <TooltipProvider delayDuration={200}>
                  <div className="absolute top-3 right-14 flex items-center gap-1.5">
                    {hasCronJob && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 cursor-default">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {language === 'en' ? 'Active Cron Job' : 'クロンジョブ稼働中'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {hasSchedule && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 dark:bg-blue-500/20 cursor-default">
                            <span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {language === 'en' ? 'Active Schedule' : 'スケジュール稼働中'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {hasArticles && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 dark:bg-amber-500/20 cursor-default">
                            <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {language === 'en'
                            ? `${site.articlesGenerated} article${site.articlesGenerated !== 1 ? 's' : ''} generated`
                            : `${site.articlesGenerated}件の記事を生成済み`}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rakubun-bg-secondary flex items-center justify-center text-lg overflow-hidden">
                    {site.favicon.startsWith('http') ? (
                      <img
                        src={site.favicon}
                        alt={site.name}
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; e.currentTarget.parentElement!.textContent = '🌐'; }}
                      />
                    ) : (
                      site.favicon
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-rakubun-text">{site.name}</h3>
                    <a
                      href={`https://${site.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rakubun-text-secondary hover:text-rakubun-accent flex items-center gap-1 transition-colors"
                    >
                      {site.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <SiteCardMenu
                  site={site}
                  language={language}
                  onSync={() => handleSync(site.id)}
                  onSettings={() => setSettingsSite(site)}
                  onDelete={() => setDeleteSiteState(site)}
                />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`status-badge ${statusCfg.class}`}>
                  <statusCfg.icon className="w-3 h-3" />
                  <span>{statusCfg.label[language]}</span>
                </span>
                <span className="text-xs text-rakubun-text-secondary">
                  WP {site.wpVersion}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-rakubun-bg rounded-xl p-3">
                  <p className="text-lg font-heading font-bold text-rakubun-text">
                    {site.articlesGenerated}
                  </p>
                  <p className="text-xs text-rakubun-text-secondary">
                    {language === 'en' ? 'Generated' : '生成済み'}
                  </p>
                </div>
                <div className="bg-rakubun-bg rounded-xl p-3">
                  <p className="text-xs font-medium text-rakubun-text">{site.lastSync}</p>
                  <p className="text-xs text-rakubun-text-secondary">
                    {language === 'en' ? 'Last Sync' : '最終同期'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(site.id)}
                  disabled={isSyncing}
                  className="flex-1 btn-secondary text-xs py-2 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing
                    ? language === 'en' ? 'Syncing...' : '同期中...'
                    : language === 'en' ? 'Sync' : '同期'}
                </button>
                <button
                  onClick={() => setSettingsSite(site)}
                  className="flex-1 btn-secondary text-xs py-2"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Settings' : '設定'}
                </button>
                <button
                  onClick={() => setDeleteSiteState(site)}
                  className="p-2 rounded-xl border border-rakubun-border hover:border-red-200 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Google Analytics Connection */}
              <div className="mt-4 pt-4 border-t border-rakubun-border/40">
                <GoogleAnalyticsConnect 
                  siteId={site.id} 
                  siteName={site.name}
                  variant="compact"
                />
              </div>
            </div>
          );
        })}

        {/* Add Site Card */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-rakubun-surface rounded-2xl border-2 border-dashed border-rakubun-border p-5 flex flex-col items-center justify-center gap-3 min-h-[260px] hover:border-rakubun-accent/30 hover:bg-rakubun-accent/5 transition-all group"
        >
          <div className="p-3 rounded-2xl bg-rakubun-bg-secondary group-hover:bg-rakubun-accent/10 transition-colors">
            <Plus className="w-6 h-6 text-rakubun-text-secondary group-hover:text-rakubun-accent transition-colors" />
          </div>
          <div className="text-center">
            <p className="font-medium text-rakubun-text group-hover:text-rakubun-accent transition-colors">
              {language === 'en' ? 'Connect WordPress Site' : 'WordPressサイトを接続'}
            </p>
            <p className="text-xs text-rakubun-text-secondary mt-1">
              {language === 'en' ? 'Via Application Password' : 'アプリケーションパスワード経由'}
            </p>
          </div>
        </button>
      </div>

      {/* ─── Add Site Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-lg p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-rakubun-accent/10">
                <Link2 className="w-5 h-5 text-rakubun-accent" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-rakubun-text">
                  {language === 'en' ? 'Connect WordPress Site' : 'WordPressサイトを接続'}
                </h3>
                <p className="text-sm text-rakubun-text-secondary">
                  {language === 'en'
                    ? 'Use Application Password for secure connection.'
                    : 'アプリケーションパスワードで安全に接続。'}
                </p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
                {addError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Site Name' : 'サイト名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'My WordPress Blog' : 'マイWordPressブログ'}
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="rakubun-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'WordPress URL' : 'WordPress URL'}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={addForm.url}
                  onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                  className="rakubun-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Username' : 'ユーザー名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'WordPress username' : 'WordPressユーザー名'}
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  className="rakubun-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Application Password' : 'アプリケーションパスワード'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={addForm.applicationPassword}
                    onChange={(e) =>
                      setAddForm({ ...addForm, applicationPassword: e.target.value })
                    }
                    className="rakubun-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-rakubun-text-secondary mt-1.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {language === 'en'
                    ? 'Generate in WordPress → Users → Application Passwords'
                    : 'WordPress→ユーザー→アプリケーションパスワードで生成'}
                </p>
                <Link
                  to="/dashboard/docs"
                  className="text-xs text-rakubun-accent hover:underline mt-1 inline-flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  {language === 'en'
                    ? 'How to get an Application Password →'
                    : 'アプリケーションパスワードの取得方法 →'}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError('');
                }}
                className="flex-1 btn-secondary text-sm"
              >
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button onClick={handleAddSite} className="flex-1 btn-primary text-sm">
                <Link2 className="w-4 h-4" />
                {language === 'en' ? 'Connect Site' : 'サイト接続'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Settings Modal ─────────────────────────────────────── */}
      {settingsSite && (
        <SettingsModal
          site={settingsSite}
          language={language}
          onClose={() => setSettingsSite(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* ─── Delete Confirmation ────────────────────────────────── */}
      {deleteSiteState && (
        <DeleteModal
          site={deleteSiteState}
          language={language}
          onClose={() => setDeleteSiteState(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
