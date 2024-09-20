const defaultTemplates = [
  {
    templateId: 'default-template',
    name: 'デフォルトテンプレート',
    description: '標準的なブログ記事のテンプレートです。',
    systemMessage:
      'あなたは経験豊富なブロガーです。簡潔でシンプルな文章を提供してください。有名人の名前や虚偽の情報は含めないでください。',
    generatePrompt: `
{message}
記事タイトル: "{fetchTitle}"。
メインテーマ: {botDescription}。
対象読者: {targetAudience}。
カテゴリー: {categoryName}。
言語: {postLanguage}。
スタイル: {style}。
トーン: {tone}。
文字数: {contentLength} 字。
簡潔でシンプルな表現を心がけてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 3,
    tone: '中立的',
    style: '標準',
    contentLength: 1000,
    categoryName: '一般',
    tags: [],
    ownerId: null,
    createdAt: new Date(),
  },
  {
    templateId: 'casual-template',
    name: 'カジュアルテンプレート',
    description: '親しみやすくカジュアルな文体のテンプレートです。',
    systemMessage:
      'あなたは友好的なブロガーです。カジュアルで会話的なスタイルで書いてください。専門用語は避け、シンプルな言葉を使ってください。',
    generatePrompt: `
{message}
タイトル: "{fetchTitle}"。
テーマ: {botDescription}。
読者: {targetAudience}。
スタイル: カジュアルで会話的。
トーン: フレンドリーで親しみやすい。
文字数: {contentLength} 字。
個人的なエピソードやユーモアを交えてください。Markdown形式で書いてください。`,
    isPublic: true,
    sections: 3,
    tone: 'フレンドリー',
    style: 'カジュアル',
    contentLength: 800,
    categoryName: 'ライフスタイル',
    tags: ['カジュアル', '親しみやすい'],
    ownerId: null,
    createdAt: new Date(),
  },
  // 他のテンプレートも同様に追加
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
    await templatesCollection.deleteMany({ ownerId: null });

    // 新しいテンプレートを挿入
    await templatesCollection.insertMany(defaultTemplates);

    console.log('デフォルトテンプレートの挿入が完了しました。');
  } catch (error) {
    console.error('テンプレート挿入中にエラーが発生しました:', error);
  } finally {
    await client.close();
  }
})();