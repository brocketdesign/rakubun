import {
  Globe,
  FileText,
  Eye,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Plus,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useNavigate } from 'react-router-dom';

const stats = [
  {
    label: { en: 'Connected Sites', ja: '接続サイト' },
    value: '3',
    change: '+1',
    trend: 'up' as const,
    icon: Globe,
    color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  },
  {
    label: { en: 'Total Articles', ja: '記事数' },
    value: '47',
    change: '+12',
    trend: 'up' as const,
    icon: FileText,
    color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
  {
    label: { en: 'Monthly Views', ja: '月間ビュー' },
    value: '12.4K',
    change: '+23%',
    trend: 'up' as const,
    icon: Eye,
    color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
  },
  {
    label: { en: 'SEO Score', ja: 'SEOスコア' },
    value: '84',
    change: '+5',
    trend: 'up' as const,
    icon: TrendingUp,
    color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  },
];

const recentArticles = [
  {
    title: '10 Best Practices for React Performance',
    site: 'techblog.com',
    status: 'published' as const,
    date: '2 hours ago',
    views: '234',
  },
  {
    title: 'Getting Started with TypeScript in 2026',
    site: 'devinsights.io',
    status: 'scheduled' as const,
    date: 'Tomorrow, 9:00 AM',
    views: '-',
  },
  {
    title: 'Understanding Modern CSS Layout',
    site: 'techblog.com',
    status: 'draft' as const,
    date: '1 day ago',
    views: '-',
  },
  {
    title: 'AI Tools for Content Creators',
    site: 'aiweekly.net',
    status: 'published' as const,
    date: '3 days ago',
    views: '1.2K',
  },
  {
    title: 'Web Performance Optimization Guide',
    site: 'devinsights.io',
    status: 'generating' as const,
    date: 'Just now',
    views: '-',
  },
];

const quickActions = [
  { label: { en: 'New Article', ja: '新しい記事' }, icon: Plus, path: '/dashboard/articles?new=true', color: 'bg-rakubun-accent text-white' },
  { label: { en: 'Run Analysis', ja: '分析を実行' }, icon: Sparkles, path: '/dashboard/analysis', color: 'bg-purple-600 text-white' },
  { label: { en: 'Add Site', ja: 'サイト追加' }, icon: Globe, path: '/dashboard/sites', color: 'bg-emerald-600 text-white' },
  { label: { en: 'Schedule', ja: 'スケジュール' }, icon: Calendar, path: '/dashboard/scheduler', color: 'bg-amber-600 text-white' },
];

const upcomingSchedule = [
  { title: 'SEO Guide for Beginners', time: 'Today, 5:00 PM', site: 'techblog.com' },
  { title: 'React 20 Preview', time: 'Tomorrow, 9:00 AM', site: 'devinsights.io' },
  { title: 'AI in Healthcare 2026', time: 'Feb 24, 2:00 PM', site: 'aiweekly.net' },
];

const statusConfig = {
  published: { label: { en: 'Published', ja: '公開済み' }, class: 'status-badge-success', icon: CheckCircle2 },
  scheduled: { label: { en: 'Scheduled', ja: '予約済み' }, class: 'status-badge-warning', icon: Clock },
  draft: { label: { en: 'Draft', ja: '下書き' }, class: 'text-gray-700 bg-gray-50 dark:text-gray-300 dark:bg-gray-500/10', icon: FileText },
  generating: { label: { en: 'Generating', ja: '生成中' }, class: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10', icon: Loader2 },
};

export default function OverviewPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-rakubun-accent to-blue-400 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-heading font-bold">
          {language === 'en' ? 'Welcome back!' : 'おかえりなさい！'}
        </h2>
        <p className="mt-1 text-white/80 text-sm">
          {language === 'en'
            ? 'Here\'s what\'s happening with your sites today.'
            : '今日のサイトの状況です。'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label.en}
            className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                stat.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-heading font-bold text-rakubun-text">{stat.value}</p>
            <p className="text-xs text-rakubun-text-secondary mt-0.5">{stat.label[language]}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Articles */}
        <div className="lg:col-span-2 bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-rakubun-border">
            <h3 className="font-heading font-semibold text-rakubun-text">
              {language === 'en' ? 'Recent Articles' : '最近の記事'}
            </h3>
            <button
              onClick={() => navigate('/dashboard/articles')}
              className="text-xs text-rakubun-accent font-medium hover:underline flex items-center gap-1"
            >
              {language === 'en' ? 'View All' : 'すべて見る'}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {recentArticles.map((article, i) => {
              const statusCfg = statusConfig[article.status];
              return (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-rakubun-bg/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-rakubun-text truncate">{article.title}</p>
                    <p className="text-xs text-rakubun-text-secondary mt-0.5">
                      {article.site} · {article.date}
                    </p>
                  </div>
                  <div className={`status-badge ${statusCfg.class} shrink-0`}>
                    {article.status === 'generating' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <statusCfg.icon className="w-3 h-3" />
                    )}
                    <span>{statusCfg.label[language]}</span>
                  </div>
                  {article.views !== '-' && (
                    <span className="text-xs text-rakubun-text-secondary tabular-nums shrink-0 w-12 text-right">
                      {article.views} <Eye className="w-3 h-3 inline" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
            <h3 className="font-heading font-semibold text-rakubun-text mb-3">
              {language === 'en' ? 'Quick Actions' : 'クイックアクション'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label.en}
                  onClick={() => navigate(action.path)}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-medium
                    ${action.color} hover:opacity-90 transition-all duration-200
                    hover:-translate-y-0.5 hover:shadow-md
                  `}
                >
                  <action.icon className="w-5 h-5" />
                  <span>{action.label[language]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Schedule */}
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'Upcoming' : '予定'}
              </h3>
              <button
                onClick={() => navigate('/dashboard/scheduler')}
                className="text-xs text-rakubun-accent font-medium hover:underline flex items-center gap-1"
              >
                {language === 'en' ? 'Calendar' : 'カレンダー'}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
              {upcomingSchedule.map((item, i) => (
                <div key={i} className="flex items-start gap-3 group cursor-pointer">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-rakubun-bg-secondary text-rakubun-text-secondary group-hover:bg-rakubun-accent/10 group-hover:text-rakubun-accent transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-rakubun-text truncate group-hover:text-rakubun-accent transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-rakubun-text-secondary">
                      {item.time} · {item.site}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Activity */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 rounded-2xl border border-purple-100 dark:border-purple-500/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-heading font-semibold text-rakubun-text">
                {language === 'en' ? 'AI Activity' : 'AIアクティビティ'}
              </h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-rakubun-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{language === 'en' ? 'Generating article...' : '記事生成中...'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-rakubun-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>{language === 'en' ? 'Analysis completed for techblog.com' : 'techblog.comの分析完了'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-rakubun-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{language === 'en' ? '2 research tasks queued' : 'リサーチタスク2件待機中'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
