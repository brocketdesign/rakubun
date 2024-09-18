// article.js
const { z } = require('zod');
const { moduleCompletion } = require('./openai.js');

const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT) => {
  const generatePrompt = (message) => {
    return `${message}\n記事タイトル: "${fetchTitle}"。\nメインテーマ: ${blogInfo.botDescription}。\n対象読者: ${blogInfo.targetAudience}。\nカテゴリー: ${blogInfo.articleCategories}。\n言語: ${blogInfo.postLanguage}。\nスタイル: ${blogInfo.writingStyle}。\nトーン: ${blogInfo.writingTone}。\n文字数: ${blogInfo.articleLength} 字。\n簡単な表現、シンプルな言葉を使用してください。ブロガーのトーンを保ってください。有名人の名前は、明示的に求められない限り避けてください。\nMarkdownでフォーマットを行ってください。`;
  };

  const getHeadlines = async () => {
    const prompt = generatePrompt(
      `以下のタイトルに基づいて、記事を構成する3つの短い見出しを提供してください。見出しは簡潔で魅力的なものにしてください。`
    );
    const messages = [
      {
        role: 'system',
        content:
          'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。チャプターやサブチャプター、各タイトルの番号付け、有名人の名前は含めないでください。実在する人物を含む虚偽の物語を作らないでください。',
      },
      { role: 'user', content: prompt },
    ];
    const response = await moduleCompletion(
      { model: modelGPT, messages, max_tokens: 200 },
      null
    );
    // Split the response into headlines
    const headlines = response
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(0, 3);
    return headlines;
  };

  const generateContentForSection = async (headline, previousContent) => {
    const contentPrompt = generatePrompt(
      `これまでの内容:\n${previousContent}\n\n次の見出しに基づいて、500文字以内で新しい段落を生成してください。\n見出し: "${headline}"。\n既に書かれている内容を繰り返さず、新しい情報を提供してください。見出しや結論、サブチャプターは含めないでください。`
    );
    const contentPrompt_messages = [
      {
        role: 'system',
        content:
          'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。チャプターやサブチャプター、各タイトルの番号付け、有名人の名前は含めないでください。実在する人物を含む虚偽の物語を作らないでください。',
      },
      { role: 'user', content: contentPrompt },
    ];
    const content = await moduleCompletion({
      model: modelGPT,
      messages: contentPrompt_messages,
      max_tokens: 500,
    });
    return content.trim();
  };

  const generateIntroduction = async (headlines) => {
    const introPrompt = generatePrompt(
      `次の見出しに基づいて、1段落で短いブログ記事のイントロダクションを作成してください。\n見出し: ${headlines.join(
        ', '
      )}`
    );
    const introPrompt_messages = [
      {
        role: 'system',
        content:
          'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。チャプターやサブチャプター、各タイトルの番号付け、有名人の名前は含めないでください。実在する人物を含む虚偽の物語を作らないでください。',
      },
      { role: 'user', content: introPrompt },
    ];
    const introduction = await moduleCompletion({
      model: modelGPT,
      messages: introPrompt_messages,
      max_tokens: 300,
    });
    return introduction.trim();
  };

  const generateConclusion = async (articleContent) => {
    const conclusionPrompt = generatePrompt(
      `これまでの内容に基づいて、ブログ記事の結論を作成してください。`
    );
    const conclusionPrompt_messages = [
      {
        role: 'system',
        content:
          'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。有名人の名前は含めないでください。実在する人物を含む虚偽の物語を作らないでください。',
      },
      { role: 'user', content: conclusionPrompt },
    ];
    const conclusion = await moduleCompletion({
      model: modelGPT,
      messages: conclusionPrompt_messages,
      max_tokens: 300,
    });
    return conclusion.trim();
  };

  const rewriteArticle = async (articleContent, headlines) => {
    const rewritePrompt = generatePrompt(
      `以下の内容と構造に基づいて、記事全体を見直し、見出しも含めて書き直してください。\n記事の内容:\n${articleContent}\n記事の構造:\n${headlines.join(
        ', '
      )}\n繰り返しを避け、新しい視点で書き直してください。`
    );
    const rewritePrompt_messages = [
      {
        role: 'system',
        content:
          'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。有名人の名前は含めないでください。実在する人物を含む虚偽の物語を作らないでください。',
      },
      { role: 'user', content: rewritePrompt },
    ];
    const rewrittenArticle = await moduleCompletion({
      model: modelGPT,
      messages: rewritePrompt_messages,
      max_tokens: 1500,
    });
    return rewrittenArticle.trim();
  };

  // Generate the article step by step
  console.log(`Generating Headlines`);
  const headlines = await getHeadlines();

  console.log(`Generating Introduction`);
  const introduction = await generateIntroduction(headlines);

  let articleContent = `# ${fetchTitle}\n\n${introduction}`;

  console.log(`Generating Content for Each Section`);
  for (const headline of headlines) {
    const sectionContent = await generateContentForSection(headline, articleContent);
    articleContent += `\n\n## ${headline}\n\n${sectionContent}`;
  }

  console.log(`Generating Conclusion`);
  const conclusion = await generateConclusion(articleContent);
  articleContent += `\n\n${conclusion}`;

  console.log(`Rewriting the Entire Article`);
  const finalArticle = await rewriteArticle(articleContent, headlines);

  return finalArticle;
};

module.exports = { generateCompleteArticle };
