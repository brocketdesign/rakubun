import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  TrendingUp,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Clock,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Newspaper,
  Zap,
  Loader2,
  AlertCircle,
  Globe,
  Flame,
  FileSearch,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useSites, sitesActions } from '../../stores/sitesStore';
import { SiteSelector } from '../../components/SiteSelector';
import {
  useResearchResults,
  useResearchLoading,
  useResearchSavedIds,
  useDeepResearchLoading,
  useDeepResearchReport,
  researchActions,
} from '../../stores/researchStore';
import UpgradePrompt from '../../components/UpgradePrompt';

const quickTopics = [
  { en: 'AI Trends', ja: 'AIトレンド' },
  { en: 'SEO Tips', ja: 'SEOのコツ' },
  { en: 'Content Marketing', ja: 'コンテンツマーケティング' },
  { en: 'Social Media', ja: 'ソーシャルメディア' },
  { en: 'Web Development', ja: 'ウェブ開発' },
  { en: 'Monetization', ja: 'マネタイゼーション' },
];

export default function ResearchPage() {
  const { language } = useLanguage();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const sites = useSites();
  const results = useResearchResults();
  const isLoading = useResearchLoading();
  const savedIds = useResearchSavedIds();
  const isDeepLoading = useDeepResearchLoading();
  const deepReport = useDeepResearchReport();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [hasSearched, setHasSearched] = useState(false);
  const [showDeepResearch, setShowDeepResearch] = useState(false);
  const [providerFilter, setProviderFilter] = useState<'all' | 'openai' | 'firecrawl'>('all');

  // Load user's sites on mount
  useEffect(() => {
    if (!sitesActions.isLoaded()) {
      sitesActions.loadSites(getToken);
    }
  }, [getToken]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && !selectedSiteId) return;
    setHasSearched(true);
    setActiveTab('discover');
    setProviderFilter('all');
    await researchActions.search(getToken, {
      query: searchQuery.trim() || undefined,
      siteId: selectedSiteId || undefined,
    });
  }, [getToken, searchQuery, selectedSiteId]);

  const handleQuickTopic = useCallback(
    (topic: string) => {
      setSearchQuery(topic);
      setHasSearched(true);
      setActiveTab('discover');
      setProviderFilter('all');
      researchActions.search(getToken, {
        query: topic,
        siteId: selectedSiteId || undefined,
      });
    },
    [getToken, selectedSiteId],
  );

  const handleDeepResearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setShowDeepResearch(true);
    await researchActions.deepResearch(getToken, {
      query: searchQuery.trim(),
      siteId: selectedSiteId || undefined,
    });
  }, [getToken, searchQuery, selectedSiteId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const filteredResults = results.filter((r) => {
    if (providerFilter !== 'all' && r.provider !== providerFilter) return false;
    return true;
  });

  const displayedResults =
    activeTab === 'saved' ? filteredResults.filter((r) => savedIds.has(r.id)) : filteredResults;

  const openaiCount = results.filter((r) => r.provider === 'openai').length;
  const firecrawlCount = results.filter((r) => r.provider === 'firecrawl').length;

  return (
    <UpgradePrompt feature={language === 'en' ? 'Web Research' : 'ウェブリサーチ'} requiredPlan="premium" variant="overlay">
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Web Research' : 'ウェブリサーチ'}
          </h2>
          <p className="text-xs sm:text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Discover trending content using AI-powered web search. Select a site or enter a topic.'
              : 'AI検索でトレンドコンテンツを発見。サイトを選択するかトピックを入力。'}
          </p>
        </div>
        <button
          className="btn-primary text-sm"
          onClick={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {language === 'en' ? 'Search' : '検索'}
        </button>
      </div>

      {/* Site Filter + Search Bar */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4 space-y-3">
        {/* Site selector */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 min-w-[220px]">
            <SiteSelector
              value={selectedSiteId}
              onChange={setSelectedSiteId}
              sites={sites}
              placeholder={language === 'en' ? 'All sites (no filter)' : 'すべてのサイト（フィルターなし）'}
            />
          </div>

          {/* Search input */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rakubun-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedSiteId
                  ? language === 'en'
                    ? 'Optional: refine with a topic…'
                    : '任意：トピックで絞り込み…'
                  : language === 'en'
                    ? 'Search for trending topics, news, or ideas…'
                    : 'トレンドトピック、ニュース、アイデアを検索…'
              }
              className="w-full pl-12 pr-4 py-3 bg-rakubun-bg rounded-xl text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
            />
          </div>

          <button
            className="btn-primary text-sm shrink-0"
            onClick={handleSearch}
            disabled={isLoading || (!searchQuery.trim() && !selectedSiteId)}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {language === 'en' ? 'Find Trends' : 'トレンド検索'}
          </button>
        </div>

        {/* Selected site indicator */}
        {selectedSiteId && (
          <p className="text-xs text-rakubun-text-secondary flex items-center gap-1.5 pl-1">
            <TrendingUp className="w-3.5 h-3.5 text-rakubun-accent" />
            {language === 'en'
              ? `Searching trending content tailored for: ${sites.find((s) => s.id === selectedSiteId)?.name || 'selected site'}`
              : `対象サイト向けのトレンドコンテンツを検索中: ${sites.find((s) => s.id === selectedSiteId)?.name || '選択されたサイト'}`}
          </p>
        )}
      </div>

      {/* Quick Topic Chips */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-rakubun-accent" />
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Quick Topics' : 'クイックトピック'}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickTopics.map((topic) => (
            <button
              key={topic.en}
              onClick={() => handleQuickTopic(topic.en)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rakubun-bg hover:bg-rakubun-accent/5 border border-transparent hover:border-rakubun-accent/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5 text-rakubun-text-secondary group-hover:text-rakubun-accent" />
              <span className="text-sm font-medium text-rakubun-text group-hover:text-rakubun-accent">
                {language === 'en' ? topic.en : topic.ja}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-rakubun-accent animate-spin" />
          <p className="text-sm text-rakubun-text-secondary">
            {language === 'en'
              ? 'Searching the web with AI (OpenAI + Firecrawl)…'
              : 'AIでウェブ検索中（OpenAI + Firecrawl）…'}
          </p>
          <p className="text-xs text-rakubun-text-secondary/60">
            {language === 'en'
              ? 'This may take 10-20 seconds as we search multiple sources'
              : '複数のソースを検索するため10〜20秒かかる場合があります'}
          </p>
        </div>
      )}

      {/* Empty State (before first search) */}
      {!isLoading && !hasSearched && results.length === 0 && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex flex-col items-center justify-center gap-3">
          <Search className="w-10 h-10 text-rakubun-text-secondary/40" />
          <p className="text-sm text-rakubun-text-secondary text-center max-w-md">
            {language === 'en'
              ? 'Select one of your blogs above to discover trending content tailored to its niche, or enter a topic to search.'
              : '上でブログを選択して、そのニッチに合ったトレンドコンテンツを発見するか、トピックを入力して検索してください。'}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-rakubun-text-secondary/70">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              OpenAI Web Search
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-rakubun-text-secondary/70">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Firecrawl Search
            </span>
          </div>
        </div>
      )}

      {/* No Results State */}
      {!isLoading && hasSearched && results.length === 0 && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-12 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-10 h-10 text-rakubun-text-secondary/40" />
          <p className="text-sm text-rakubun-text-secondary">
            {language === 'en'
              ? 'No results found. Try a different topic or site.'
              : '結果が見つかりません。別のトピックやサイトを試してください。'}
          </p>
        </div>
      )}

      {/* Deep Research Button + Report */}
      {hasSearched && searchQuery.trim() && (
        <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border overflow-hidden">
          <button
            onClick={() => {
              if (!deepReport && !isDeepLoading) {
                handleDeepResearch();
              } else {
                setShowDeepResearch(!showDeepResearch);
              }
            }}
            disabled={isDeepLoading}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-rakubun-bg/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                <FileSearch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-rakubun-text">
                  {language === 'en' ? 'Deep Research' : 'ディープリサーチ'}
                </h3>
                <p className="text-xs text-rakubun-text-secondary">
                  {language === 'en'
                    ? 'Get an in-depth AI analysis with sources, trends, and content ideas'
                    : 'ソース、トレンド、コンテンツアイデアを含むAI詳細分析を取得'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDeepLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
              {!isDeepLoading && !deepReport && (
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
                  {language === 'en' ? 'Analyze' : '分析'}
                </span>
              )}
              {deepReport && (showDeepResearch ? <ChevronUp className="w-4 h-4 text-rakubun-text-secondary" /> : <ChevronDown className="w-4 h-4 text-rakubun-text-secondary" />)}
            </div>
          </button>

          {isDeepLoading && (
            <div className="px-5 pb-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                <Loader2 className="w-5 h-5 animate-spin text-purple-500 shrink-0" />
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {language === 'en'
                    ? 'Running deep research with AI web search… This may take 30-60 seconds.'
                    : 'AIウェブ検索でディープリサーチ実行中… 30〜60秒かかる場合があります。'}
                </p>
              </div>
            </div>
          )}

          {showDeepResearch && deepReport && (
            <div className="px-5 pb-5">
              <div className="prose prose-sm dark:prose-invert max-w-none bg-rakubun-bg rounded-xl p-5 border border-rakubun-border/50 overflow-auto max-h-[600px]">
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(deepReport) }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs and Results */}
      {!isLoading && results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 bg-rakubun-bg-secondary rounded-xl p-1 w-fit">
              <button
                onClick={() => setActiveTab('discover')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'discover'
                    ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4" />
                  {language === 'en' ? 'Results' : '結果'}
                  <span className="bg-rakubun-accent/10 text-rakubun-accent text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {results.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'saved'
                    ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4" />
                  {language === 'en' ? 'Saved' : '保存済み'}
                  <span className="bg-rakubun-accent/10 text-rakubun-accent text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {savedIds.size}
                  </span>
                </span>
              </button>
            </div>

            {/* Provider filter pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setProviderFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  providerFilter === 'all'
                    ? 'bg-rakubun-accent/10 text-rakubun-accent border border-rakubun-accent/20'
                    : 'text-rakubun-text-secondary hover:bg-rakubun-bg-secondary border border-transparent'
                }`}
              >
                {language === 'en' ? 'All' : 'すべて'} ({results.length})
              </button>
              {openaiCount > 0 && (
                <button
                  onClick={() => setProviderFilter('openai')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                    providerFilter === 'openai'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'text-rakubun-text-secondary hover:bg-rakubun-bg-secondary border border-transparent'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  OpenAI ({openaiCount})
                </button>
              )}
              {firecrawlCount > 0 && (
                <button
                  onClick={() => setProviderFilter('firecrawl')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5 ${
                    providerFilter === 'firecrawl'
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                      : 'text-rakubun-text-secondary hover:bg-rakubun-bg-secondary border border-transparent'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  Firecrawl ({firecrawlCount})
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {displayedResults.length === 0 && activeTab === 'saved' && (
              <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-8 text-center">
                <p className="text-sm text-rakubun-text-secondary">
                  {language === 'en' ? 'No saved items yet.' : 'まだ保存されたアイテムはありません。'}
                </p>
              </div>
            )}

            {displayedResults.map((result) => (
              <div
                key={result.id}
                className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Provider badge */}
                      {result.provider === 'openai' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                          <Globe className="w-2.5 h-2.5" />
                          AI
                        </span>
                      )}
                      {result.provider === 'firecrawl' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded">
                          <Flame className="w-2.5 h-2.5" />
                          FC
                        </span>
                      )}
                      <span className="text-xs font-medium text-rakubun-accent">{result.source}</span>
                      <span className="text-xs text-rakubun-text-secondary">·</span>
                      <span className="text-xs text-rakubun-text-secondary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {result.date}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-rakubun-text group-hover:text-rakubun-accent transition-colors">
                      {result.title}
                    </h3>
                    <p className="text-sm text-rakubun-text-secondary mt-1.5 line-clamp-2">
                      {result.summary}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                        <Zap className="w-3 h-3" />
                        {result.relevance}% {language === 'en' ? 'relevant' : '関連'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const params = new URLSearchParams({
                            fromResearch: '1',
                            title: result.title,
                            url: result.url,
                            summary: result.summary,
                            source: result.source,
                          });
                          navigate(`/dashboard/articles?${params.toString()}`);
                        }}
                        className="text-xs text-rakubun-accent font-medium hover:underline flex items-center gap-1"
                      >
                        {language === 'en' ? 'Generate Article' : '記事を生成'}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={() => researchActions.toggleSave(result.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        savedIds.has(result.id)
                          ? 'bg-rakubun-accent/10 text-rakubun-accent'
                          : 'hover:bg-rakubun-bg-secondary text-rakubun-text-secondary'
                      }`}
                    >
                      {savedIds.has(result.id) ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </UpgradePrompt>
  );
}

// Simple markdown-to-HTML helper for deep research reports
function formatMarkdown(md: string): string {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-rakubun-accent hover:underline">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p>\s*<\/p>/g, '');
}
