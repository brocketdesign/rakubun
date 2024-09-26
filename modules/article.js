// article.js
const { z } = require('zod');
const { moduleCompletion } = require('./openai.js');

const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT, template) => {
  // Use template properties or default values
  const sections = template?.sections || 3;
  const tone = template?.tone || blogInfo.writingTone;
  const style = template?.style || blogInfo.writingStyle;
  const contentLength = template?.contentLength || blogInfo.articleLength;
  const categoryName = template?.categoryName || blogInfo.articleCategories;
  const tags = template?.tags?.length ? template.tags : blogInfo.postTags || [];
  const articleStructure = template?.articleStructure
    ? JSON.parse(template.articleStructure)
    : { sections: sections };

  const systemMessage =
    template?.systemMessage ||
    'あなたは熟練したブロガーです。簡潔でシンプルな文章を提供してください。有名人の名前は含めないでください。';

  const generatePromptTemplate =
    template?.generatePrompt || `{message} ...`;

  const generatePrompt = (message) => {
    return generatePromptTemplate
      .replace('{message}', message)
      .replace('{fetchTitle}', fetchTitle)
      .replace('{botDescription}', blogInfo.botDescription)
      .replace('{targetAudience}', blogInfo.targetAudience)
      .replace('{categoryName}', categoryName)
      .replace('{postLanguage}', blogInfo.postLanguage)
      .replace('{style}', style)
      .replace('{tone}', tone)
      .replace('{contentLength}', contentLength)
      .replace('{articleStructure}', template?.articleStructure || '');
  };

  const createMessages = (prompt) => [
    {
      role: 'system',
      content: systemMessage,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  // Adjusted functions to use new properties
  const getHeadlines = async () => {
    const prompt = generatePrompt(
      `以下のタイトルに基づいて、記事を構成する${articleStructure.sections}つの短い見出しを提供してください。見出しは次の構成に従ってください: ${articleStructure.headings?.join(
        ', '
      ) || ''}.`
    );
    const messages = createMessages(prompt);
    const response = await moduleCompletion({ model: modelGPT, messages, max_tokens: 200 });
    const headlines = response
      .trim()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(0, articleStructure.sections);
    return headlines;
  };

  const generateContentForSection = async (headline, previousContent) => {
    const contentPrompt = generatePrompt(
      `これまでの内容:\n${previousContent}\n\n次の見出しに基づいて、${
        contentLength / sections
      }文字以内で新しい段落を生成してください。\n見出し: "${headline}"。\nトーン: ${tone}。\nスタイル: ${style}。\n既に書かれている内容を繰り返さず、新しい情報を提供してください。見出しや結論、サブチャプターは含めないでください。`
    );
    const contentPrompt_messages = createMessages(contentPrompt);
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
      )}\nトーン: ${tone}。\nスタイル: ${style}。`
    );
    const introPrompt_messages = createMessages(introPrompt);
    const introduction = await moduleCompletion({
      model: modelGPT,
      messages: introPrompt_messages,
      max_tokens: 300,
    });
    return introduction.trim();
  };

  const generateConclusion = async (articleContent) => {
    const conclusionPrompt = generatePrompt(
      `これまでの内容に基づいて、ブログ記事の結論を作成してください。トーン: ${tone}。\nスタイル: ${style}。`
    );
    const conclusionPrompt_messages = createMessages(conclusionPrompt);
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
      )}\nトーン: ${tone}。\nスタイル: ${style}。\n繰り返しを避け、新しい視点で書き直してください。`
    );
    const rewritePrompt_messages = createMessages(rewritePrompt);
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
