import { useState, useEffect, useRef } from 'react';
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
  const [settings, setSettings] = useState<SiteSettingsType>({ ...site.settings });

  const save = () => {
    onSave(settings);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
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

        <div className="space-y-5">
          {/* Auto Sync */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-rakubun-text">
                {language === 'en' ? 'Auto Sync' : '自動同期'}
              </p>
              <p className="text-xs text-rakubun-text-secondary">
                {language === 'en'
                  ? 'Automatically sync content at intervals'
                  : 'コンテンツを定期的に自動同期'}
              </p>
            </div>
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
          </div>

          {/* Sync Interval */}
          {settings.autoSync && (
            <div>
              <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                {language === 'en' ? 'Sync Interval (minutes)' : '同期間隔（分）'}
              </label>
              <select
                value={settings.syncInterval}
                onChange={(e) =>
                  setSettings({ ...settings, syncInterval: Number(e.target.value) })
                }
                className="rakubun-input"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
                <option value={120}>120</option>
              </select>
            </div>
          )}

          {/* Default Status */}
          <div>
            <label className="block text-sm font-medium text-rakubun-text mb-1.5">
              {language === 'en' ? 'Default Post Status' : 'デフォルト投稿ステータス'}
            </label>
            <select
              value={settings.defaultStatus}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultStatus: e.target.value as 'draft' | 'publish' | 'pending',
                })
              }
              className="rakubun-input"
            >
              <option value="draft">{language === 'en' ? 'Draft' : '下書き'}</option>
              <option value="publish">{language === 'en' ? 'Published' : '公開'}</option>
              <option value="pending">{language === 'en' ? 'Pending Review' : 'レビュー待ち'}</option>
            </select>
          </div>

          {/* Default Category */}
          <div>
            <label className="block text-sm font-medium text-rakubun-text mb-1.5">
              {language === 'en' ? 'Default Category' : 'デフォルトカテゴリ'}
            </label>
            <input
              type="text"
              value={settings.defaultCategory}
              onChange={(e) => setSettings({ ...settings, defaultCategory: e.target.value })}
              className="rakubun-input"
            />
          </div>

          {/* Auto Images */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-rakubun-text">
                {language === 'en' ? 'Auto Images' : '自動画像'}
              </p>
              <p className="text-xs text-rakubun-text-secondary">
                {language === 'en'
                  ? 'Automatically generate featured images'
                  : 'アイキャッチ画像を自動生成'}
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoImages: !settings.autoImages })}
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
          </div>

          {/* SEO Optimization */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-rakubun-text">
                {language === 'en' ? 'SEO Optimization' : 'SEO最適化'}
              </p>
              <p className="text-xs text-rakubun-text-secondary">
                {language === 'en'
                  ? 'Auto-generate meta tags and optimize content'
                  : 'メタタグを自動生成しコンテンツを最適化'}
              </p>
            </div>
            <button
              onClick={() =>
                setSettings({ ...settings, seoOptimization: !settings.seoOptimization })
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
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-rakubun-text mb-1.5">
              {language === 'en' ? 'Content Language' : 'コンテンツ言語'}
            </label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="rakubun-input"
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-rakubun-text mb-1.5">
              {language === 'en' ? 'Timezone' : 'タイムゾーン'}
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="rakubun-input"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm">
            {language === 'en' ? 'Cancel' : 'キャンセル'}
          </button>
          <button onClick={save} className="flex-1 btn-primary text-sm">
            {language === 'en' ? 'Save Settings' : '設定を保存'}
          </button>
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

  // Load sites on mount
  useEffect(() => {
    if (!sitesActions.isLoaded()) {
      sitesActions.loadSites(getToken).finally(() => setInitialLoading(false));
    }
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
    } catch {
      setAddError(language === 'en' ? 'Failed to connect site. Please try again.' : 'サイトの接続に失敗しました。再度お試しください。');
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'WordPress Sites' : 'WordPressサイト'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Manage your connected WordPress sites via Application Password.'
              : 'アプリケーションパスワードで接続されたWordPressサイトを管理。'}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          {language === 'en' ? 'Add Site' : 'サイト追加'}
        </button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.map((site) => {
          const statusCfg = statusConfig[site.status];
          const isSyncing = syncingIds.has(site.id);
          return (
            <div
              key={site.id}
              className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rakubun-bg-secondary flex items-center justify-center text-lg">
                    {site.favicon}
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
