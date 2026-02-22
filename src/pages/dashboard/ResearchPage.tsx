import { useState } from 'react';
import {
  Search,
  TrendingUp,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Clock,
  Filter,
  Sparkles,
  Globe,
  ChevronRight,
  RefreshCw,
  ArrowUpRight,
  Newspaper,
  Zap,
  Hash,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const trendingTopics = [
  { topic: 'AI Agents', volume: '145K', change: '+340%', category: 'Technology' },
  { topic: 'React 20', volume: '89K', change: '+120%', category: 'Development' },
  { topic: 'Edge Computing', volume: '67K', change: '+85%', category: 'Infrastructure' },
  { topic: 'Web Assembly 3.0', volume: '43K', change: '+65%', category: 'Development' },
  { topic: 'Quantum ML', volume: '38K', change: '+210%', category: 'AI/ML' },
];

const researchResults = [
  {
    id: '1',
    title: 'How AI Agents Are Transforming Software Development in 2026',
    source: 'TechCrunch',
    date: '2 hours ago',
    summary: 'A comprehensive look at how autonomous AI agents are reshaping the development workflow, from code generation to deployment automation.',
    relevance: 95,
    saved: true,
    url: '#',
  },
  {
    id: '2',
    title: 'The Rise of Edge-Native Applications',
    source: 'The Verge',
    date: '5 hours ago',
    summary: 'Edge computing is evolving beyond CDNs, enabling fully native applications that run at the network edge with sub-millisecond latency.',
    relevance: 88,
    saved: false,
    url: '#',
  },
  {
    id: '3',
    title: 'React 20: What You Need to Know',
    source: 'Dev.to',
    date: '1 day ago',
    summary: 'Breaking down the major changes in React 20, including the new compiler, automatic batching improvements, and server components v3.',
    relevance: 82,
    saved: false,
    url: '#',
  },
  {
    id: '4',
    title: 'Best Practices for SEO in the Age of AI Search',
    source: 'Search Engine Journal',
    date: '1 day ago',
    summary: 'As AI-powered search engines change the landscape, here are updated strategies to maintain visibility and organic traffic.',
    relevance: 79,
    saved: true,
    url: '#',
  },
  {
    id: '5',
    title: 'WebAssembly 3.0 Opens New Possibilities for Web Apps',
    source: 'InfoQ',
    date: '2 days ago',
    summary: 'The latest WASM standard introduces shared memory, improved threading, and native DOM access that could rival native performance.',
    relevance: 75,
    saved: false,
    url: '#',
  },
];

const savedCount = researchResults.filter(r => r.saved).length;

export default function ResearchPage() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [savedItems, setSavedItems] = useState<Set<string>>(
    new Set(researchResults.filter(r => r.saved).map(r => r.id))
  );

  const toggleSave = (id: string) => {
    setSavedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayedResults = activeTab === 'saved'
    ? researchResults.filter(r => savedItems.has(r.id))
    : researchResults;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Web Research' : 'ウェブリサーチ'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Discover trending topics and research content ideas for your articles.'
              : 'トレンドトピックを発見し、記事のコンテンツアイデアをリサーチ。'}
          </p>
        </div>
        <button className="btn-primary text-sm">
          <RefreshCw className="w-4 h-4" />
          {language === 'en' ? 'Refresh Trends' : 'トレンド更新'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rakubun-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search for news, trends, or topics...' : 'ニュース、トレンド、トピックを検索...'}
              className="w-full pl-12 pr-4 py-3 bg-rakubun-bg rounded-xl text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
            />
          </div>
          <button className="btn-primary text-sm shrink-0">
            <Sparkles className="w-4 h-4" />
            {language === 'en' ? 'AI Search' : 'AI検索'}
          </button>
        </div>
      </div>

      {/* Trending Topics */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-rakubun-accent" />
          <h3 className="font-heading font-semibold text-rakubun-text">
            {language === 'en' ? 'Trending in Your Niche' : 'ニッチのトレンド'}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingTopics.map((topic) => (
            <button
              key={topic.topic}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rakubun-bg hover:bg-rakubun-accent/5 border border-transparent hover:border-rakubun-accent/20 transition-all group"
            >
              <Hash className="w-3.5 h-3.5 text-rakubun-text-secondary group-hover:text-rakubun-accent" />
              <span className="text-sm font-medium text-rakubun-text group-hover:text-rakubun-accent">{topic.topic}</span>
              <span className="text-xs text-emerald-600 font-medium">{topic.change}</span>
              <span className="text-xs text-rakubun-text-secondary">{topic.volume}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs and Results */}
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
              {language === 'en' ? 'Discover' : '発見'}
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
                {savedItems.size}
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-3">
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
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
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
                    onClick={() => toggleSave(result.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      savedItems.has(result.id)
                        ? 'bg-rakubun-accent/10 text-rakubun-accent'
                        : 'hover:bg-rakubun-bg-secondary text-rakubun-text-secondary'
                    }`}
                  >
                    {savedItems.has(result.id) ? (
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
    </div>
  );
}
