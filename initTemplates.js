const defaultTemplates = [
  {
    templateId: 'event-invitation-template',
    name: 'イベント招待状',
    description: '特別なイベントのための招待状を作成するテンプレートです。出席者を引きつける内容を重視しています。',
    systemMessage:
      'あなたはイベントプランナーです。招待状にはイベントのテーマ、日時、場所、特別ゲストを明確に記載し、参加意欲を高める文言を使用してください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 明確でインパクトのある文体。
    トーン: 楽しさと期待感を持たせる表現。
    文字数: {contentLength} 字。
    招待状に必要な情報を魅力的にまとめ、参加者がイベントに参加したくなるようにしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 4,
    tone: '楽しさ',
    style: 'インパクト',
    contentLength: 600,
    categoryName: 'イベント',
    tags: ['イベント', '招待状', 'プランニング'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'product-review-template',
    name: '製品レビュー',
    description: '製品の特徴と実績を詳しく紹介するためのテンプレートです。客観的な視点からの評価を重視しています。',
    systemMessage:
      'あなたは製品レビュアーです。特徴、利点、欠点を明確に説明し、読者が購入判断をしやすい情報を提供してください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 詳細で客観的な評価。
    トーン: 正直で信頼性のある表現。
    文字数: {contentLength} 字。
    製品の特徴と実績を詳細に述べ、読者が信頼できる情報を得られるようにしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 5,
    tone: '正直',
    style: '客観的',
    contentLength: 1200,
    categoryName: 'レビュー',
    tags: ['レビュー', '製品', '評価'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'case-study-template',
    name: 'ケーススタディ',
    description: 'ビジネスの成功事例を詳細に分析するためのテンプレートです。実績に基づいたデータを強調します。',
    systemMessage:
      'あなたはビジネスアナリストです。特定のプロジェクトの背景、課題、解決策、成果を具体的に記述してください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 分析的でデータ重視。
    トーン: 専門的で信頼性の高い表現。
    文字数: {contentLength} 字。
    プロジェクトの背景や成果を詳しく分析し、具体的なデータを交えて読者にインサイトを提供してください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 6,
    tone: '専門的',
    style: 'データ重視',
    contentLength: 1500,
    categoryName: 'ビジネス',
    tags: ['ケーススタディ', 'ビジネス', '成功事例'],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'email-newsletter-template',
    name: 'メールニュースレター',
    description: '読者に価値ある情報を提供するためのメールニュースレター作成テンプレートです。エンゲージメントを重視します。',
    systemMessage:
      'あなたはコンテンツクリエイターです。最新情報や特典を魅力的にまとめて、読者の関心を引きつけてください。',
    generatePrompt: `
    {message}
    タイトル: "{fetchTitle}"。
    テーマ: {botDescription}。
    読者: {targetAudience}。
    スタイル: 明瞭で実用的。
    トーン: 情報提供に特化した表現。
    文字数: {contentLength} 字。
    読者に価値のある情報を明瞭に伝え、エンゲージメントを高める内容にしてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 6,
    tone: '情報提供',
    style: '実用的',
    contentLength: 1200,
    categoryName: 'マーケティング',
    tags: ['ニュースレター', 'マーケティング', 'コミュニケーション'],
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