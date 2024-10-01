const defaultTemplates = [
  {
    templateId: "casual-blog-post",
    name: "カジュアルブログ投稿",
    description: "読者と親しみやすいトーンでカジュアルなブログ投稿を作成します。",
    systemMessage:
      "あなたは経験豊富なブロガーです。読者と親しみやすいトーンで、魅力的で情報豊富なカジュアルなブログ投稿を書いてください。",
    titleGenerationPrompt:
      "{botDescription}を考慮して、魅力的でキャッチーなブログのタイトルを生成してください。",
    generatePrompt:
      "以下の情報を基に、カジュアルなブログ投稿を作成してください。\n\nシステムメッセージ: {systemMessage}\nボットの説明: {botDescription}\nカテゴリ: {categoryName}\nトーン: {tone}\nスタイル: {style}\nターゲット言語: {postLanguage}\n長さ: {contentLength}文字\n構成: {articleStructure}\n\n{message}",
    sections: 3,
    tone: "カジュアル",
    style: "会話的",
    contentLength: 10000,
    categoryName: ["ライフスタイル"],
    tags: ["ブログ", "カジュアル", "ライフスタイル"],
    isPublic: true,
    articleStructure: {
      sections: 3,
      headings: [
        { heading: "イントロダクション", contentLength: 3000 },
        { heading: "主な内容", contentLength: 4000 },
        { heading: "結論", contentLength: 3000 },
      ],
    },
  },
  {
    templateId: "movie-presentation",
    name: "映画紹介",
    description: "新作映画の魅力を伝えるための紹介記事を作成します。",
    systemMessage:
      "あなたは映画評論家です。新作映画の魅力を伝えるための詳細で魅力的な紹介記事を書いてください。",
    titleGenerationPrompt:
      "{botDescription}に基づいて、映画の魅力を引き出すタイトルを生成してください。",
    generatePrompt:
      "以下の情報を基に、映画紹介記事を作成してください。\n\nシステムメッセージ: {systemMessage}\nボットの説明: {botDescription}\nカテゴリ: {categoryName}\nトーン: {tone}\nスタイル: {style}\nターゲット言語: {postLanguage}\n長さ: {contentLength}文字\n構成: {articleStructure}\n\n{message}",
    sections: 4,
    tone: "情報豊富",
    style: "解説的",
    contentLength: 10000,
    categoryName: ["映画"],
    tags: ["映画紹介", "レビュー", "新作映画"],
    isPublic: true,
    articleStructure: {
      sections: 4,
      headings: [
        { heading: "映画の概要", contentLength: 2500 },
        { heading: "ストーリーとテーマ", contentLength: 2500 },
        { heading: "キャストと演技", contentLength: 2500 },
        { heading: "結論と評価", contentLength: 2500 },
      ],
    },
  },
  {
    templateId: "news-presentation",
    name: "ニュース記事",
    description: "最新のニュースを正確かつ迅速に伝えるための記事を作成します。",
    systemMessage:
      "あなたは信頼できるニュース記者です。最新のニュースを正確かつ迅速に伝える記事を書いてください。",
    titleGenerationPrompt:
      "{botDescription}を考慮して、ニュースの重要性を反映したタイトルを生成してください。",
    generatePrompt:
      "以下の情報を基に、ニュース記事を作成してください。\n\nシステムメッセージ: {systemMessage}\nボットの説明: {botDescription}\nカテゴリ: {categoryName}\nトーン: {tone}\nスタイル: {style}\nターゲット言語: {postLanguage}\n長さ: {contentLength}文字\n構成: {articleStructure}\n\n{message}",
    sections: 5,
    tone: "客観的",
    style: "報道的",
    contentLength: 10000,
    categoryName: ["ニュース"],
    tags: ["最新ニュース", "報道", "ニュース記事"],
    isPublic: true,
    articleStructure: {
      sections: 5,
      headings: [
        { heading: "見出し", contentLength: 2000 },
        { heading: "導入", contentLength: 2000 },
        { heading: "詳細情報", contentLength: 2000 },
        { heading: "影響と反応", contentLength: 2000 },
        { heading: "まとめ", contentLength: 2000 },
      ],
    },
  },
  {
    templateId: "book-presentation",
    name: "書籍紹介",
    description: "新刊や注目の書籍を魅力的に紹介する記事を作成します。",
    systemMessage:
      "あなたは書籍レビュアーです。新刊や注目の書籍を魅力的に紹介する記事を書いてください。",
    titleGenerationPrompt:
      "{botDescription}に基づいて、書籍の魅力を伝えるタイトルを生成してください。",
    generatePrompt:
      "以下の情報を基に、書籍紹介記事を作成してください。\n\nシステムメッセージ: {systemMessage}\nボットの説明: {botDescription}\nカテゴリ: {categoryName}\nトーン: {tone}\nスタイル: {style}\nターゲット言語: {postLanguage}\n長さ: {contentLength}文字\n構成: {articleStructure}\n\n{message}",
    sections: 4,
    tone: "説得的",
    style: "解説的",
    contentLength: 10000,
    categoryName: ["書籍"],
    tags: ["書籍紹介", "レビュー", "新刊"],
    isPublic: true,
    articleStructure: {
      sections: 4,
      headings: [
        { heading: "書籍の概要", contentLength: 2500 },
        { heading: "ストーリーとテーマ", contentLength: 2500 },
        { heading: "著者の背景とスタイル", contentLength: 2500 },
        { heading: "結論と推奨", contentLength: 2500 },
      ],
    },
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