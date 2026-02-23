import { useState } from 'react';
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
} from 'lucide-react';
import { useLanguage } from '../../i18n';

type NotificationType = 'article' | 'site' | 'ai' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: { en: string; ja: string };
  message: { en: string; ja: string };
  time: { en: string; ja: string };
  read: boolean;
  actionUrl?: string;
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'article',
    title: { en: 'Article Published Successfully', ja: '記事が正常に公開されました' },
    message: { en: '"10 Best Practices for React Performance" has been published on techblog.com', ja: '「Reactパフォーマンスのベストプラクティス10選」がtechblog.comに公開されました' },
    time: { en: '2 hours ago', ja: '2時間前' },
    read: false,
  },
  {
    id: '2',
    type: 'ai',
    title: { en: 'AI Generation Complete', ja: 'AI生成完了' },
    message: { en: 'Your article "Web Performance Optimization Guide" has been generated and is ready for review.', ja: '記事「Webパフォーマンス最適化ガイド」が生成され、レビュー準備が整いました。' },
    time: { en: '3 hours ago', ja: '3時間前' },
    read: false,
  },
  {
    id: '3',
    type: 'site',
    title: { en: 'Site Connection Warning', ja: 'サイト接続警告' },
    message: { en: 'aiweekly.net has not synced in over 2 hours. Please check the connection.', ja: 'aiweekly.netが2時間以上同期されていません。接続を確認してください。' },
    time: { en: '4 hours ago', ja: '4時間前' },
    read: false,
  },
  {
    id: '4',
    type: 'system',
    title: { en: 'Scheduled Maintenance', ja: '定期メンテナンス' },
    message: { en: 'System maintenance is scheduled for Feb 25, 2026 from 2:00-4:00 AM UTC.', ja: 'システムメンテナンスが2026年2月25日 UTC 2:00〜4:00に予定されています。' },
    time: { en: '1 day ago', ja: '1日前' },
    read: true,
  },
  {
    id: '5',
    type: 'article',
    title: { en: 'Article Scheduled', ja: '記事が予約されました' },
    message: { en: '"Getting Started with TypeScript" is scheduled to publish tomorrow at 9:00 AM.', ja: '「TypeScript入門」が明日午前9時に公開予定です。' },
    time: { en: '1 day ago', ja: '1日前' },
    read: true,
  },
  {
    id: '6',
    type: 'ai',
    title: { en: 'Analysis Report Ready', ja: '分析レポート完了' },
    message: { en: 'Site analysis for devinsights.io is complete. SEO score improved to 79.', ja: 'devinsights.ioのサイト分析が完了しました。SEOスコアが79に改善。' },
    time: { en: '2 days ago', ja: '2日前' },
    read: true,
  },
];

const typeConfig = {
  article: { icon: FileText, color: 'text-blue-600 bg-blue-50' },
  site: { icon: Globe, color: 'text-amber-600 bg-amber-50' },
  ai: { icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  system: { icon: Info, color: 'text-gray-600 bg-gray-50' },
};

const filterOptions = [
  { value: 'all', label: { en: 'All', ja: '全て' } },
  { value: 'unread', label: { en: 'Unread', ja: '未読' } },
  { value: 'article', label: { en: 'Articles', ja: '記事' } },
  { value: 'ai', label: { en: 'AI', ja: 'AI' } },
  { value: 'site', label: { en: 'Sites', ja: 'サイト' } },
  { value: 'system', label: { en: 'System', ja: 'システム' } },
];

export default function NotificationsPage() {
  const { language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('all');
  const [readItems, setReadItems] = useState<Set<string>>(
    new Set(notifications.filter(n => n.read).map(n => n.id))
  );

  const markRead = (id: string) => {
    setReadItems(prev => new Set([...prev, id]));
  };

  const markAllRead = () => {
    setReadItems(new Set(notifications.map(n => n.id)));
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'unread') return !readItems.has(n.id);
    if (activeFilter !== 'all') return n.type === activeFilter;
    return true;
  });

  const unreadCount = notifications.filter(n => !readItems.has(n.id)).length;

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="btn-secondary text-sm"
            disabled={unreadCount === 0}
          >
            <CheckCheck className="w-4 h-4" />
            {language === 'en' ? 'Mark All Read' : '全て既読'}
          </button>
          <button className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Email Notification Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100 p-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-rakubun-surface/80">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-rakubun-text">
            {language === 'en' ? 'Email Notifications' : 'メール通知'}
          </p>
          <p className="text-xs text-rakubun-text-secondary">
            {language === 'en'
              ? 'Get important updates delivered to your inbox.'
              : '重要な更新をメールで受け取る。'}
          </p>
        </div>
        <button className="btn-secondary text-xs py-1.5">
          {language === 'en' ? 'Configure' : '設定'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1 w-fit">
        {filterOptions.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
        {filteredNotifications.length === 0 ? (
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 text-center">
            <Bell className="w-8 h-8 text-rakubun-text-secondary mx-auto mb-3 opacity-40" />
            <p className="text-sm text-rakubun-text-secondary">
              {language === 'en' ? 'No notifications to show.' : '表示する通知はありません。'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isUnread = !readItems.has(notification.id);
            const config = typeConfig[notification.type];
            return (
              <div
                key={notification.id}
                onClick={() => markRead(notification.id)}
                className={`
                  bg-rakubun-surface rounded-2xl border border-rakubun-border p-4 flex items-start gap-4
                  hover:shadow-md transition-all duration-300 cursor-pointer group
                  ${isUnread ? 'border-l-4 border-l-rakubun-accent' : ''}
                `}
              >
                <div className={`p-2 rounded-xl ${config.color} shrink-0`}>
                  <config.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-medium ${isUnread ? 'text-rakubun-text' : 'text-rakubun-text-secondary'}`}>
                      {notification.title[language]}
                    </h4>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-rakubun-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {notification.message[language]}
                  </p>
                  <span className="text-xs text-rakubun-text-secondary/60 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {notification.time[language]}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-rakubun-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
