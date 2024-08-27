const { z } = require("zod");
const { moduleCompletion } = require('./openai.js');

const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT) => {
    let PossibleAnswersExtraction = z.object({
        answers: z.array(z.string()),
    });

    // Define the content prompt generator function
    const contentPromptGenHeadLine = (fetchTitle, blogInfo) => {
        return `
        Return 3 headlines : 
        # 目的：ブログ記事のトピックを考える
        # 命令文：${fetchTitle}
        # 条件：各アイデアは一文で簡潔に説明してください。
        # 補足：${blogInfo.botDescription}
        # 出力形式：番号付きリスト
    `;
    }
    // Get the headlines
    const promptDataHeadlines = contentPromptGenHeadLine(fetchTitle, blogInfo);
    const headlines = await moduleCompletion(
      { model: modelGPT, prompt: promptDataHeadlines, max_tokens: 100 },
      PossibleAnswersExtraction
    );
  
    const selectedHeadlines = headlines.slice(0, 3); // Get the first 3 headlines

    const contentPromptGen = (message, blogInfo) => {
        return `
            ${message}
            記事タイトル: "${fetchTitle}"。
            メインテーマ: ${blogInfo.botDescription}。
            対象読者: ${blogInfo.targetAudience}。
            カテゴリー: ${blogInfo.articleCategories}。
            言語: ${blogInfo.postLanguage}。
            スタイル: ${blogInfo.writingStyle}、
            トーン: ${blogInfo.writingTone}。
            文字数は ${blogInfo.articleLength} 字です。
            簡単な表現、シンプルな言葉を使用してください。ブロガーのトーンを保ってください。有名人の名前は、明示的に求められない限り避けてください。
            Markdownでフォーマットを行ってください。
        `;
    }    
    
    const generateIntroduction = async (headlines) => {
      const promptDataIntro = contentPromptGen(`次の見出しに基づいて、ブログ記事のイントロを生成してください: ${headlines.join(", ")}`, blogInfo);
      const introContent = await moduleCompletion(
        { model: modelGPT, prompt: promptDataIntro, max_tokens: 300 }
      );
      return introContent;
    };
    const getArticleContent = async (headline) => {
        const promptDataContent = contentPromptGen(`以下の見出しに基づいて、深く掘り下げたブログ記事の内容を生成してください。「${headline}」. DO NOT INCLUDE THE HEADLINE IN YOUR ANSWER.`, blogInfo);
        const articleContent = await moduleCompletion(
          { model: modelGPT, prompt: promptDataContent, max_tokens: 800 }
        );
        return articleContent;
    };
    const generateConclusion = async (articleBody) => {
      const promptDataConclusion = contentPromptGen(`次の内容に基づいて、ブログ記事の結論を生成してください: ${articleBody}`, blogInfo);
      const conclusionContent = await moduleCompletion(
        { model: modelGPT, prompt: promptDataConclusion, max_tokens: 300 }
      );
      return conclusionContent;
    };
  
    
    const introduction = await generateIntroduction(selectedHeadlines);
    const contentPromises = selectedHeadlines.map(async (headline) => {
      const content = await getArticleContent(headline);
      return `### ${headline}\n\n${content}`;
    });
    const articleBody = (await Promise.all(contentPromises)).join("\n\n");
    const conclusion = await generateConclusion(articleBody);
  
    const completeArticle = `
    ${introduction}
  
    ${articleBody}
  
    ${conclusion}
    `;
  
    return completeArticle.trim(); // Trim any extra spaces
};
  
  module.exports = { generateCompleteArticle }