import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Clock,
  FileText,
  Globe,
  Sparkles,
  Mail,
  Trash2,
  Settings,
  Info,
  CalendarDays,
  Loader2,
  RefreshCw,
  MailCheck,
  MailX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../i18n';
import {
  useNotifications,
  useUnreadCount,
  useNotificationsLoading,
  notificationsActions,
  type NotificationType,
} from '../../stores/notificationsStore';

// ─── Type styling ───────────────────────────────────────────────────────────────

const typeConfig: Record<NotificationType, { icon: typeof FileText; color: string }> = {
  article: { icon: FileText, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10' },
  site: { icon: Globe, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10' },
  ai: { icon: Sparkles, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10' },
  system: { icon: Info, color: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-500/10' },
  schedule: { icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' },
};

const filterOptions: { value: string; label: { en: string; ja: string } }[] = [
  { value: 'all', label: { en: 'All', ja: '全て' } },
  { value: 'unread', label: { en: 'Unread', ja: '未読' } },
  { value: 'article', label: { en: 'Articles', ja: '記事' } },
  { value: 'ai', label: { en: 'AI', ja: 'AI' } },
  { value: 'site', label: { en: 'Sites', ja: 'サイト' } },
  { value: 'schedule', label: { en: 'Schedule', ja: 'スケジュール' } },
  { value: 'system', label: { en: 'System', ja: 'システム' } },
];

// ─── Relative time helper ───────────────────────────────────────────────────────

function relativeTime(ts: number, lang: 'en' | 'ja'): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (lang === 'ja') {
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(ts).toLocaleDateString('ja-JP');
  }

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const unreadCount = useUnreadCount();
  const loading = useNotificationsLoading();
  const [activeFilter, setActiveFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load notifications on mount & filter change
  const load = useCallback(() => {
    notificationsActions.loadNotifications(getToken, activeFilter);
  }, [getToken, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    await notificationsActions.markRead(getToken, id);
  };

  const handleMarkAllRead = async () => {
    await notificationsActions.markAllRead(getToken);
    toast.success(language === 'en' ? 'All notifications marked as read' : '全て既読にしました');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting(id);
    await notificationsActions.deleteNotification(getToken, id);
    toast.success(language === 'en' ? 'Notification deleted' : '通知を削除しました');
    setDeleting(null);
  };

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    handleMarkRead(notification.id);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text flex items-center gap-2">
            {language === 'en' ? 'Notifications' : '通知'}
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Stay updated on your content pipeline and site status.'
              : 'コンテンツパイプラインとサイトの状況を確認。'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
            title={language === 'en' ? 'Refresh' : '更新'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary text-sm"
            disabled={unreadCount === 0}
          >
            <CheckCheck className="w-4 h-4" />
            {language === 'en' ? 'Mark All Read' : '全て既読'}
          </button>
          <button
            onClick={() => navigate('/dashboard/settings?tab=notifications')}
            className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Email Notification Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20 p-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-rakubun-surface/80">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-rakubun-text">
            {language === 'en' ? 'Email Notifications' : 'メール通知'}
          </p>
          <p className="text-xs text-rakubun-text-secondary">
            {language === 'en'
              ? 'Get important updates delivered to your inbox via rakubun.com.'
              : '重要な更新をrakubun.comからメールで受け取る。'}
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/settings?tab=notifications')}
          className="btn-secondary text-xs py-1.5"
        >
          {language === 'en' ? 'Configure' : '設定'}
        </button>
      </div>

      {/* Notification Preferences Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
            <Bell className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-lg font-heading font-bold text-rakubun-text">{unreadCount}</p>
            <p className="text-xs text-rakubun-text-secondary">
              {language === 'en' ? 'Unread' : '未読'}
            </p>
          </div>
        </div>
        <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
            <MailCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-heading font-bold text-rakubun-text">
              {notifications.filter((n) => n.read).length}
            </p>
            <p className="text-xs text-rakubun-text-secondary">
              {language === 'en' ? 'Read' : '既読'}
            </p>
          </div>
        </div>
        <div className="bg-rakubun-surface rounded-xl border border-rakubun-border p-3 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-500/10">
            <MailX className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-lg font-heading font-bold text-rakubun-text">
              {notifications.length}
            </p>
            <p className="text-xs text-rakubun-text-secondary">
              {language === 'en' ? 'Total' : '合計'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1 w-fit overflow-x-auto">
        {filterOptions.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === filter.value
                ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                : 'text-rakubun-text-secondary hover:text-rakubun-text'
            }`}
          >
            {filter.label[language]}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {loading && notifications.length === 0 ? (
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 text-center">
            <Bell className="w-8 h-8 text-rakubun-text-secondary mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-rakubun-text">
              {language === 'en' ? 'No notifications' : '通知はありません'}
            </p>
            <p className="text-xs text-rakubun-text-secondary mt-1">
              {language === 'en'
                ? "You're all caught up! We'll notify you when something happens."
                : '全て確認済みです。何か起きたらお知らせします。'}
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = typeConfig[notification.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`
                  bg-rakubun-surface rounded-2xl border border-rakubun-border p-4 flex items-start gap-4
                  hover:shadow-md transition-all duration-300 cursor-pointer group
                  ${!notification.read ? 'border-l-4 border-l-rakubun-accent' : ''}
                `}
              >
                <div className={`p-2 rounded-xl ${config.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm font-medium ${
                        !notification.read ? 'text-rakubun-text' : 'text-rakubun-text-secondary'
                      }`}
                    >
                      {notification.title[language]}
                    </h4>
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-rakubun-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {notification.message[language]}
                  </p>
                  <span className="text-xs text-rakubun-text-secondary/60 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {relativeTime(notification.createdAt, language)}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, notification.id)}
                  disabled={deleting === notification.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  {deleting === notification.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
