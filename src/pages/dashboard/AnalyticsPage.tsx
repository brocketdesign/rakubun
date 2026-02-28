import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Users,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  CalendarDays,
  Download,
  Loader2,
  BarChart3,
  Link2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import UpgradePrompt from '../../components/UpgradePrompt';
import { useSites, useSitesWithAnalytics } from '../../stores/sitesStore';
import {
  analyticsActions,
  useAnalyticsData,
  useAnalyticsDataLoading,
  useAnalyticsConnectionStatus,
  formatNumber,
  formatDuration,
  formatPercent,
  getRelativeDateRange,
} from '../../stores/analyticsStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TimeRange {
  value: string;
  label: { en: string; ja: string };
  days: number;
}

const timeRanges: TimeRange[] = [
  { value: '7d', label: { en: '7D', ja: '7日' }, days: 7 },
  { value: '30d', label: { en: '30D', ja: '30日' }, days: 30 },
  { value: '90d', label: { en: '90D', ja: '90日' }, days: 90 },
];

// ─── Components ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  color,
  loading,
}: {
  label: { en: string; ja: string };
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}) {
  const { language } = useLanguage();

  return (
    <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change && trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              trend === 'up' ? 'text-emerald-600' : 'text-red-500'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {change}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <Loader2 className="w-5 h-5 animate-spin text-rakubun-text-secondary" />
        </div>
      ) : (
        <p className="text-2xl font-heading font-bold text-rakubun-text">{value}</p>
      )}
      <p className="text-xs text-rakubun-text-secondary mt-0.5">{label[language]}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rakubun-bg-secondary flex items-center justify-center mx-auto mb-4">
        <BarChart3 className="w-8 h-8 text-rakubun-text-secondary" />
      </div>
      <h3 className="text-lg font-medium text-rakubun-text mb-2">{title}</h3>
      <p className="text-sm text-rakubun-text-secondary mb-4 max-w-md mx-auto">{description}</p>
      {action}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const sites = useSites();
  const sitesWithAnalytics = useSitesWithAnalytics();

  const [timeRange, setTimeRange] = useState('7d');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Get current time range config
  const currentRange = useMemo(
    () => timeRanges.find((r) => r.value === timeRange) || timeRanges[0],
    [timeRange]
  );

  // Select first site with analytics by default
  useEffect(() => {
    if (sitesWithAnalytics.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sitesWithAnalytics[0].id);
    }
  }, [sitesWithAnalytics, selectedSiteId]);

  // Load analytics data when site or time range changes
  useEffect(() => {
    if (selectedSiteId) {
      const dateRange = getRelativeDateRange(currentRange.days);
      analyticsActions.loadAnalyticsData(getToken, selectedSiteId, dateRange);
    }
  }, [selectedSiteId, currentRange.days, getToken]);

  const analyticsData = useAnalyticsData(selectedSiteId);
  const dataLoading = useAnalyticsDataLoading(selectedSiteId);
  useAnalyticsConnectionStatus(selectedSiteId);

  // Calculate stats from real data
  const stats = useMemo(() => {
    if (!analyticsData?.overview) {
      return {
        pageViews: { value: '0', change: undefined, trend: undefined },
        totalUsers: { value: '0', change: undefined, trend: undefined },
        avgEngagementTime: { value: '0:00', change: undefined, trend: undefined },
        bounceRate: { value: '0%', change: undefined, trend: undefined },
      };
    }

    const { overview } = analyticsData;

    return {
      pageViews: {
        value: formatNumber(overview.pageViews),
        change: '+12%', // TODO: Calculate from previous period
        trend: 'up' as const,
      },
      totalUsers: {
        value: formatNumber(overview.totalUsers),
        change: '+8%',
        trend: 'up' as const,
      },
      avgEngagementTime: {
        value: formatDuration(overview.avgEngagementTime),
        change: '+0:15',
        trend: 'up' as const,
      },
      bounceRate: {
        value: formatPercent(overview.bounceRate),
        change: '-3%',
        trend: 'down' as const, // Lower bounce rate is good
      },
    };
  }, [analyticsData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!analyticsData?.dailyTrend?.length) {
      return [];
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysJa = ['日', '月', '火', '水', '木', '金', '土'];

    return analyticsData.dailyTrend.map((item) => {
      const date = new Date(item.date);
      const dayIndex = date.getDay();
      return {
        day: language === 'en' ? days[dayIndex] : daysJa[dayIndex],
        value: item.pageViews,
        fullDate: item.date,
      };
    });
  }, [analyticsData, language]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => d.value));
  }, [chartData]);

  // Handle refresh
  const handleRefresh = () => {
    if (selectedSiteId) {
      const dateRange = getRelativeDateRange(currentRange.days);
      analyticsActions.loadAnalyticsData(getToken, selectedSiteId, dateRange);
    }
  };

  // Check if any sites have GA connected
  const hasConnectedSites = sitesWithAnalytics.length > 0;

  // Get selected site name
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <UpgradePrompt
      feature={language === 'en' ? 'Analytics' : 'アナリティクス'}
      requiredPlan="basic"
      variant="overlay"
    >
      <div className="space-y-6 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
              {language === 'en' ? 'Analytics' : 'アナリティクス'}
            </h2>
            <p className="text-xs sm:text-sm text-rakubun-text-secondary mt-1">
              {language === 'en'
                ? 'Track your content performance across all connected sites.'
                : 'すべての接続サイトのコンテンツパフォーマンスを追跡。'}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Site Selector */}
            {hasConnectedSites && (
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
                  <SelectValue placeholder={language === 'en' ? 'Select site' : 'サイトを選択'} />
                </SelectTrigger>
                <SelectContent>
                  {sitesWithAnalytics.map((site) => (
                    <SelectItem key={site.id} value={site.id} className="text-xs">
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    timeRange === range.value
                      ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                      : 'text-rakubun-text-secondary hover:text-rakubun-text'
                  }`}
                >
                  {range.label[language]}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={dataLoading || !selectedSiteId}
              className="p-2 rounded-xl border border-rakubun-border hover:border-rakubun-accent/50 text-rakubun-text-secondary hover:text-rakubun-accent transition-all disabled:opacity-50"
              title={language === 'en' ? 'Refresh data' : 'データを更新'}
            >
              <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
            </button>

            <button className="btn-secondary text-sm hidden sm:inline-flex">
              <Download className="w-4 h-4" />
              {language === 'en' ? 'Export' : 'エクスポート'}
            </button>
          </div>
        </div>

        {/* No Sites Connected State */}
        {!hasConnectedSites && sites.length === 0 && (
          <EmptyState
            title={language === 'en' ? 'No Sites Connected' : 'サイトが接続されていません'}
            description={
              language === 'en'
                ? 'Connect a WordPress site first to start tracking analytics.'
                : 'アナリティクスを追跡するには、まずWordPressサイトを接続してください。'
            }
          />
        )}

        {/* No GA Connected State */}
        {!hasConnectedSites && sites.length > 0 && (
          <EmptyState
            title={language === 'en' ? 'Connect Google Analytics' : 'Google Analyticsを接続'}
            description={
              language === 'en'
                ? 'Connect your Google Analytics account to see real-time data from your sites. Go to Sites settings to connect GA4.'
                : 'リアルタイムデータを表示するには、Google Analyticsアカウントを接続してください。サイト設定からGA4を接続できます。'
            }
            action={
              <a
                href="/dashboard/sites"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rakubun-accent text-white text-sm font-medium hover:bg-rakubun-accent/90 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                {language === 'en' ? 'Go to Sites' : 'サイトへ移動'}
              </a>
            }
          />
        )}

        {/* Analytics Dashboard */}
        {hasConnectedSites && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={{ en: 'Total Views', ja: '総ビュー' }}
                value={stats.pageViews.value}
                change={stats.pageViews.change}
                trend={stats.pageViews.trend}
                icon={Eye}
                color="text-blue-600 bg-blue-50"
                loading={dataLoading}
              />
              <StatCard
                label={{ en: 'Unique Visitors', ja: 'ユニーク訪問者' }}
                value={stats.totalUsers.value}
                change={stats.totalUsers.change}
                trend={stats.totalUsers.trend}
                icon={Users}
                color="text-emerald-600 bg-emerald-50"
                loading={dataLoading}
              />
              <StatCard
                label={{ en: 'Avg. Read Time', ja: '平均読了時間' }}
                value={stats.avgEngagementTime.value}
                change={stats.avgEngagementTime.change}
                trend={stats.avgEngagementTime.trend}
                icon={Clock}
                color="text-purple-600 bg-purple-50"
                loading={dataLoading}
              />
              <StatCard
                label={{ en: 'Bounce Rate', ja: '直帰率' }}
                value={stats.bounceRate.value}
                change={stats.bounceRate.change}
                trend={stats.bounceRate.trend}
                icon={TrendingDown}
                color="text-amber-600 bg-amber-50"
                loading={dataLoading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-2 bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-heading font-semibold text-rakubun-text">
                      {language === 'en' ? 'Views Over Time' : '時間別ビュー'}
                    </h3>
                    {selectedSite && (
                      <p className="text-xs text-rakubun-text-secondary mt-0.5">
                        {selectedSite.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-rakubun-text-secondary flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {currentRange.days}
                    {language === 'en' ? ' days' : '日間'}
                  </span>
                </div>

                {dataLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rakubun-accent" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-rakubun-text-secondary">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {language === 'en' ? 'No data available for this period' : 'この期間のデータはありません'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <div className="flex items-end gap-2 sm:gap-3 h-48" style={{ minWidth: `${Math.max(chartData.length * 28, 200)}px` }}>
                    {chartData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-rakubun-text tabular-nums">
                          {formatNumber(d.value)}
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-rakubun-accent/80 hover:bg-rakubun-accent transition-colors cursor-pointer relative group"
                          style={{ height: `${(d.value / maxChartValue) * 160}px` }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-rakubun-text text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {d.fullDate}: {formatNumber(d.value)} views
                          </div>
                        </div>
                        <span className="text-xs text-rakubun-text-secondary">{d.day}</span>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Pages */}
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
                <div className="px-5 py-4 border-b border-rakubun-border">
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {language === 'en' ? 'Top Pages' : '人気ページ'}
                  </h3>
                </div>
                <div className="divide-y divide-black/5">
                  {dataLoading ? (
                    <div className="p-8 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
                    </div>
                  ) : analyticsData?.topPages?.length === 0 ? (
                    <div className="p-8 text-center text-rakubun-text-secondary">
                      <p className="text-sm">
                        {language === 'en' ? 'No page data available' : 'ページデータはありません'}
                      </p>
                    </div>
                  ) : (
                    analyticsData?.topPages?.slice(0, 5).map((page, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-rakubun-bg/50 transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-bold text-rakubun-text-secondary w-5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-rakubun-text truncate">
                            {page.pageTitle}
                          </p>
                          <p className="text-xs text-rakubun-text-secondary truncate">
                            {page.pagePath}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-rakubun-text">
                            {formatNumber(page.pageViews)}
                          </p>
                          <p className="text-xs text-emerald-600">
                            {formatNumber(page.totalUsers)} {language === 'en' ? 'users' : 'ユーザー'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Site Performance Table */}
            <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
              <div className="px-5 py-4 border-b border-rakubun-border">
                <h3 className="font-heading font-semibold text-rakubun-text">
                  {language === 'en' ? 'Connected Sites' : '接続済みサイト'}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-rakubun-border">
                      <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                        {language === 'en' ? 'Site' : 'サイト'}
                      </th>
                      <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                        {language === 'en' ? 'GA Property' : 'GAプロパティ'}
                      </th>
                      <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                        {language === 'en' ? 'Status' : 'ステータス'}
                      </th>
                      <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-rakubun-text-secondary">
                        {language === 'en' ? 'Connected' : '接続日'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {sitesWithAnalytics.map((site) => (
                      <tr
                        key={site.id}
                        className={`hover:bg-rakubun-bg/50 transition-colors cursor-pointer ${
                          selectedSiteId === site.id ? 'bg-rakubun-accent/5' : ''
                        }`}
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-rakubun-text-secondary" />
                            <span className="text-sm font-medium text-rakubun-text">{site.name}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5">
                          <span className="text-sm text-rakubun-text">
                            {site.analytics?.propertyName || site.analytics?.propertyId || '-'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <TrendingUp className="w-3 h-3" />
                            {language === 'en' ? 'Active' : 'アクティブ'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5 text-sm text-rakubun-text-secondary">
                          {site.analytics?.connectedAt
                            ? new Date(site.analytics.connectedAt).toLocaleDateString(
                                language === 'ja' ? 'ja-JP' : 'en-US'
                              )
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </UpgradePrompt>
  );
}
