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
  Globe,
  Palette,
  Database,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

interface ApiKey {
  id: string;
  name: string;
  service: string;
  maskedKey: string;
  status: 'active' | 'expired' | 'invalid';
  lastUsed: string;
}

const apiKeys: ApiKey[] = [
  { id: '1', name: 'OpenAI API Key', service: 'OpenAI', maskedKey: 'sk-...a4Xb', status: 'active', lastUsed: '2 min ago' },
  { id: '2', name: 'Anthropic API Key', service: 'Claude', maskedKey: 'sk-ant-...9fG2', status: 'active', lastUsed: '1 hour ago' },
  { id: '3', name: 'Perplexity API Key', service: 'Perplexity', maskedKey: 'pplx-...mK8s', status: 'active', lastUsed: '3 hours ago' },
  { id: '4', name: 'Resend API Key', service: 'Resend', maskedKey: 're_...Jd4n', status: 'active', lastUsed: '1 day ago' },
  { id: '5', name: 'GrokImaging Key', service: 'GrokImaging', maskedKey: 'grok-...pQ7x', status: 'expired', lastUsed: '30 days ago' },
];

const settingsTabs = [
  { id: 'api-keys', label: { en: 'API Keys', ja: 'APIキー' }, icon: Key },
  { id: 'profile', label: { en: 'Profile', ja: 'プロフィール' }, icon: User },
  { id: 'notifications', label: { en: 'Notifications', ja: '通知設定' }, icon: Bell },
  { id: 'general', label: { en: 'General', ja: '一般' }, icon: Settings },
];

const statusConfig = {
  active: { label: { en: 'Active', ja: '有効' }, class: 'status-badge-success', icon: CheckCircle2 },
  expired: { label: { en: 'Expired', ja: '期限切れ' }, class: 'status-badge-error', icon: AlertTriangle },
  invalid: { label: { en: 'Invalid', ja: '無効' }, class: 'status-badge-error', icon: AlertTriangle },
};

export default function SettingsPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('api-keys');
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [showKey, setShowKey] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <h2 className="text-xl font-heading font-bold text-rakubun-text">
          {language === 'en' ? 'Settings' : '設定'}
        </h2>
        <p className="text-sm text-rakubun-text-secondary mt-1">
          {language === 'en'
            ? 'Manage your account, API keys, and preferences.'
            : 'アカウント、APIキー、設定の管理。'}
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
          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {language === 'en' ? 'API Keys' : 'APIキー'}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {language === 'en'
                      ? 'Manage API keys for AI services, email, and integrations.'
                      : 'AIサービス、メール、統合のAPIキーを管理。'}
                  </p>
                </div>
                <button onClick={() => setShowAddKeyModal(true)} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" />
                  {language === 'en' ? 'Add Key' : 'キー追加'}
                </button>
              </div>

              {/* Security Notice */}
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {language === 'en' ? 'Your keys are encrypted' : 'キーは暗号化されています'}
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {language === 'en'
                      ? 'All API keys are encrypted at rest and never exposed in logs or responses.'
                      : 'すべてのAPIキーは保存時に暗号化され、ログやレスポンスに露出しません。'}
                  </p>
                </div>
              </div>

              {/* Keys List */}
              <div className="space-y-3">
                {apiKeys.map((key) => {
                  const statusCfg = statusConfig[key.status];
                  return (
                    <div
                      key={key.id}
                      className="bg-white rounded-2xl border border-black/5 p-4 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-rakubun-bg-secondary shrink-0">
                          <Key className="w-4 h-4 text-rakubun-text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-rakubun-text">{key.name}</h4>
                            <span className={`status-badge ${statusCfg.class}`}>
                              <statusCfg.icon className="w-3 h-3" />
                              <span>{statusCfg.label[language]}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <code className="text-xs text-rakubun-text-secondary font-mono bg-rakubun-bg px-2 py-0.5 rounded">
                              {showKey.has(key.id) ? 'sk-full-key-displayed-here' : key.maskedKey}
                            </code>
                            <span className="text-xs text-rakubun-text-secondary">
                              {language === 'en' ? `Last used: ${key.lastUsed}` : `最終使用: ${key.lastUsed}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleShowKey(key.id)}
                            className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                            title={showKey.has(key.id) ? 'Hide' : 'Show'}
                          >
                            {showKey.has(key.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleCopy(key.id)}
                            className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                          >
                            {copiedKey === key.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button className="p-2 rounded-lg hover:bg-red-50 text-rakubun-text-secondary hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Profile' : 'プロフィール'}
              </h3>
              <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-6">
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

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Notification Preferences' : '通知設定'}
              </h3>
              <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-5">
                {[
                  { label: { en: 'Article published', ja: '記事公開時' }, email: true, inApp: true },
                  { label: { en: 'AI generation complete', ja: 'AI生成完了時' }, email: false, inApp: true },
                  { label: { en: 'Site connection issues', ja: 'サイト接続問題時' }, email: true, inApp: true },
                  { label: { en: 'Scheduled article reminders', ja: '予約記事リマインダー' }, email: true, inApp: true },
                  { label: { en: 'Weekly analytics report', ja: '週間アナリティクスレポート' }, email: true, inApp: false },
                  { label: { en: 'System updates', ja: 'システムアップデート' }, email: false, inApp: true },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
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

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'General Settings' : '一般設定'}
              </h3>
              <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-5">
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
                <div className="pt-4 border-t border-black/5">
                  <h4 className="text-sm font-medium text-red-600 mb-2">
                    {language === 'en' ? 'Danger Zone' : '危険ゾーン'}
                  </h4>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    {language === 'en' ? 'Delete Account' : 'アカウント削除'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Key Modal */}
      {showAddKeyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddKeyModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-rakubun-accent/10">
                <Key className="w-5 h-5 text-rakubun-accent" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-rakubun-text">
                  {language === 'en' ? 'Add API Key' : 'APIキーを追加'}
                </h3>
                <p className="text-sm text-rakubun-text-secondary">
                  {language === 'en'
                    ? 'Add a new API key for an integration.'
                    : '統合用の新しいAPIキーを追加。'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Service' : 'サービス'}
                </label>
                <select className="rakubun-input">
                  <option>OpenAI</option>
                  <option>Anthropic (Claude)</option>
                  <option>Perplexity</option>
                  <option>Brave Search</option>
                  <option>Resend</option>
                  <option>GrokImaging</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'Key Name' : 'キー名'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. Production OpenAI Key' : '例: 本番用OpenAIキー'}
                  className="rakubun-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-rakubun-text mb-1.5">
                  {language === 'en' ? 'API Key' : 'APIキー'}
                </label>
                <input
                  type="password"
                  placeholder={language === 'en' ? 'Paste your API key here' : 'APIキーをここに貼り付け'}
                  className="rakubun-input font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => setShowAddKeyModal(false)} className="flex-1 btn-secondary text-sm">
                {language === 'en' ? 'Cancel' : 'キャンセル'}
              </button>
              <button className="flex-1 btn-primary text-sm">
                <Key className="w-4 h-4" />
                {language === 'en' ? 'Add Key' : 'キー追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
