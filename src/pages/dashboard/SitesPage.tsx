import { useState } from 'react';
import {
  Globe,
  Plus,
  ExternalLink,
  Settings,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  MoreVertical,
  Copy,
  Eye,
  EyeOff,
  Link2,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const mockSites = [
  {
    id: '1',
    name: 'Tech Blog',
    url: 'techblog.com',
    status: 'connected' as const,
    articles: 24,
    lastSync: '2 min ago',
    wpVersion: '6.7',
    favicon: '🌐',
  },
  {
    id: '2',
    name: 'Dev Insights',
    url: 'devinsights.io',
    status: 'connected' as const,
    articles: 15,
    lastSync: '15 min ago',
    wpVersion: '6.6',
    favicon: '💻',
  },
  {
    id: '3',
    name: 'AI Weekly',
    url: 'aiweekly.net',
    status: 'warning' as const,
    articles: 8,
    lastSync: '2 hours ago',
    wpVersion: '6.5',
    favicon: '🤖',
  },
];

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

export default function SitesPage() {
  const { language } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4" />
          {language === 'en' ? 'Add Site' : 'サイト追加'}
        </button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockSites.map((site) => {
          const statusCfg = statusConfig[site.status];
          return (
            <div
              key={site.id}
              className="bg-white rounded-2xl border border-black/5 p-5 hover:shadow-md transition-all duration-300 group"
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
                <button className="p-1.5 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary opacity-0 group-hover:opacity-100 transition-all">
                  <MoreVertical className="w-4 h-4" />
                </button>
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
                  <p className="text-lg font-heading font-bold text-rakubun-text">{site.articles}</p>
                  <p className="text-xs text-rakubun-text-secondary">
                    {language === 'en' ? 'Articles' : '記事'}
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
                <button className="flex-1 btn-secondary text-xs py-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Sync' : '同期'}
                </button>
                <button className="flex-1 btn-secondary text-xs py-2">
                  <Settings className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Settings' : '設定'}
                </button>
                <button className="p-2 rounded-xl border border-black/10 hover:border-red-200 hover:bg-red-50 text-rakubun-text-secondary hover:text-red-500 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Site Card */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-white rounded-2xl border-2 border-dashed border-black/10 p-5 flex flex-col items-center justify-center gap-3 min-h-[260px] hover:border-rakubun-accent/30 hover:bg-rakubun-accent/5 transition-all group"
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

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Site Name' : 'サイト名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'My WordPress Blog' : 'マイWordPressブログ'}
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
                    className="rakubun-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 btn-secondary text-sm"
              >
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button className="flex-1 btn-primary text-sm">
                <Link2 className="w-4 h-4" />
                {language === 'en' ? 'Connect Site' : 'サイト接続'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
