// article.js
const { z } = require('zod');
const { moduleCompletion } = require('./openai.js');

const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT, template) => {
  // Use template properties or default values
  const sections = template?.sections || 3;
  const tone = template?.tone || blogInfo.writingTone || 'Neutral';
  const style = template?.style || blogInfo.writingStyle || 'Informative';
  const contentLength = template?.contentLength || blogInfo.articleLength || 1500;
  const categoryName = template?.categoryName || blogInfo.articleCategories || '';
  const tags = template?.tags?.length ? template.tags : blogInfo.postTags || [];
  const articleStructure = template?.articleStructure
    ? JSON.parse(template.articleStructure)
    : { sections: sections };

  const systemMessage =
    template?.systemMessage ||
    'あなたはプロのライターです。明確で簡潔、そして論理的な記事を書いてください。挨拶や締めの言葉、個人的な意見、AIモデルであることの言及は含めないでください。';

  const generatePromptTemplate =
    template?.generatePrompt || `{message}`;

  const generatePrompt = (message) => {
    return generatePromptTemplate
      .replace('{message}', message)
      .replace('{fetchTitle}', fetchTitle)
      .replace('{botDescription}', blogInfo.botDescription || '')
      .replace('{targetAudience}', blogInfo.targetAudience || '')
      .replace('{categoryName}', categoryName)
      .replace('{postLanguage}', blogInfo.postLanguage || '日本語')
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
      `タイトル「${fetchTitle}」に基づいて、記事の${sections}つの見出しを提供してください。見出しは簡潔で情報豊かにし、番号や箇条書きは使用しないでください。各見出しは異なる側面をカバーしてください。`
    );
    const messages = createMessages(prompt);
    const response = await moduleCompletion({ model: modelGPT, messages, max_tokens: 150 });
    const headlines = response
      .trim()
      .split('\n')
      .map(line => line.trim().replace(/^#+\s*/, ''))
      .filter(line => line !== '');
    if (headlines.length < sections) {
      throw new Error('十分な見出しを生成できませんでした。');
    } else if (headlines.length > sections) {
      return headlines.slice(0, sections);
    }
    return headlines;
  };

  const generateContentForSection = async (headline) => {
    const prompt = generatePrompt(
      `見出し「${headline}」に対して、詳細で情報豊富なセクションを書いてください。セクションは約${Math.floor(contentLength / sections)}文字にしてください。トーンは${tone}、スタイルは${style}でお願いします。挨拶や結論、他のセクションへの言及は含めないでください。`
    );
    const messages = createMessages(prompt);
    const content = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: 500,
    });
    return content.trim();
  };

  const generateIntroduction = async (headlines) => {
    const prompt = generatePrompt(
      `記事「${fetchTitle}」の魅力的なイントロダクションを書いてください。イントロではトピックの概要を説明し、以下の見出しでカバーする主なポイントに軽く触れてください。\n見出し: ${headlines.join('、')}\nトーンは${tone}、スタイルは${style}でお願いします。挨拶や謝罪は含めないでください。`
    );
    const messages = createMessages(prompt);
    const introduction = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: 200,
    });
    return introduction.trim();
  };

  const generateConclusion = async () => {
    const prompt = generatePrompt(
      `記事「${fetchTitle}」の簡潔な結論を書いてください。結論では主なポイントを要約し、最後の考察を提供してください。トーンは${tone}、スタイルは${style}でお願いします。新しい情報や締めの挨拶は含めないでください。`
    );
    const messages = createMessages(prompt);
    const conclusion = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: 200,
    });
    return conclusion.trim();
  };

  // Generate the article step by step
  console.log(`Generating Headlines`);
  const headlines = await getHeadlines();

  console.log(`Generating Introduction`);
  const introduction = await generateIntroduction(headlines);

  let articleContent = `# ${fetchTitle}\n\n${introduction}`;

  console.log(`Generating Content for Each Section`);
  for (const headline of headlines) {
    const sectionContent = await generateContentForSection(headline);
    articleContent += `\n\n## ${headline}\n\n${sectionContent}`;
  }

  console.log(`Generating Conclusion`);
  const conclusion = await generateConclusion();
  articleContent += `\n\n${conclusion}`;

  console.log(`Article Generation Complete`);
  return articleContent;
};

module.exports = { generateCompleteArticle };
