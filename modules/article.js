// article.js
const { z } = require('zod');
const { moduleCompletion } = require('./openai.js');

/**
 * Generates a complete article based on the provided template.
 *
 * @param {string} fetchTitle - The title of the article.
 * @param {object} blogInfo - Additional blog information.
 * @param {string} modelGPT - The GPT model to use.
 * @param {object} template - The template object containing structure and prompts.
 * @returns {Promise<string>} - The complete article.
 */
const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT, template) => {
  // Validate the template structure
  if (!template || !template.articleStructure || !Array.isArray(template.articleStructure.headings)) {
    throw new Error('Invalid template structure. Ensure that articleStructure.headings is an array.');
  }

  // Destructure template properties with fallbacks
  const {
    tone = template.tone || 'Neutral',
    style = template.style || 'Informative',
    contentLength = template.contentLength || 1500,
    categoryName = template.categoryName || '',
    tags = template.tags?.length ? template.tags : blogInfo.postTags || [],
    articleStructure: {
      sections = template.sections || 3,
      headings = [],
    } = {},
    systemMessage = template.systemMessage || 'あなたはプロのライターです。明確で簡潔、そして論理的な記事を書いてください。重複や繰り返しを避け、一貫性のある内容を提供してください。挨拶や締めの言葉、個人的な意見、AIモデルであることの言及は含めないでください。',
    generatePrompt: generatePromptTemplate = template.generatePrompt || `{message}`,
  } = template;

  // Calculate total content length for introduction and conclusion
  const totalSectionContentLength = headings.reduce((sum, heading) => sum + (heading.contentLength || Math.floor(contentLength / sections)), 0);
  const introLength = Math.max(Math.floor(contentLength * 0.1), 1000); // Ensure intro is at least 600
  const conclusionLength = Math.max(Math.floor(contentLength * 0.1), 1000); // Ensure conclusion is at least 600  
  const bodyLength = contentLength - introLength - conclusionLength;

  // Function to generate the prompt based on the template
  const generatePrompt = (message, additionalReplacements = {}) => {
    let prompt = generatePromptTemplate
      .replace('{message}', message)
      .replace('{fetchTitle}', fetchTitle)
      .replace('{botDescription}', blogInfo.botDescription || '')
      .replace('{targetAudience}', blogInfo.targetAudience || '')
      .replace('{categoryName}', categoryName)
      .replace('{postLanguage}', blogInfo.postLanguage || '日本語')
      .replace('{style}', style)
      .replace('{tone}', tone)
      .replace('{contentLength}', contentLength)
      .replace('{articleStructure}', JSON.stringify(headings));

    // Apply any additional replacements
    for (const [key, value] of Object.entries(additionalReplacements)) {
      prompt = prompt.replace(`{${key}}`, value);
    }

    return prompt;
  };

  // Function to create messages for OpenAI API
  const createMessages = (prompt, previousMessages = []) => {
    const messages = [
      {
        role: 'system',
        content: systemMessage,
      },
      ...previousMessages,
      {
        role: 'user',
        content: prompt,
      },
    ];
    return messages;
  };

  // Function to generate the introduction
  const generateIntroduction = async () => {
    const prompt = generatePrompt(
      `記事「${fetchTitle}」の魅力的なイントロダクションを書いてください。イントロではトピックの概要を説明し、以下の見出しでカバーする主なポイントに軽く触れてください。\n見出し: ${headings.map(h => h.heading).join('、')}\nトーンは${tone}、スタイルは${style}でお願いします。挨拶や謝罪は含めないでください。`
    );
    const messages = createMessages(prompt);
    const introduction = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: Math.ceil(introLength / 5), // Approx tokens (assuming ~5 chars/token)
    });
    return introduction.trim();
  };

  // Function to generate content for each section
  const generateSectionContent = async (headingObj, accumulatedContent) => {
    const { heading, contentLength: sectionLength = Math.max(Math.floor(contentLength / sections), 2000) } = headingObj;
    const prompt = generatePrompt(
      `見出し「${heading}」に対して、詳細で情報豊富なセクションを書いてください。セクションは約${sectionLength}文字にしてください。トーンは${tone}、スタイルは${style}でお願いします。これまでの内容と重複しないようにしてください。挨拶や結論、他のセクションへの言及は含めないでください。`
    );
    const previousMessages = accumulatedContent
      ? [
          {
            role: 'assistant',
            content: accumulatedContent,
          },
        ]
      : [];
    const messages = createMessages(prompt, previousMessages);
    const content = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: Math.ceil(sectionLength / 5), // Approx tokens
    });
    return content.trim();
  };

  // Function to generate the conclusion
  const generateConclusion = async (articleContent) => {
    const prompt = generatePrompt(
      `これまでの記事内容を考慮して、記事「${fetchTitle}」の簡潔な結論を書いてください。結論では主なポイントを要約し、最後の考察を提供してください。トーンは${tone}、スタイルは${style}でお願いします。新しい情報や締めの挨拶は含めないでください。`
    );
    const previousMessages = [
      {
        role: 'assistant',
        content: articleContent,
      },
    ];
    const messages = createMessages(prompt, previousMessages);
    const conclusion = await moduleCompletion({
      model: modelGPT,
      messages,
      max_tokens: Math.ceil(conclusionLength / 5), // Approx tokens
    });
    return conclusion.trim();
  };

  // Start generating the article
  console.log(`Generating Introduction`);
  const introduction = await generateIntroduction();

  let articleContent = `# ${fetchTitle}\n\n${introduction}`;
  let accumulatedContent = introduction;

  console.log(`Generating Content for Each Section`);
  for (const headingObj of headings) {
    const sectionContent = await generateSectionContent(headingObj, accumulatedContent);
    articleContent += `\n\n## ${headingObj.heading}\n\n${sectionContent}`;
    accumulatedContent += `\n\n${sectionContent}`;
  }

  console.log(`Generating Conclusion`);
  const conclusion = await generateConclusion(accumulatedContent);
  articleContent += `\n\n## 結論\n\n${conclusion}`;

  console.log(`Article Generation Complete`);
  return articleContent;
};

module.exports = { generateCompleteArticle };
