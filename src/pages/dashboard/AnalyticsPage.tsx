import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  FileText,
  CalendarDays,
  Download,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const overviewStats = [
  {
    label: { en: 'Total Views', ja: '総ビュー' },
    value: '24.8K',
    change: '+18%',
    trend: 'up' as const,
    icon: Eye,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    label: { en: 'Unique Visitors', ja: 'ユニーク訪問者' },
    value: '8.2K',
    change: '+12%',
    trend: 'up' as const,
    icon: Users,
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    label: { en: 'Avg. Read Time', ja: '平均読了時間' },
    value: '4:32',
    change: '+0:15',
    trend: 'up' as const,
    icon: Clock,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    label: { en: 'Bounce Rate', ja: '直帰率' },
    value: '34%',
    change: '-3%',
    trend: 'down' as const,
    icon: TrendingDown,
    color: 'text-amber-600 bg-amber-50',
  },
];

const topArticles = [
  { title: 'AI Tools for Content Creators', views: '3.2K', site: 'aiweekly.net', change: '+45%' },
  { title: '10 Best Practices for React Performance', views: '2.8K', site: 'techblog.com', change: '+22%' },
  { title: 'TypeScript Advanced Patterns', views: '2.1K', site: 'devinsights.io', change: '+18%' },
  { title: 'Modern CSS Layout Guide', views: '1.9K', site: 'techblog.com', change: '+12%' },
  { title: 'Web Performance 101', views: '1.5K', site: 'devinsights.io', change: '+8%' },
];

const sitePerformance = [
  { site: 'techblog.com', views: '12.4K', articles: 24, avgSeo: 86, trend: 'up' as const },
  { site: 'devinsights.io', views: '8.1K', articles: 15, avgSeo: 79, trend: 'up' as const },
  { site: 'aiweekly.net', views: '4.3K', articles: 8, avgSeo: 82, trend: 'up' as const },
];

// Mock chart data - bars representation
const chartData = [
  { day: 'Mon', value: 320 },
  { day: 'Tue', value: 480 },
  { day: 'Wed', value: 390 },
  { day: 'Thu', value: 520 },
  { day: 'Fri', value: 610 },
  { day: 'Sat', value: 280 },
  { day: 'Sun', value: 190 },
];

const chartDataJa = [
  { day: '月', value: 320 },
  { day: '火', value: 480 },
  { day: '水', value: 390 },
  { day: '木', value: 520 },
  { day: '金', value: 610 },
  { day: '土', value: 280 },
  { day: '日', value: 190 },
];

const maxValue = Math.max(...chartData.map(d => d.value));

export default function AnalyticsPage() {
  const { language } = useLanguage();
  const [timeRange, setTimeRange] = useState('7d');
  const data = language === 'en' ? chartData : chartDataJa;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Analytics' : 'アナリティクス'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Track your content performance across all connected sites.'
              : 'すべての接続サイトのコンテンツパフォーマンスを追跡。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1">
            {[
              { value: '7d', label: { en: '7D', ja: '7日' } },
              { value: '30d', label: { en: '30D', ja: '30日' } },
              { value: '90d', label: { en: '90D', ja: '90日' } },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeRange === range.value
                    ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                {range.label[language]}
              </button>
            ))}
          </div>
          <button className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            {language === 'en' ? 'Export' : 'エクスポート'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewStats.map((stat) => (
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
        {/* Chart */}
        <div className="lg:col-span-2 bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading font-semibold text-rakubun-text">
              {language === 'en' ? 'Views This Week' : '今週のビュー'}
            </h3>
            <span className="text-xs text-rakubun-text-secondary flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Feb 16 – Feb 22, 2026
            </span>
          </div>
          {/* Simple Bar Chart */}
          <div className="flex items-end gap-3 h-48">
            {data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-rakubun-text tabular-nums">{d.value}</span>
                <div
                  className="w-full rounded-t-lg bg-rakubun-accent/80 hover:bg-rakubun-accent transition-colors cursor-pointer"
                  style={{ height: `${(d.value / maxValue) * 160}px` }}
                />
                <span className="text-xs text-rakubun-text-secondary">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Articles */}
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
          <div className="px-5 py-4 border-b border-rakubun-border">
            <h3 className="font-heading font-semibold text-rakubun-text">
              {language === 'en' ? 'Top Articles' : '人気記事'}
            </h3>
          </div>
          <div className="divide-y divide-black/5">
            {topArticles.map((article, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3 hover:bg-rakubun-bg/50 transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-rakubun-text-secondary w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-rakubun-text truncate">{article.title}</p>
                  <p className="text-xs text-rakubun-text-secondary">{article.site}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-rakubun-text">{article.views}</p>
                  <p className="text-xs text-emerald-600">{article.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Site Performance */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
        <div className="px-5 py-4 border-b border-rakubun-border">
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Site Performance' : 'サイトパフォーマンス'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rakubun-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                  {language === 'en' ? 'Site' : 'サイト'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                  {language === 'en' ? 'Views' : 'ビュー'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                  {language === 'en' ? 'Articles' : '記事数'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                  {language === 'en' ? 'Avg SEO' : '平均SEO'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                  {language === 'en' ? 'Trend' : 'トレンド'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sitePerformance.map((site) => (
                <tr key={site.site} className="hover:bg-rakubun-bg/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-rakubun-text-secondary" />
                      <span className="text-sm font-medium text-rakubun-text">{site.site}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-rakubun-text">{site.views}</td>
                  <td className="px-5 py-3.5 text-sm text-rakubun-text">{site.articles}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-semibold ${
                      site.avgSeo >= 80 ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {site.avgSeo}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      {language === 'en' ? 'Growing' : '成長中'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
