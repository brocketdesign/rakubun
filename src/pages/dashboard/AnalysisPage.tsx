import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Type,
  LayoutGrid,
  Search,
  Target,
  RefreshCw,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Lightbulb,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useAuth } from '@clerk/clerk-react';
import { useSites, sitesActions } from '../../stores/sitesStore';
import { SiteSelector } from '../../components/SiteSelector';
import UpgradePrompt from '../../components/UpgradePrompt';
import {
  analysisActions,
  useAnalysisReports,
  useAnalysisLoading,
  useAnalysisError,
  useRunningAnalysis,
  useSelectedReport,
  useSelectedReportLoading,
  type AnalysisReport,
} from '../../stores/analysisStore';

// ─── Constants ──────────────────────────────────────────────────────────────────

const analysisCategories = [
  {
    icon: Type,
    label: { en: 'Tone & Voice', ja: 'トーン＆ボイス' },
    description: { en: 'Analyze writing style and tone consistency', ja: '文体とトーンの一貫性を分析' },
    color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
  },
  {
    icon: LayoutGrid,
    label: { en: 'Content Structure', ja: 'コンテンツ構造' },
    description: { en: 'Evaluate heading hierarchy and readability', ja: '見出し構造と読みやすさを評価' },
    color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  },
  {
    icon: Search,
    label: { en: 'SEO Analysis', ja: 'SEO分析' },
    description: { en: 'Check keyword density, meta tags, internal links', ja: 'キーワード密度、メタタグ、内部リンクを確認' },
    color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  },
  {
    icon: Target,
    label: { en: 'Gap Detection', ja: 'ギャップ検出' },
    description: { en: 'Identify missing topics and content opportunities', ja: '欠落トピックとコンテンツ機会を特定' },
    color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  },
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'SEO Analysis': Search,
  'Tone & Voice': Type,
  'Content Structure': LayoutGrid,
  'Gap Detection': Target,
};

const categoryColors: Record<string, string> = {
  'SEO Analysis': '#2B6BFF',
  'Tone & Voice': '#8B5CF6',
  'Content Structure': '#10B981',
  'Gap Detection': '#F59E0B',
};

// ─── ScoreRing ──────────────────────────────────────────────────────────────────

function ScoreRing({ value, size = 64, strokeWidth = 6, color = '#2B6BFF' }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E9EDF3"
          strokeWidth={strokeWidth}
          className="dark:stroke-white/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-heading font-bold">{value}</span>
      </div>
    </div>
  );
}

// ─── Report Detail View ─────────────────────────────────────────────────────────

function ReportDetailView({
  report,
  onBack,
}: {
  report: AnalysisReport;
  onBack: () => void;
}) {
  const { language } = useLanguage();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
            {report.siteName || report.siteUrl}
          </h2>
          <p className="text-xs text-rakubun-text-secondary">
            {language === 'en' ? 'Analyzed on' : '分析日:'}{' '}
            {new Date(report.createdAt).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {report.pagesAnalyzed > 0 && (
              <> · {report.pagesAnalyzed} {language === 'en' ? 'pages analyzed' : 'ページ分析済み'}</>
            )}
          </p>
        </div>
      </div>

      {/* Summary */}
      {report.summary && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
          <h3 className="font-heading font-semibold text-rakubun-text mb-2">
            {language === 'en' ? 'Summary' : 'サマリー'}
          </h3>
          <p className="text-sm text-rakubun-text-secondary leading-relaxed">{report.summary}</p>
        </div>
      )}

      {/* Score Overview */}
      {report.scores && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 text-center">
            <ScoreRing value={report.scores.seoScore} size={72} strokeWidth={6} />
            <p className="text-xs font-medium text-rakubun-text mt-2">SEO</p>
          </div>
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 text-center">
            <ScoreRing value={report.scores.toneScore} size={72} strokeWidth={6} color="#8B5CF6" />
            <p className="text-xs font-medium text-rakubun-text mt-2">
              {language === 'en' ? 'Tone' : 'トーン'}
            </p>
          </div>
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 text-center">
            <ScoreRing value={report.scores.structureScore} size={72} strokeWidth={6} color="#10B981" />
            <p className="text-xs font-medium text-rakubun-text mt-2">
              {language === 'en' ? 'Structure' : '構造'}
            </p>
          </div>
          <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 text-center">
            <div className="flex items-center justify-center" style={{ width: 72, height: 72 }}>
              <span className="text-2xl font-heading font-bold text-amber-600">{report.scores.contentGaps}</span>
            </div>
            <p className="text-xs font-medium text-rakubun-text mt-2">
              {language === 'en' ? 'Content Gaps' : 'ギャップ'}
            </p>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {report.categories.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Detailed Breakdown' : '詳細分析'}
          </h3>
          {report.categories.map((cat) => {
            const CatIcon = categoryIcons[cat.category] || FileText;
            const catColor = categoryColors[cat.category] || '#2B6BFF';
            const isExpanded = expandedCategory === cat.category;

            return (
              <div
                key={cat.category}
                className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden"
              >
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-rakubun-bg/50 transition-colors text-left"
                >
                  <ScoreRing value={cat.score} size={48} strokeWidth={5} color={catColor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CatIcon className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
                      <h4 className="font-medium text-rakubun-text">{cat.category}</h4>
                    </div>
                    <p className="text-xs text-rakubun-text-secondary mt-0.5">
                      {cat.issues.length} {language === 'en' ? 'issues' : '問題'} · {cat.suggestions.length}{' '}
                      {language === 'en' ? 'suggestions' : '提案'}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-rakubun-text-secondary shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-rakubun-text-secondary shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-rakubun-border pt-4 space-y-4">
                    {/* Issues */}
                    {cat.issues.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {language === 'en' ? 'Issues Found' : '検出された問題'}
                        </h5>
                        <ul className="space-y-1.5">
                          {cat.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-rakubun-text-secondary">
                              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggestions */}
                    {cat.suggestions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" />
                          {language === 'en' ? 'Suggestions' : '改善提案'}
                        </h5>
                        <ul className="space-y-1.5">
                          {cat.suggestions.map((sug, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-rakubun-text-secondary">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{sug}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ language }: { language: 'en' | 'ja' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-3 rounded-2xl bg-rakubun-bg-secondary mb-4">
        <Search className="w-8 h-8 text-rakubun-text-secondary" />
      </div>
      <h3 className="font-heading font-semibold text-rakubun-text mb-1">
        {language === 'en' ? 'No analysis reports yet' : '分析レポートはまだありません'}
      </h3>
      <p className="text-sm text-rakubun-text-secondary max-w-sm">
        {language === 'en'
          ? 'Select a site and run your first AI analysis to get insights about tone, structure, and SEO.'
          : 'サイトを選択して最初のAI分析を実行し、トーン、構造、SEOに関するインサイトを取得しましょう。'}
      </p>
    </div>
  );
}

// ─── Report Row ─────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  language,
  onSelect,
  onDelete,
  onRerun,
}: {
  report: AnalysisReport;
  language: 'en' | 'ja';
  onSelect: () => void;
  onDelete: () => void;
  onRerun: () => void;
}) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="px-4 sm:px-5 py-4 hover:bg-rakubun-bg/50 transition-colors cursor-pointer" onClick={onSelect}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 sm:min-w-[200px]">
          <Globe className="w-4 h-4 text-rakubun-text-secondary shrink-0" />
          <div>
            <p className="text-sm font-medium text-rakubun-text">{report.siteName || report.siteUrl}</p>
            <p className="text-xs text-rakubun-text-secondary">{formatDate(report.createdAt)}</p>
          </div>
        </div>

        {report.status === 'completed' && report.scores ? (
          <>
            <div className="flex items-center gap-3 sm:gap-6 flex-1 flex-wrap">
              <div className="flex items-center gap-2">
                <ScoreRing value={report.scores.seoScore} size={40} strokeWidth={4} />
                <p className="text-xs font-medium text-rakubun-text">SEO</p>
              </div>
              <div className="flex items-center gap-2">
                <ScoreRing value={report.scores.toneScore} size={40} strokeWidth={4} color="#8B5CF6" />
                <p className="text-xs font-medium text-rakubun-text">
                  {language === 'en' ? 'Tone' : 'トーン'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ScoreRing value={report.scores.structureScore} size={40} strokeWidth={4} color="#10B981" />
                <p className="text-xs font-medium text-rakubun-text">
                  {language === 'en' ? 'Structure' : '構造'}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="status-badge status-badge-warning">
                  <AlertTriangle className="w-3 h-3" />
                  {report.scores.contentGaps} {language === 'en' ? 'gaps' : 'ギャップ'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onRerun}
                className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                title={language === 'en' ? 'Re-run analysis' : '再分析'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-600 transition-colors"
                title={language === 'en' ? 'Delete report' : 'レポートを削除'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-rakubun-text-secondary" />
            </div>
          </>
        ) : report.status === 'failed' ? (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <XCircle className="w-4 h-4" />
              <span className="text-xs sm:text-sm">{report.error || (language === 'en' ? 'Analysis failed' : '分析に失敗しました')}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onRerun}
                className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                title={language === 'en' ? 'Retry' : '再試行'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-rakubun-accent">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-xs sm:text-sm">
                {language === 'en' ? 'Analysis in progress...' : '分析中...'}
              </span>
            </div>
            <div className="flex-1 bg-rakubun-bg-secondary rounded-full h-2 max-w-xs">
              <div
                className="bg-rakubun-accent rounded-full h-2 transition-all duration-500"
                style={{ width: `${Math.max(report.progress, 10)}%` }}
              />
            </div>
            <span className="text-xs text-rakubun-text-secondary shrink-0">{report.progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { language } = useLanguage();
  const [selectedSite, setSelectedSite] = useState('');
  const [viewingReport, setViewingReport] = useState<AnalysisReport | null>(null);
  const { getToken } = useAuth();
  const sites = useSites();
  const reports = useAnalysisReports();
  const loading = useAnalysisLoading();
  const error = useAnalysisError();
  const runningAnalysis = useRunningAnalysis();
  const selectedReport = useSelectedReport();
  const selectedReportLoading = useSelectedReportLoading();

  // Load sites and reports on mount
  useEffect(() => {
    if (!sitesActions.isLoaded()) {
      sitesActions.loadSites(getToken);
    }
    analysisActions.loadReports(getToken);
    return () => analysisActions.cleanup();
  }, [getToken]);

  // Reload reports when site filter changes
  useEffect(() => {
    analysisActions.loadReports(getToken, selectedSite || undefined);
  }, [getToken, selectedSite]);

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedSite) return;
    await analysisActions.runAnalysis(getToken, selectedSite);
  }, [getToken, selectedSite]);

  const handleRerun = useCallback(
    async (siteId: string) => {
      await analysisActions.runAnalysis(getToken, siteId);
    },
    [getToken],
  );

  const handleDelete = useCallback(
    async (reportId: string) => {
      await analysisActions.deleteReport(getToken, reportId);
    },
    [getToken],
  );

  const handleSelectReport = useCallback(
    (report: AnalysisReport) => {
      if (report.status === 'completed') {
        analysisActions.loadReportDetail(getToken, report.id);
        setViewingReport(report);
      }
    },
    [getToken],
  );

  // Update viewing report when detail loads
  useEffect(() => {
    if (selectedReport && viewingReport && selectedReport.id === viewingReport.id) {
      setViewingReport(selectedReport);
    }
  }, [selectedReport, viewingReport]);

  // Show detail view
  if (viewingReport && viewingReport.status === 'completed') {
    const report = selectedReport?.id === viewingReport.id ? selectedReport : viewingReport;
    return (
      <UpgradePrompt feature={language === 'en' ? 'AI Site Analysis' : 'AIサイト分析'} requiredPlan="premium" variant="overlay">
        <div className="max-w-[1400px]">
          {selectedReportLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-rakubun-accent" />
            </div>
          ) : (
            <ReportDetailView
              report={report}
              onBack={() => {
                setViewingReport(null);
                analysisActions.clearSelectedReport();
              }}
            />
          )}
        </div>
      </UpgradePrompt>
    );
  }

  return (
    <UpgradePrompt feature={language === 'en' ? 'AI Site Analysis' : 'AIサイト分析'} requiredPlan="premium" variant="overlay">
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'AI Site Analysis' : 'AIサイト分析'}
          </h2>
          <p className="text-xs sm:text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Analyze your sites to understand tone, structure, and SEO performance.'
              : 'トーン、構造、SEOパフォーマンスを理解するためにサイトを分析。'}
          </p>
        </div>
        <button
          className="btn-primary text-sm shrink-0 self-start sm:self-auto disabled:opacity-50"
          onClick={handleRunAnalysis}
          disabled={!selectedSite || runningAnalysis}
        >
          {runningAnalysis ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {language === 'en' ? 'Run Analysis' : '分析を実行'}
        </button>
      </div>

      {/* Analysis Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analysisCategories.map((cat) => (
          <div
            key={cat.label.en}
            className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 cursor-pointer group"
          >
            <div className={`p-2.5 rounded-xl ${cat.color} w-fit mb-3`}>
              <cat.icon className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-rakubun-text group-hover:text-rakubun-accent transition-colors">
              {cat.label[language]}
            </h3>
            <p className="text-xs text-rakubun-text-secondary mt-1">
              {cat.description[language]}
            </p>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Reports */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-rakubun-border">
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Analysis Reports' : '分析レポート'}
            {reports.length > 0 && (
              <span className="text-sm font-normal text-rakubun-text-secondary ml-2">({reports.length})</span>
            )}
          </h3>
          <div className="w-full sm:w-[220px]">
            <SiteSelector
              value={selectedSite}
              onChange={setSelectedSite}
              sites={sites}
              size="sm"
              placeholder={language === 'en' ? 'All Sites' : '全サイト'}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-rakubun-accent" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState language={language} />
        ) : (
          <div className="divide-y divide-rakubun-border/50">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                language={language}
                onSelect={() => handleSelectReport(report)}
                onDelete={() => handleDelete(report.id)}
                onRerun={() => handleRerun(report.siteId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </UpgradePrompt>
  );
}
