import { useState } from 'react';
import {
  Brain,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileBarChart,
  Globe,
  TrendingUp,
  Type,
  LayoutGrid,
  Search,
  Target,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const analysisReports = [
  {
    id: '1',
    site: 'techblog.com',
    date: 'Feb 22, 2026',
    status: 'completed' as const,
    seoScore: 84,
    toneMatch: 92,
    contentGaps: 5,
    structureScore: 78,
  },
  {
    id: '2',
    site: 'devinsights.io',
    date: 'Feb 21, 2026',
    status: 'completed' as const,
    seoScore: 76,
    toneMatch: 88,
    contentGaps: 8,
    structureScore: 82,
  },
  {
    id: '3',
    site: 'aiweekly.net',
    date: 'Feb 20, 2026',
    status: 'in-progress' as const,
    seoScore: null,
    toneMatch: null,
    contentGaps: null,
    structureScore: null,
  },
];

const analysisCategories = [
  {
    icon: Type,
    label: { en: 'Tone & Voice', ja: 'トーン＆ボイス' },
    description: { en: 'Analyze writing style and tone consistency', ja: '文体とトーンの一貫性を分析' },
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: LayoutGrid,
    label: { en: 'Content Structure', ja: 'コンテンツ構造' },
    description: { en: 'Evaluate heading hierarchy and readability', ja: '見出し構造と読みやすさを評価' },
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Search,
    label: { en: 'SEO Analysis', ja: 'SEO分析' },
    description: { en: 'Check keyword density, meta tags, internal links', ja: 'キーワード密度、メタタグ、内部リンクを確認' },
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: Target,
    label: { en: 'Gap Detection', ja: 'ギャップ検出' },
    description: { en: 'Identify missing topics and content opportunities', ja: '欠落トピックとコンテンツ機会を特定' },
    color: 'text-amber-600 bg-amber-50',
  },
];

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

export default function AnalysisPage() {
  const { language } = useLanguage();
  const [selectedSite, setSelectedSite] = useState('all');

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'AI Site Analysis' : 'AIサイト分析'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Analyze your sites to understand tone, structure, and SEO performance.'
              : 'トーン、構造、SEOパフォーマンスを理解するためにサイトを分析。'}
          </p>
        </div>
        <button className="btn-primary text-sm">
          <Play className="w-4 h-4" />
          {language === 'en' ? 'Run Analysis' : '分析を実行'}
        </button>
      </div>

      {/* Analysis Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analysisCategories.map((cat) => (
          <div
            key={cat.label.en}
            className="bg-white rounded-2xl border border-black/5 p-5 hover:shadow-md transition-all duration-300 cursor-pointer group"
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

      {/* Reports */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Analysis Reports' : '分析レポート'}
          </h3>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="text-sm bg-rakubun-bg border-0 rounded-lg px-3 py-1.5 text-rakubun-text-secondary focus:ring-2 focus:ring-rakubun-accent/20"
          >
            <option value="all">{language === 'en' ? 'All Sites' : '全サイト'}</option>
            <option value="techblog">techblog.com</option>
            <option value="devinsights">devinsights.io</option>
            <option value="aiweekly">aiweekly.net</option>
          </select>
        </div>

        <div className="divide-y divide-black/5">
          {analysisReports.map((report) => (
            <div
              key={report.id}
              className="px-5 py-4 hover:bg-rakubun-bg/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <Globe className="w-4 h-4 text-rakubun-text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-rakubun-text">{report.site}</p>
                    <p className="text-xs text-rakubun-text-secondary">{report.date}</p>
                  </div>
                </div>

                {report.status === 'completed' ? (
                  <>
                    <div className="flex items-center gap-6 flex-1">
                      <div className="flex items-center gap-2">
                        <ScoreRing value={report.seoScore!} size={48} strokeWidth={4} />
                        <div>
                          <p className="text-xs font-medium text-rakubun-text">SEO</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ScoreRing value={report.toneMatch!} size={48} strokeWidth={4} color="#8B5CF6" />
                        <div>
                          <p className="text-xs font-medium text-rakubun-text">
                            {language === 'en' ? 'Tone' : 'トーン'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ScoreRing value={report.structureScore!} size={48} strokeWidth={4} color="#10B981" />
                        <div>
                          <p className="text-xs font-medium text-rakubun-text">
                            {language === 'en' ? 'Structure' : '構造'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="status-badge status-badge-warning">
                          <AlertTriangle className="w-3 h-3" />
                          {report.contentGaps} {language === 'en' ? 'gaps' : 'ギャップ'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-rakubun-text-secondary" />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-rakubun-accent">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{language === 'en' ? 'Analysis in progress...' : '分析中...'}</span>
                    </div>
                    <div className="flex-1 bg-rakubun-bg-secondary rounded-full h-2 max-w-xs">
                      <div className="bg-rakubun-accent rounded-full h-2 w-3/5 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
