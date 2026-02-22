import { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Globe,
  AlertTriangle,
  Sparkles,
  Mail,
  Trash2,
  Filter,
  MoreVertical,
  Settings,
  Info,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

type NotificationType = 'article' | 'site' | 'ai' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionUrl?: string;
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'article',
    title: 'Article Published Successfully',
    message: '"10 Best Practices for React Performance" has been published on techblog.com',
    time: '2 hours ago',
    read: false,
  },
  {
    id: '2',
    type: 'ai',
    title: 'AI Generation Complete',
    message: 'Your article "Web Performance Optimization Guide" has been generated and is ready for review.',
    time: '3 hours ago',
    read: false,
  },
  {
    id: '3',
    type: 'site',
    title: 'Site Connection Warning',
    message: 'aiweekly.net has not synced in over 2 hours. Please check the connection.',
    time: '4 hours ago',
    read: false,
  },
  {
    id: '4',
    type: 'system',
    title: 'Scheduled Maintenance',
    message: 'System maintenance is scheduled for Feb 25, 2026 from 2:00-4:00 AM UTC.',
    time: '1 day ago',
    read: true,
  },
  {
    id: '5',
    type: 'article',
    title: 'Article Scheduled',
    message: '"Getting Started with TypeScript" is scheduled to publish tomorrow at 9:00 AM.',
    time: '1 day ago',
    read: true,
  },
  {
    id: '6',
    type: 'ai',
    title: 'Analysis Report Ready',
    message: 'Site analysis for devinsights.io is complete. SEO score improved to 79.',
    time: '2 days ago',
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
        <div className="p-2.5 rounded-xl bg-white/80">
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
                ? 'bg-white text-rakubun-text shadow-sm'
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
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
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
                  bg-white rounded-2xl border border-black/5 p-4 flex items-start gap-4
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
                      {notification.title}
                    </h4>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-rakubun-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-rakubun-text-secondary mt-0.5">
                    {notification.message}
                  </p>
                  <span className="text-xs text-rakubun-text-secondary/60 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {notification.time}
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
