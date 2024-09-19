const defaultTemplates = [
  {
    name: 'デフォルトテンプレート',
    description: '標準的なブログ記事のテンプレートです。',
    systemMessage: 'あなたは経験豊富なブロガーです。簡潔でシンプルな文章を提供してください。有名人の名前や虚偽の情報は含めないでください。',
    generatePrompt: `
{message}
記事タイトル: "{fetchTitle}"。
メインテーマ: {botDescription}。
対象読者: {targetAudience}。
カテゴリー: {articleCategories}。
言語: {postLanguage}。
スタイル: {writingStyle}。
トーン: {writingTone}。
文字数: {articleLength} 字。
簡潔でシンプルな表現を心がけてください。Markdown形式で書いてください。`,
    isPublic: true,
    ownerId: null,
    createdAt: new Date(),
  },
  {
    name: 'カジュアルテンプレート',
    description: '親しみやすくカジュアルな文体のテンプレートです。',
    systemMessage: 'あなたは友好的なブロガーです。カジュアルで会話的なスタイルで書いてください。専門用語は避け、シンプルな言葉を使ってください。',
    generatePrompt: `
{message}
タイトル: "{fetchTitle}"。
テーマ: {botDescription}。
読者: {targetAudience}。
スタイル: カジュアルで会話的。
トーン: フレンドリーで親しみやすい。
文字数: {articleLength} 字。
個人的なエピソードやユーモアを交えてください。Markdown形式で書いてください。`,
    isPublic: true,
    ownerId: null,
    createdAt: new Date(),
  },
  {
    name: 'テクニカルテンプレート',
    description: '専門的で技術的な文体のテンプレートです。',
    systemMessage: 'あなたは技術ライターです。正確で詳細な情報を提供してください。専門用語を適切に使用し、事実に基づいた記述を行ってください。',
    generatePrompt: `
{message}
タイトル: "{fetchTitle}"。
メインテーマ: {botDescription}。
対象読者: {targetAudience}。
スタイル: フォーマルで技術的。
トーン: プロフェッショナルで情報豊富。
文字数: {articleLength} 字。
データや統計、参考資料を含めてください。Markdown形式で書いてください。`,
    isPublic: true,
    ownerId: null,
    createdAt: new Date(),
  },
  {
    name: '物語風テンプレート',
    description: '物語性のある文体で読者を引き込むテンプレートです。',
    systemMessage: 'あなたはストーリーテラーです。魅力的で感情に訴える文章を書いてください。読者を物語の中に引き込み、共感を呼び起こしてください。',
    generatePrompt: `
{message}
タイトル: "{fetchTitle}"。
テーマ: {botDescription}。
読者: {targetAudience}。
スタイル: 物語風。
トーン: エモーショナルで魅力的。
文字数: {articleLength} 字。
物語を通してメッセージを伝えてください。Markdown形式で書いてください。`,
    isPublic: true,
    ownerId: null,
    createdAt: new Date(),
  },
  {
    name: 'ニューステンプレート',
    description: 'ニュース記事風のテンプレートです。',
    systemMessage: 'あなたはジャーナリストです。客観的で事実に基づいた情報を提供してください。偏見のない、公正な視点で書いてください。',
    generatePrompt: `
{message}
タイトル: "{fetchTitle}"。
メインテーマ: {botDescription}。
対象読者: {targetAudience}。
スタイル: ニュース記事風。
トーン: 客観的で中立的。
文字数: {articleLength} 字。
重要な情報を明確かつ簡潔に伝えてください。Markdown形式で書いてください。`,
    isPublic: true,
    ownerId: null,
    createdAt: new Date(),
  },
];

const { MongoClient } = require('mongodb');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGODB_URL; // MongoDBの接続文字列をここに記入
  const client = new MongoClient(uri, { useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE); // 使用するデータベース名
    const templatesCollection = db.collection('templates');

    // 既存のデフォルトテンプレートを削除（必要に応じて）
    // await templatesCollection.deleteMany({ ownerId: null });

    // テンプレートを挿入
    await templatesCollection.insertMany(defaultTemplates);

    console.log('デフォルトテンプレートの挿入が完了しました。');
  } catch (error) {
    console.error('テンプレート挿入中にエラーが発生しました:', error);
  } finally {
    await client.close();
  }
})();
