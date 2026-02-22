import { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  Loader2,
  Globe,
  Sparkles,
  Image,
  Link,
  Send,
  Bold,
  Italic,
  List,
  Heading1,
  Heading2,
  Code,
  AlignLeft,
  X,
} from 'lucide-react';
import { useLanguage } from '../../i18n';

const articles = [
  {
    id: '1',
    title: '10 Best Practices for React Performance',
    excerpt: 'Learn how to optimize your React applications for maximum performance with these proven techniques.',
    site: 'techblog.com',
    status: 'published' as const,
    wordCount: 2450,
    date: 'Feb 22, 2026',
    views: 234,
    seoScore: 92,
  },
  {
    id: '2',
    title: 'Getting Started with TypeScript in 2026',
    excerpt: 'A comprehensive guide to TypeScript features and best practices for modern web development.',
    site: 'devinsights.io',
    status: 'scheduled' as const,
    wordCount: 1890,
    date: 'Feb 23, 2026',
    views: 0,
    seoScore: 88,
  },
  {
    id: '3',
    title: 'Understanding Modern CSS Layout',
    excerpt: 'Deep dive into CSS Grid, Flexbox, and the new container queries for responsive design.',
    site: 'techblog.com',
    status: 'draft' as const,
    wordCount: 1200,
    date: 'Feb 21, 2026',
    views: 0,
    seoScore: 75,
  },
  {
    id: '4',
    title: 'AI Tools for Content Creators',
    excerpt: 'Exploring the latest AI-powered tools that help content creators produce better work faster.',
    site: 'aiweekly.net',
    status: 'published' as const,
    wordCount: 3100,
    date: 'Feb 19, 2026',
    views: 1247,
    seoScore: 85,
  },
  {
    id: '5',
    title: 'Web Performance Optimization Guide',
    excerpt: 'Core Web Vitals, lazy loading, code splitting, and more techniques to speed up your website.',
    site: 'devinsights.io',
    status: 'generating' as const,
    wordCount: 0,
    date: 'Feb 22, 2026',
    views: 0,
    seoScore: 0,
  },
];

const statusConfig = {
  published: { label: { en: 'Published', ja: '公開済み' }, class: 'status-badge-success', icon: CheckCircle2 },
  scheduled: { label: { en: 'Scheduled', ja: '予約済み' }, class: 'status-badge-warning', icon: Clock },
  draft: { label: { en: 'Draft', ja: '下書き' }, class: 'text-gray-700 bg-gray-50 dark:text-gray-300 dark:bg-gray-500/10', icon: FileText },
  generating: { label: { en: 'Generating', ja: '生成中' }, class: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10', icon: Loader2 },
};

const statusFilters = ['all', 'published', 'scheduled', 'draft', 'generating'] as const;

export default function ArticlesPage() {
  const { language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const filteredArticles = articles.filter(a => {
    if (activeFilter !== 'all' && a.status !== activeFilter) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-rakubun-text">
            {language === 'en' ? 'Articles' : '記事'}
          </h2>
          <p className="text-sm text-rakubun-text-secondary mt-1">
            {language === 'en'
              ? 'Create, edit, and manage your AI-generated articles.'
              : 'AI生成記事の作成、編集、管理。'}
          </p>
        </div>
        <button onClick={() => setShowEditor(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          {language === 'en' ? 'New Article' : '新しい記事'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rakubun-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search articles...' : '記事を検索...'}
              className="w-full pl-10 pr-4 py-2 bg-rakubun-bg rounded-lg text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-rakubun-accent/20 transition-all"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-rakubun-bg rounded-xl p-1">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === filter
                    ? 'bg-rakubun-surface text-rakubun-text shadow-sm'
                    : 'text-rakubun-text-secondary hover:text-rakubun-text'
                }`}
              >
                {filter === 'all'
                  ? (language === 'en' ? 'All' : '全て')
                  : statusConfig[filter as keyof typeof statusConfig].label[language]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => {
          const statusCfg = statusConfig[article.status];
          return (
            <div
              key={article.id}
              className="bg-rakubun-surface rounded-2xl border border-rakubun-border p-5 hover:shadow-md transition-all duration-300 group cursor-pointer"
              onClick={() => setShowEditor(true)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`status-badge ${statusCfg.class}`}>
                      {article.status === 'generating' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <statusCfg.icon className="w-3 h-3" />
                      )}
                      <span>{statusCfg.label[language]}</span>
                    </span>
                    <span className="text-xs text-rakubun-text-secondary flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {article.site}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-rakubun-text group-hover:text-rakubun-accent transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-rakubun-text-secondary mt-1 line-clamp-1">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-rakubun-text-secondary">
                    <span>{article.date}</span>
                    {article.wordCount > 0 && (
                      <span>{article.wordCount.toLocaleString()} {language === 'en' ? 'words' : '語'}</span>
                    )}
                    {article.views > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.views.toLocaleString()}
                      </span>
                    )}
                    {article.seoScore > 0 && (
                      <span className={`font-medium ${
                        article.seoScore >= 80 ? 'text-emerald-600' : article.seoScore >= 60 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        SEO: {article.seoScore}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEditor(true); }}
                    className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-rakubun-text-secondary hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Article Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rakubun-surface rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Editor Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rakubun-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rakubun-accent/10">
                  <FileText className="w-4 h-4 text-rakubun-accent" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-rakubun-text">
                    {language === 'en' ? 'Article Editor' : '記事エディター'}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-xs py-1.5 px-3">
                  <Eye className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Preview' : 'プレビュー'}
                </button>
                <button className="btn-primary text-xs py-1.5 px-3">
                  <Send className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Publish' : '公開'}
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-2 rounded-lg hover:bg-rakubun-bg-secondary text-rakubun-text-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* AI Generation */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-100 p-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
                  <input
                    type="text"
                    placeholder={language === 'en'
                      ? 'Describe what you want to write about...'
                      : '書きたい内容を説明...'}
                    className="flex-1 bg-transparent text-sm text-rakubun-text placeholder:text-purple-400 outline-none"
                  />
                  <button className="btn-primary text-xs py-1.5 px-3 bg-purple-600 hover:bg-purple-700">
                    <Sparkles className="w-3.5 h-3.5" />
                    {language === 'en' ? 'Generate' : '生成'}
                  </button>
                </div>
              </div>

              {/* Site Selector */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-rakubun-text-secondary mb-1">
                    {language === 'en' ? 'Target Site' : '対象サイト'}
                  </label>
                  <select className="w-full px-3 py-2 bg-rakubun-bg rounded-lg text-sm text-rakubun-text border-0 focus:ring-2 focus:ring-rakubun-accent/20">
                    <option>techblog.com</option>
                    <option>devinsights.io</option>
                    <option>aiweekly.net</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-rakubun-text-secondary mb-1">
                    {language === 'en' ? 'Category' : 'カテゴリ'}
                  </label>
                  <select className="w-full px-3 py-2 bg-rakubun-bg rounded-lg text-sm text-rakubun-text border-0 focus:ring-2 focus:ring-rakubun-accent/20">
                    <option>{language === 'en' ? 'Technology' : 'テクノロジー'}</option>
                    <option>{language === 'en' ? 'Development' : '開発'}</option>
                    <option>{language === 'en' ? 'Tutorial' : 'チュートリアル'}</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder={language === 'en' ? 'Article Title' : '記事タイトル'}
                className="w-full text-2xl font-heading font-bold text-rakubun-text placeholder:text-rakubun-text-secondary/40 outline-none border-0 bg-transparent"
                defaultValue=""
              />

              {/* Toolbar */}
              <div className="flex items-center gap-1 p-1 bg-rakubun-bg rounded-xl">
                {[Bold, Italic, Heading1, Heading2, List, Code, AlignLeft, Image, Link].map((Icon, i) => (
                  <button
                    key={i}
                    className="p-2 rounded-lg hover:bg-rakubun-surface text-rakubun-text-secondary hover:text-rakubun-text transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-rakubun-text-secondary px-2">
                  0 {language === 'en' ? 'words' : '語'}
                </span>
              </div>

              {/* Content Area */}
              <textarea
                placeholder={language === 'en'
                  ? 'Start writing your article or use AI to generate content...'
                  : '記事を書き始めるか、AIでコンテンツを生成...'}
                className="w-full min-h-[300px] text-sm text-rakubun-text placeholder:text-rakubun-text-secondary/40 outline-none border-0 bg-transparent resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
