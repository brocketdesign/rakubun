const { z } = require("zod");
const { moduleCompletion } = require('./openai.js');

const generateCompleteArticle = async (fetchTitle, blogInfo, modelGPT) => {
    const PossibleAnswersExtraction = z.object({
        answers: z.array(z.string()),
    });

    const generatePrompt = (message) => `${message}\n記事タイトル: "${fetchTitle}"。\nメインテーマ: ${blogInfo.botDescription}。\n対象読者: ${blogInfo.targetAudience}。\nカテゴリー: ${blogInfo.articleCategories}。\n言語: ${blogInfo.postLanguage}。\nスタイル: ${blogInfo.writingStyle}、\nトーン: ${blogInfo.writingTone}。\n文字数は ${blogInfo.articleLength} 字です。\n簡単な表現、シンプルな言葉を使用してください。ブロガーのトーンを保ってください。有名人の名前は、明示的に求められない限り避けてください。\nMarkdownでフォーマットを行ってください。`;

    const getHeadlines = async () => {
        const prompt = `
            Return 3 short chapters to structure the article: 
            # 記事タイトル${fetchTitle}
            # メインテーマ${blogInfo.botDescription}
        `;
        const headlines = await moduleCompletion(
            { model: modelGPT, prompt, max_tokens: 400 },
            PossibleAnswersExtraction
        );
        return headlines.slice(0, 3);
    };

    const generateContent = async (prompt, max_tokens = 600) => {
        return await moduleCompletion({ model: modelGPT, prompt, max_tokens });
    };
    console.log(`Headings`)
    const headlines = await getHeadlines();
    
    console.log(`Intro`)
    const introPrompt = generatePrompt(`次の見出しに基づいて、1段落で短いブログ記事のイントロを生成してください: ${headlines.join(", ")}`);
    const introduction = await generateContent(introPrompt,500);

    let articleContent = introduction;
    const contentPromises = headlines.map(async (headline) => {
        const contentPrompt = generatePrompt(`現在の記事内容: ${articleContent}\n以下の見出しに基づいて、続きを500文字以内で生成してください。「${headline}」。既に書かれている内容を繰り返さず、新しいコンテンツを生成してください。見出しや結論、サブチャプターは含めないでください。`);
        let content = await generateContent(contentPrompt);
        content = content.replace(headline,'')
        articleContent += `\n\n### ${headline}\n\n${content}`;
        return content;
    });
    
    console.log(`Content`)
    await Promise.all(contentPromises);

    console.log(`Conclusion`)
    const conclusionPrompt = generatePrompt(`次の内容に基づいて、ブログ記事の結論を生成してください: ${articleContent}`);
    const conclusion = await generateContent(conclusionPrompt);

    console.log(`Rewriting ...`)
    articleContent = `${articleContent}\n\n${conclusion}`.trim();
    const rewriteArticlePrompt = generatePrompt(`次の内容と構造に基づいて、ブログ記事の内容を全体的に書き直し、見出しも含めてください: ${articleContent}。記事の構造: ${headlines.join(", ")}。繰り返しを避け、新しい視点で書き直してください。`);
    const rewrittenArticle = await generateContent(rewriteArticlePrompt,1500);

    return rewrittenArticle.trim();

};

module.exports = { generateCompleteArticle };
