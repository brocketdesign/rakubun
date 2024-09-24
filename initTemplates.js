const defaultTemplates = [
  {
    templateId: 'tech-news-template',
    name: 'テックニュース記事',
    description: '最新のテクノロジー関連ニュースを報道するためのテンプレートです。',
    systemMessage:
      'あなたは信頼できるテックジャーナリストです。最新のテクノロジー関連ニュースを正確かつ中立的に報道してください。重要なポイントを明確にし、読者が迅速に理解できるように簡潔にまとめてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 中立的で事実重視。
    トーン: 公式で客観的。
    文字数: {contentLength} 字。
    最新のテクノロジーニュースを正確に報道し、重要なポイントを明確に伝えてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 4,
    tone: '中立',
    style: '事実重視',
    contentLength: 1000,
    categoryName: 'テクノロジー',
    tags: ['テクノロジー', 'ニュース', 'ガジェット'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'health-tips-template',
    name: '健康アドバイス',
    description: '読者の健康をサポートするためのアドバイス記事のテンプレートです。',
    systemMessage:
      'あなたは健康専門家です。読者が日常生活で実践できる健康維持のためのアドバイスを提供してください。具体的な方法やメリットを明確に説明し、読者が実行しやすいようにしてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 実用的で励みになる。
    トーン: 親しみやすく、信頼性がある。
    文字数: {contentLength} 字。
    日常生活で実践できる健康維持のための具体的なアドバイスを提供し、それぞれの方法やメリットを明確に説明してください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 5,
    tone: '丁寧',
    style: '実用的',
    contentLength: 1200,
    categoryName: '健康',
    tags: ['健康', 'アドバイス', 'ライフスタイル'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'travel-guide-template',
    name: '旅行ガイド',
    description: '特定の旅行先について詳細なガイドを作成するためのテンプレートです。',
    systemMessage:
      'あなたは経験豊富な旅行ガイドです。旅行先の魅力、観光スポット、食事、宿泊施設、交通手段などを詳細に紹介してください。読者が計画を立てやすいように、実用的な情報を提供してください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 詳細で情報豊富。
    トーン: 親しみやすく、役立つ。
    文字数: {contentLength} 字。
    旅行先の魅力、観光スポット、食事、宿泊施設、交通手段などを詳細に紹介し、読者が計画を立てやすいように実用的な情報を提供してください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 6,
    tone: '親しみやすい',
    style: '詳細',
    contentLength: 1500,
    categoryName: '旅行',
    tags: ['旅行', 'ガイド', '観光'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'recipe-template',
    name: 'レシピ記事',
    description: '料理のレシピを紹介するためのテンプレートです。',
    systemMessage:
      'あなたは料理専門家です。美味しい料理のレシピを分かりやすく紹介してください。材料、手順、コツを具体的に説明し、読者が簡単に再現できるようにしてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 分かりやすく具体的。
    トーン: 親切で励みになる。
    文字数: {contentLength} 字。
    料理のレシピを分かりやすく紹介し、材料、手順、コツを具体的に説明してください。読者が簡単に再現できるようにしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 5,
    tone: '親切',
    style: '具体的',
    contentLength: 1000,
    categoryName: '料理',
    tags: ['レシピ', '料理', 'グルメ'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'business-plan-template',
    name: 'ビジネスプラン',
    description: '新規事業のビジネスプランを作成するためのテンプレートです。',
    systemMessage:
      'あなたはビジネスアナリストです。新規事業のビジネスプランを詳細に作成してください。市場分析、競合分析、マーケティング戦略、財務計画などを具体的に記述し、実現可能性を高めるための提案を含めてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 詳細で分析的。
    トーン: 専門的で信頼性がある。
    文字数: {contentLength} 字。
    新規事業のビジネスプランを詳細に作成し、市場分析、競合分析、マーケティング戦略、財務計画などを具体的に記述してください。実現可能性を高めるための提案も含めてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 7,
    tone: '専門的',
    style: '分析的',
    contentLength: 2000,
    categoryName: 'ビジネス',
    tags: ['ビジネス', 'プランニング', '起業'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'social-media-post-template',
    name: 'ソーシャルメディア投稿',
    description: '効果的なソーシャルメディア投稿を作成するためのテンプレートです。',
    systemMessage:
      'あなたはソーシャルメディアマーケターです。ターゲットオーディエンスに響く効果的な投稿を作成してください。キャッチーなキャプション、適切なハッシュタグ、視覚的な要素を組み合わせて、エンゲージメントを高める内容にしてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 簡潔で魅力的。
    トーン: フレンドリーで活気がある。
    文字数: {contentLength} 字。
    ターゲットオーディエンスに響く効果的なソーシャルメディア投稿を作成し、キャッチーなキャプション、適切なハッシュタグ、視覚的な要素を組み合わせてください。エンゲージメントを高める内容にしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 3,
    tone: 'フレンドリー',
    style: '簡潔',
    contentLength: 300,
    categoryName: 'ソーシャルメディア',
    tags: ['ソーシャルメディア', 'マーケティング', 'SNS'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'ebook-template',
    name: '電子書籍',
    description: '電子書籍を作成するための包括的なテンプレートです。',
    systemMessage:
      'あなたは経験豊富な作家です。電子書籍の構成を詳細に計画し、各章の内容を明確にしてください。読者に価値を提供し、魅力的なストーリーや情報を提供するためのガイドラインを設定してください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 組織的で詳細。
    トーン: 教育的で魅力的。
    文字数: {contentLength} 字。
    電子書籍の構成を詳細に計画し、各章の内容を明確にしてください。読者に価値を提供し、魅力的なストーリーや情報を提供するためのガイドラインを設定してください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 10,
    tone: '教育的',
    style: '組織的',
    contentLength: 5000,
    categoryName: '電子書籍',
    tags: ['電子書籍', '執筆', '出版'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'resume-template',
    name: '履歴書テンプレート',
    description: 'プロフェッショナルな履歴書を作成するためのテンプレートです。',
    systemMessage:
      'あなたはキャリアコーチです。求職者が強みをアピールできるようなプロフェッショナルな履歴書を作成してください。経験、スキル、教育背景を明確かつ簡潔に記述し、採用担当者の目を引くレイアウトにしてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: プロフェッショナルで整理された。
    トーン: 自信に満ちた、明確。
    文字数: {contentLength} 字。
    プロフェッショナルな履歴書を作成し、経験、スキル、教育背景を明確かつ簡潔に記述してください。採用担当者の目を引くレイアウトにしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 5,
    tone: '自信',
    style: '整理された',
    contentLength: 800,
    categoryName: 'キャリア',
    tags: ['履歴書', 'キャリア', '職務経歴'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'newsletter-template',
    name: 'ニュースレター',
    description: '定期的なニュースレターを作成するためのテンプレートです。',
    systemMessage:
      'あなたはマーケティング専門家です。読者に価値のある情報を提供し、エンゲージメントを高めるニュースレターを作成してください。最新の情報、特典、イベントなどを効果的に組み合わせて、読者の関心を引きつけてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 親しみやすく、情報豊富。
    トーン: フレンドリーで励みになる。
    文字数: {contentLength} 字。
    読者に価値のある情報を提供し、エンゲージメントを高めるニュースレターを作成してください。最新の情報、特典、イベントなどを効果的に組み合わせて、読者の関心を引きつけてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 6,
    tone: 'フレンドリー',
    style: '情報豊富',
    contentLength: 1200,
    categoryName: 'マーケティング',
    tags: ['ニュースレター', 'マーケティング', 'コミュニケーション'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'product-launch-template',
    name: '新製品ローンチ',
    description: '新製品のローンチを効果的に宣伝するためのテンプレートです。',
    systemMessage:
      'あなたはプロダクトマネージャーです。新製品の特徴、利点、利用方法を明確に伝え、ターゲットオーディエンスの興味を引く宣伝資料を作成してください。マーケティング戦略や発売日などの重要な情報も含めてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 宣伝的で魅力的。
    トーン: 興奮を誘う、信頼性がある。
    文字数: {contentLength} 字。
    新製品の特徴、利点、利用方法を明確に伝え、ターゲットオーディエンスの興味を引く宣伝資料を作成してください。マーケティング戦略や発売日などの重要な情報も含めてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 5,
    tone: '興奮',
    style: '宣伝的',
    contentLength: 1000,
    categoryName: 'マーケティング',
    tags: ['新製品', 'ローンチ', 'プロモーション'],
    ownerId: null,
    createdAt: new Date(),
  },
];



const { MongoClient } = require('mongodb');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGODB_URL;
  const client = new MongoClient(uri, { useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE);
    const templatesCollection = db.collection('templates');

    // 既存のデフォルトテンプレートを削除
    //await templatesCollection.deleteMany({ ownerId: null });

    // 新しいテンプレートを挿入
    await templatesCollection.insertMany(defaultTemplates);

    console.log('デフォルトテンプレートの挿入が完了しました。');
  } catch (error) {
    console.error('テンプレート挿入中にエラーが発生しました:', error);
  } finally {
    await client.close();
  }
})();