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
          '月3記事',
          '1サイト',
          '3スケジュール',
          'メール通知',
        ],
        cta: '無料で始める',
      },
      {
        name: 'ベーシック',
        price: '$9',
        period: '/月',
        description: '自動化を始めたいクリエイター向け',
        features: [
          '月30記事',
          '3サイト',
          '10スケジュール',
          'クロンジョブ自動化',
          '画像生成',
          'アナリティクス',
        ],
        cta: 'ベーシックを始める',
      },
      {
        name: 'プレミアム',
        price: '$29',
        period: '/月',
        description: 'パワーユーザーとエージェンシー向け',
        features: [
          '記事数無制限',
          'サイト数無制限',
          'スケジュール無制限',
          'AIサイト分析',
          'ウェブリサーチ',
          'APIアクセス',
        ],
        cta: 'プレミアムを始める',
      },
    ],
  },
  documentation: {
    title: 'ドキュメント',
    subtitle: 'WordPressサイトの接続方法とRakuBunの使い方をご紹介します。',
    backToDashboard: 'ダッシュボードに戻る',
    connectSection: {
      title: 'WordPressサイトの接続方法',
      intro: 'RakuBunはREST APIとアプリケーションパスワードを使用してWordPressサイトに接続します。これにより、メインのWordPressパスワードを使用せずに、記事の公開、カテゴリの管理、画像のアップロードを安全に行うことができます。',
      requirements: {
        title: '必要条件',
        items: [
          'セルフホスト型のWordPressサイト（WordPress.org）、バージョン5.6以降',
          'WordPress管理画面への管理者アクセス権',
          'サイトでHTTPSが有効であること（アプリケーションパスワードに必要）',
          'WordPress REST APIが有効であること（デフォルトで有効）',
        ],
      },
      steps: {
        title: '接続手順',
        items: [
          {
            title: 'ステップ1：WordPressサイトの準備',
            description: 'WordPressサイトがバージョン5.6以降であり、HTTPSが有効であることを確認してください。WordPressのバージョンは、ダッシュボード→更新セクションで確認できます。',
          },
          {
            title: 'ステップ2：アプリケーションパスワードの生成',
            description: '下記の「アプリケーションパスワードの取得方法」のセクションに従って、RakuBun専用のパスワードを作成してください。',
          },
          {
            title: 'ステップ3：RakuBunのサイトページへ移動',
            description: 'RakuBunダッシュボードのサイトページに移動し、「サイト追加」をクリックします。',
          },
          {
            title: 'ステップ4：サイト情報を入力',
            description: 'サイト名、WordPress URL（例：https://yourdomain.com）、WordPressユーザー名、生成したアプリケーションパスワードを入力します。',
          },
          {
            title: 'ステップ5：接続して確認',
            description: '「サイト接続」をクリックします。RakuBunが接続を検証し、REST APIアクセスを確認し、カテゴリをマッピングします。すべてが正常に動作すると、緑色の「接続済み」ステータスが表示されます。',
          },
        ],
      },
    },
    appPasswordSection: {
      title: 'アプリケーションパスワードの取得方法',
      intro: 'アプリケーションパスワードは、WordPress（バージョン5.6以降）に組み込まれた機能で、RakuBunのような外部アプリケーションがメインのWordPressパスワードを使用せずに認証できるようにします。',
      whatIs: {
        title: 'アプリケーションパスワードとは？',
        description: 'アプリケーションパスワードは、APIアクセス専用に設計された、取り消し可能な別のパスワードです。通常のWordPressログインパスワードとは異なります。異なるサービス用に複数のアプリケーションパスワードを作成でき、メインのログインに影響を与えることなく、いつでも個別に取り消すことができます。',
      },
      steps: {
        title: '操作手順',
        items: [
          {
            title: 'ステップ1：WordPressにログイン',
            description: 'WordPress管理画面にログインします（通常は yourdomain.com/wp-admin）。',
          },
          {
            title: 'ステップ2：プロフィールページへ移動',
            description: '左サイドバーからユーザー→プロフィールに移動するか、右上の名前をクリックして「プロフィールを編集」を選択します。',
          },
          {
            title: 'ステップ3：アプリケーションパスワードセクションまでスクロール',
            description: 'プロフィールページの下部にある「アプリケーションパスワード」セクションまでスクロールします。このセクションが表示されない場合は、サイトでHTTPSが有効で、WordPress 5.6以降が実行されていることを確認してください。',
          },
          {
            title: 'ステップ4：アプリケーション名を入力',
            description: '「新しいアプリケーションパスワード名」フィールドに「RakuBun」（または接続を識別するための任意の名前）を入力します。',
          },
          {
            title: 'ステップ5：パスワードを生成',
            description: '「新しいアプリケーションパスワードを追加」ボタンをクリックします。WordPressが xxxx xxxx xxxx xxxx xxxx xxxx のようなパスワードを生成します。',
          },
          {
            title: 'ステップ6：パスワードをコピー',
            description: '重要：このパスワードをすぐにコピーして安全な場所に保存してください。WordPressは一度しか表示しません。紛失した場合は、新しく生成する必要があります。',
          },
          {
            title: 'ステップ7：RakuBunに貼り付け',
            description: 'RakuBunに戻り、接続フォームにアプリケーションパスワードを貼り付けて、「サイト接続」をクリックします。',
          },
        ],
      },
      tips: {
        title: '重要なヒント',
        items: [
          'パスワードは一度しか表示されません — 生成後すぐにコピーしてください。',
          'アプリケーションパスワードにはスペースが含まれます — WordPressに表示されたとおりに貼り付けてください。',
          'WordPressプロフィールからいつでもパスワードを取り消すことができます（他のパスワードに影響しません）。',
          '後で簡単に識別できるよう、「RakuBun」などのわかりやすい名前を使用してください。',
          'セキュリティプラグインを使用している場合、REST APIやアプリケーションパスワードをブロックしていないか確認してください。',
        ],
      },
    },
    troubleshooting: {
      title: 'トラブルシューティング',
      items: [
        {
          question: 'アプリケーションパスワードのセクションが表示されない',
          answer: 'アプリケーションパスワードには WordPress 5.6以降とHTTPSが必要です。両方の要件が満たされていることを確認してください。一部のセキュリティプラグインがこのセクションを非表示にする場合があります — プラグインの設定を確認してください。',
        },
        {
          question: '「認証エラー」で接続に失敗する',
          answer: 'ユーザー名とアプリケーションパスワードを再確認してください。パスワードの前後に余分なスペースがないことを確認してください。また、ユーザー名がパスワードを生成したアカウントと一致していることも確認してください。',
        },
        {
          question: '「REST APIが無効」エラーで接続に失敗する',
          answer: '一部のセキュリティプラグインやカスタム設定がWordPress REST APIを無効にしている場合があります。セキュリティプラグインの設定を確認し、REST APIが有効であることを確認してください。',
        },
        {
          question: 'アプリケーションパスワードを紛失した',
          answer: '生成されたアプリケーションパスワードを後から確認することはできません。WordPressプロフィールから新しいパスワードを作成し、古いパスワードを取り消してください。',
        },
      ],
    },
    apiSection: {
      title: 'APIリファレンス',
      intro: 'RakuBun REST APIを使用して、接続されたWordPressサイトをプログラムで管理できます。すべてのエンドポイントには、AuthorizationヘッダーにAPIキーを含めた認証が必要です。',
      baseUrl: 'ベースURL',
      authentication: '認証',
      authDescription: 'すべてのリクエストのAuthorizationヘッダーにAPIキーを含めてください: Authorization: Bearer YOUR_API_KEY',
      endpoints: [
        {
          title: '接続サイト一覧の取得',
          method: 'GET',
          path: '/api/v1/sites',
          description: 'RakuBunアカウントに接続されたすべてのWordPressサイトの配列を返します。ステータス、記事数、同期情報を含みます。',
          responseExample: JSON.stringify({
            sites: [
              {
                id: 'abc123',
                name: 'Tech Blog',
                url: 'techblog.com',
                status: 'connected',
                articlesGenerated: 24,
                lastSync: '2026-02-22T10:30:00Z',
                wpVersion: '6.7',
                settings: {
                  autoSync: true,
                  syncInterval: 30,
                  defaultStatus: 'draft',
                  seoOptimization: true,
                },
              },
            ],
            total: 1,
          }, null, 2),
        },
        {
          title: 'サイト詳細の取得',
          method: 'GET',
          path: '/api/v1/sites/:id',
          description: '特定の接続サイトの詳細情報を返します。完全な設定、接続ステータス、記事生成統計を含みます。',
          responseExample: JSON.stringify({
            id: 'abc123',
            name: 'Tech Blog',
            url: 'techblog.com',
            username: 'admin',
            status: 'connected',
            articlesGenerated: 24,
            lastSync: '2026-02-22T10:30:00Z',
            wpVersion: '6.7',
            settings: {
              autoSync: true,
              syncInterval: 30,
              defaultCategory: 'Uncategorized',
              defaultStatus: 'draft',
              autoImages: true,
              seoOptimization: true,
              language: 'en',
              timezone: 'UTC',
            },
          }, null, 2),
        },
        {
          title: 'サイト設定の更新',
          method: 'PUT',
          path: '/api/v1/sites/:id/settings',
          description: '特定のサイトの設定を更新します。部分的な設定オブジェクトを送信できます — 提供されたフィールドのみが更新されます。',
          responseExample: JSON.stringify({
            id: 'abc123',
            name: 'Tech Blog',
            settings: {
              autoSync: false,
              syncInterval: 60,
              defaultStatus: 'publish',
              seoOptimization: true,
            },
            updatedAt: '2026-02-22T11:00:00Z',
          }, null, 2),
        },
      ],
    },
    needHelp: {
      title: 'お困りですか？',
      description: 'WordPressサイトの接続でお困りの場合は、サポートチームがお手伝いいたします。',
      cta: 'サポートに問い合わせ',
    },
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
