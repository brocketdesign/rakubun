import type { Translations } from './types';

export const ja: Translations = {
  nav: {
    product: '製品',
    features: '機能',
    pricing: '料金',
    docs: 'ドキュメント',
    startFree: '無料で始める',
  },
  hero: {
    headline: 'ブログ運営を、自動化。',
    description:
      'RakuBunがサイトを分析し、トレンドを調査し、最適化された記事を自動公開。あなたは成長に集中するだけ。',
    ctaPrimary: 'WordPressを接続',
    ctaSecondary: 'ダッシュボードを見る',
    badgeFree: '月5記事まで無料',
    badgeNoCreditCard: 'クレジットカード不要',
    siteConnected: 'サイト接続済み',
  },
  connect: {
    eyebrow: 'セットアップ',
    headline: 'ワンクリックでWordPress同期。',
    description:
      'アプリケーションパスワードを貼り付けるだけ。RakuBunがREST APIを検証し、カテゴリをマッピングして監視を開始します。',
    link: 'アプリパスワードの作成方法',
    connectWordPress: 'WordPressを接続',
    siteUrl: 'サイトURL',
    applicationPassword: 'アプリケーションパスワード',
    connectSite: 'サイトを接続',
    encryptedSecure: '暗号化で安全',
  },
  analysis: {
    eyebrow: 'AI分析',
    headline: 'あなたのサイトを学習。',
    description:
      'RakuBunがスタイル、トーン、構造を読み取り、あなたが書いたかのようなコンテンツプランを作成します。',
    toneMatch: 'トーン一致',
    structureMap: '構造マップ',
    gapDetection: 'ギャップ検出',
    analysisReport: '分析レポート',
    structure: '構造',
    seoScore: 'SEOスコア',
  },
  research: {
    eyebrow: 'リサーチ',
    headline: 'トレンドトピックをお届け。',
    description:
      'RakuBunがあなたのニッチの検索トレンドとニュースを監視し、ランキングの可能性が高い切り口を提案します。',
    link: 'トピック例を見る',
    trendingInNiche: 'あなたのニッチのトレンド',
    topics: [
      'SEOトレンド 2024',
      'コンテンツ戦略',
      'AIライティング',
      'WordPressのコツ',
      'ブログ収益化',
    ],
    sources: 'ソース: Google Trends、News API、Reddit',
  },
  autoPublish: {
    eyebrow: '自動公開',
    headline: '一度設定すれば、ずっと公開。',
    description:
      'ペースを設定するだけ。RakuBunが生成、フォーマット、WordPressへの公開まで—画像、見出し、メタ情報を含めて自動化します。',
    autoImages: '自動画像',
    internalLinks: '内部リンク',
    seoMeta: 'SEOメタ',
    publishingSchedule: '公開スケジュール',
    calendarMonth: '2025年1月',
    calendarDays: ['月', '火', '水', '木', '金', '土', '日'],
    nextSchedule: '次回: 月曜 08:00',
    nextArticle: '「SEOトレンド 2025」',
  },
  monetize: {
    eyebrow: '収益化',
    headline: '稼ぐために作られた。',
    description:
      '広告対応レイアウト、高速パフォーマンス、レベニューシェアオプション—コンテンツが自ら収益を生み出します。',
    link: '収益化を詳しく見る',
    revenueDashboard: '収益ダッシュボード',
    weekDays: ['月', '火', '水', '木', '金', '土', '日'],
    estimatedMonthly: '月間推定収益',
  },
  features: {
    headline: 'ブログ運営に必要なすべてを',
    description:
      '初稿から公開まで—RakuBunが面倒な作業を代行します。',
    items: [
      {
        title: 'AIサイト分析',
        description: 'トーン、構造、ギャップをマッピング。',
      },
      {
        title: 'トレンドトピック',
        description: '実際の検索データに基づく提案。',
      },
      {
        title: 'ワンクリック公開',
        description: 'WordPress REST API、安全に接続。',
      },
      {
        title: 'スマート通知',
        description: '記事公開時にメール＆プッシュ通知。',
      },
      {
        title: '画像生成',
        description: 'GrokImaging統合を標準搭載。',
      },
      {
        title: 'APIアクセス',
        description: 'REST APIでワークフローを構築。',
      },
    ],
  },
  testimonials: {
    headline: 'クリエイターに愛されています',
    items: [
      {
        quote:
          '月2記事から週2記事に増やせました。雇用なしで。RakuBunはコンテンツ戦略を完全に変えてくれました。',
        name: 'Sarah Chen',
        role: 'TechBlog Daily 創設者',
      },
      {
        quote:
          'AIが本当に私らしく書いてくれます。読者が一貫性に気づき、エンゲージメントが40%向上しました。',
        name: 'Michael Roberts',
        role: 'インディークリエイター',
      },
      {
        quote:
          'セットアップは3分で完了。最初の記事が1週間以内にランクイン。これほど早い結果は初めてです。',
        name: '田中ゆき',
        role: 'SEOコンサルタント',
      },
    ],
  },
  pricing: {
    headline: 'シンプルな料金体系',
    description: '無料で始めて、スケールする準備ができたらアップグレード。',
    mostPopular: '一番人気',
    plans: [
      {
        name: 'フリー',
        price: '$0',
        period: '/月',
        description: '始めるのに最適',
        features: [
          '月5記事',
          '1サイト',
          '基本サポート',
          'メール通知',
        ],
        cta: '無料で始める',
      },
      {
        name: 'プロ',
        price: '$29',
        period: '/月',
        description: '本格的なコンテンツクリエイター向け',
        features: [
          '記事数無制限',
          '3サイト',
          '優先サポート',
          'APIアクセス',
          '画像生成',
          '高度な分析',
        ],
        cta: 'Proトライアルを始める',
      },
      {
        name: 'ビジネス',
        price: '$99',
        period: '/月',
        description: 'チームとエージェンシー向け',
        features: [
          'すべて無制限',
          '10サイト',
          '専任サポート',
          'カスタム連携',
          'ホワイトラベル対応',
          'チームコラボレーション',
        ],
        cta: '営業に問い合わせ',
      },
    ],
  },
  footer: {
    headline: '今日から公開を始めよう。',
    description: '月5記事まで無料。クレジットカード不要。',
    emailPlaceholder: 'you@company.com',
    getStarted: '始める',
    brandDescription: 'WordPress向けAI自動公開ツール。',
    copyright: '© {year} RakuBun. All rights reserved.',
    linkCategories: {
      product: '製品',
      company: '会社',
      legal: '法務',
    },
    links: {
      Product: ['機能', '料金', 'API', '連携'],
      Company: ['会社概要', 'ブログ', '採用', 'プレス'],
      Legal: ['プライバシー', '利用規約', 'セキュリティ', 'Cookie'],
    },
  },
};
