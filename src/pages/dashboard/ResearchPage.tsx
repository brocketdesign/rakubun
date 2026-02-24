import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
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
} from 'lucide-react';
import { useLanguage } from '../../i18n';
import { useSites, sitesActions } from '../../stores/sitesStore';
import { SiteSelector } from '../../components/SiteSelector';
import {
  useResearchResults,
  useResearchLoading,
  useResearchSavedIds,
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
  const sites = useSites();
  const results = useResearchResults();
  const isLoading = useResearchLoading();
  const savedIds = useResearchSavedIds();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [hasSearched, setHasSearched] = useState(false);

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
      researchActions.search(getToken, {
        query: topic,
        siteId: selectedSiteId || undefined,
      });
    },
    [getToken, selectedSiteId],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const displayedResults =
    activeTab === 'saved' ? results.filter((r) => savedIds.has(r.id)) : results;

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
              ? 'Discover trending content for your blog. Select a site or enter a topic.'
              : 'ブログのトレンドコンテンツを発見。サイトを選択するかトピックを入力。'}
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
              ? 'Searching the web for trending content…'
              : 'ウェブでトレンドコンテンツを検索中…'}
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

      {/* Tabs and Results */}
      {!isLoading && results.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-4 bg-rakubun-bg-secondary rounded-xl p-1 w-fit">
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
                      <button className="text-xs text-rakubun-accent font-medium hover:underline flex items-center gap-1">
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
