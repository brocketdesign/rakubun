// init-bot.js
const {
  getCategoryId,
  categoryExists,
  ensureCategory,
  getPostLink,
  getTermDetails,
  post,
} = require('./post.js');
const { generatePrompt } = require('../services/prompt.js');
const { moduleCompletion } = require('./openai.js');
const { getTxt2ImgResult } = require('./sdapi.js');
const {
  getSearchResult,
  getImageSearchResult,
} = require('../services/tools.js');
const { txt2img } = require('../modules/sdapi.js');
const { ObjectId } = require('mongodb');
const fetch = require('node-fetch');
const marked = require('marked');
const axios = require('axios');
var wordpress = require('wordpress');
const fs = require('fs');
const { generateCompleteArticle } = require('./article.js');
const { z } = require('zod');
require('dotenv').config({ path: './.env' });

// autoBlog.js

async function autoBlog(blogInfo, db) {
  blogInfo.username = blogInfo.blogUsername;
  blogInfo.url = blogInfo.blogUrl;
  blogInfo.password = blogInfo.blogPassword;

  const language = blogInfo.postLanguage;
  const client = wordpress.createClient(blogInfo);
  let modelGPT = 'gpt-4o-mini';

  if (!isBlogInfoComplete(blogInfo)) {
    console.log('You need to provide the blog information');
    return;
  }

  console.log(`Generating article for: ${blogInfo.botName}`);

  // Fetch the selected template
  const templateId = blogInfo.templateId ? new ObjectId(blogInfo.templateId) : null;
  let template = null;

  if (templateId) {
    template = await db.collection('templates').findOne({ _id: templateId });
    if (!template) {
      console.log('Template not found. Using default settings.');
    }
  } else {
    template = await db.collection('templates').findOne({});
    console.log('No template selected. Using default settings.');
  }

  // Categories
  let promise_categories = addTaxonomy(
    [template?.categoryName || blogInfo.postCategory || 'Uncategorized'],
    'category',
    client,
    language
  ).then((myCategories) => {
    let newCategories = blogInfo.postCategory;
    return updateCategories(myCategories, newCategories, 'category', client);
  });

  // Title
  const { japaneseTitle, slug } = await generateTitles(blogInfo, template);

  async function generateTitles(blogInfo, template) {
    // Use the custom title generation prompt from the template
    const japaneseTitlePrompt = template?.titleGenerationPrompt
      ? template.titleGenerationPrompt.replace('{botDescription}', blogInfo.botDescription)
      : titlePromptGen(blogInfo, template);

    const japaneseTitle_messages = [
      {
        role: 'system',
        content:
          template?.systemMessage ||
          'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
      },
      { role: 'user', content: japaneseTitlePrompt },
    ];

    const japaneseTitleResponse = await moduleCompletion({
      model: 'gpt-4o-mini',
      messages: japaneseTitle_messages,
      max_tokens: 100,
    });

    let japaneseTitle = japaneseTitleResponse.trim().replace(/"/g, '');

    // Translate the Japanese title to English
    const englishTitle = await translateTitle(japaneseTitle, 'gpt-4o-mini');
    // Slugify the English title
    const slug = slugifyTitle(englishTitle);

    return { japaneseTitle, slug };
  }

  // Tags
  const PossibleAnswersExtraction = z.object({
    answers: z.array(z.string()),
  });

  let promise_tags;
  if (template?.tags && template.tags.length > 0) {
    promise_tags = Promise.resolve(template.tags);
  } else {
    const tagPrompt = template?.tagGenerationPrompt
      ? template.tagGenerationPrompt.replace('{fetchTitle}', japaneseTitle)
      : categoryPromptGen(japaneseTitle, 'post_tag', language);

    const tagPrompt_messages = [
      {
        role: 'system',
        content:
          template?.systemMessage ||
          'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
      },
      { role: 'user', content: tagPrompt },
    ];

    promise_tags = moduleCompletion(
      { model: modelGPT, messages: tagPrompt_messages, max_tokens: 600 },
      PossibleAnswersExtraction
    ).then((parsedTags) => {
      if (parsedTags !== null) {
        return addTaxonomy(parsedTags, 'post_tag', client, language);
      } else {
        return [];
      }
    });
  }

  // Initiate Image Generation
  const imageTaskId = await initiateImageGeneration(slug, modelGPT, blogInfo, template);

  // Generate Article Content
  const promise_content = generateCompleteArticle(
    japaneseTitle,
    blogInfo,
    'gpt-4o',
    template
  );

  // Post the article without the image
  try {
    const [content, categories, tags] = await Promise.all([
      promise_content,
      promise_categories,
      promise_tags,
    ]);

    const content_HTML = markdownToHtml(content).replace(/<h1>.*?<\/h1>/, '');

    const postId = await post(
      japaneseTitle,
      slug,
      content_HTML,
      categories,
      tags,
      null, // No image for now
      blogInfo.postStatus,
      client
    );

    console.log('Article posted without image. Waiting for image generation to complete.');

    // Start checking for the image and update the post when ready
    checkImageAndUpdatePost(imageTaskId, postId, client);

    console.log('All tasks completed successfully');

    const articleLink = await getPostLink(postId, client);

    try {
      const saveResult = await saveArticleUpdateBlog(
        japaneseTitle,
        content,
        categories,
        tags,
        null,
        blogInfo,
        postId,
        articleLink
      );

      return {
        postId: saveResult.postId,
        articleLink: articleLink,
        articleId: saveResult.articleId,
        message: saveResult.message,
      };
    } catch (error) {
      console.log(error);
      console.log(`Error Saving Article`);
    }

    return { postId, articleLink };
  } catch (err) {
    console.log(err);
    return err;
  }
}

// Function to initiate image generation
async function initiateImageGeneration(fetchTitle, modelGPT, blogInfo, template) {
  const promptDataImage = imagePromptGen(fetchTitle);
  const promptDataImage_messages = [
    {
      role: 'system',
      content:
        template?.systemMessage ||
        'You are a proficient blog writer. Provide concise, simply written content.',
    },
    { role: 'user', content: promptDataImage },
  ];
  const fetchPromptImage = await moduleCompletion({
    model: modelGPT,
    messages: promptDataImage_messages,
    max_tokens: 400,
  });

  // Initiate image generation and get task ID
  const { task_id } = await txt2img({
    prompt: fetchPromptImage,
    negativePrompt: '',
    blogId: blogInfo.blogId,
  });

  console.log(`Image generation started with task ID: ${task_id}`);
  return task_id;
}

// The rest of the helper functions remain mostly the same, but ensure they use the template where applicable

// Helper functions
function imagePromptGen(fetchTitle) {
  return `タイトルを元に、Stable Diffusion用の画像プロンプトを作成してください。\nタイトル: ${fetchTitle}。`;
}

function contentPromptGenForSearch(search_results, blogInfo) {
  if (search_results) {
    return `次のJSON情報を使用して、よく構成されたSEOに適したブログ記事を提供してください。${JSON.stringify(
      search_results
    )}。あなたはプロの${blogInfo.postLanguage}のブロガーです。記事は完全に${blogInfo.postLanguage}で記述してください。`;
  } else {
    return `よく構成されたSEOに適したブログ記事を提供してください。あなたはプロの${blogInfo.postLanguage}のブロガーです。記事は完全に${blogInfo.postLanguage}で記述してください。`;
  }
}

function titlePromptGen(blogInfo, template) {
  return (
    template?.titleGenerationPrompt ||
    `「${blogInfo.botDescription}」に関連する具体的なテーマを1つ提供してください。対象読者は${blogInfo.postLanguage}を話す人々です。これらのカテゴリーに適合するテーマを選択してください: ${
      template?.categoryName || blogInfo.articleCategories
    }。オリジナリティを目指してください。トーンは${
      template?.tone || blogInfo.writingTone
    }で、記事のスタイルは${
      template?.style || blogInfo.writingStyle
    }に合わせてください。${blogInfo.postLanguage}で回答し、新鮮で魅力的な提案を優先してください。提供するタイトルは、有名な人物やキーワードを組み合わせて幅広い読者を惹きつけるものでなければなりません。タイトル文字列のみで回答してください。`
  );
}

function categoryPromptGen(title, type, language) {
  return `ブログ記事のタイトル: '${title}' に対して、SEOを向上させるために5つの${type}を提供してください。名前や有名人の名前は含めないでください。${language}でJSON文字列の配列のみで回答してください。JSON文字列のみを含め、変数宣言はしないでください。`;
}

function categoryDescriptionPromptGen(category, type, language) {
  return `ブログの${type}: '${category}' の説明を提供してください。${language}で回答してください。`;
}

async function updateCategories(myCategories, newCategories, type, client) {
  if (Array.isArray(newCategories)) {
    const promises = newCategories.map((cat) => getTermDetails(cat, type, client));
    const details = await Promise.all(promises);
    myCategories.push(...details);
  } else {
    if (!newCategories) {
      return myCategories;
    }
    const detail = await getTermDetails(newCategories, type, client);
    myCategories.push(detail);
  }
  return myCategories;
}

function isBlogInfoComplete(blogInfo) {
  const requiredFields = ['password', 'url', 'username'];
  return requiredFields.every((key) => blogInfo[key] !== undefined && blogInfo[key] !== '');
}

async function saveArticleUpdateBlog(
  fetchTitle,
  finalContent,
  myCategories,
  myTags,
  myImages,
  blogInfo,
  postId,
  articleLink
) {
  try {
    const article = {
      title: fetchTitle,
      content: finalContent,
      categories: myCategories,
      tags: myTags,
      blogId: new ObjectId(blogInfo.blogId),
      botId: new ObjectId(blogInfo.botId),
      createdAt: new Date(),
      thumbnail: myImages ? myImages.attachment_id : null,
      postId: postId,
      articleLink,
    };

    // Insert the article into the 'articles' collection
    const articleResult = await global.db.collection('articles').insertOne(article);
    const articleId = articleResult.insertedId;

    // Update the 'blogInfos' collection with the new articleId
    const blogUpdateResult = await global.db.collection('blogInfos').updateOne(
      { _id: new ObjectId(blogInfo._id) },
      { $push: { articleIds: articleId } }
    );

    if (blogUpdateResult.modifiedCount === 0) {
      throw new Error('Failed to update the blog with the new article ID.');
    }

    return {
      message: 'Article saved and blog updated successfully',
      articleId: articleId,
      postId: postId,
    };
  } catch (error) {
    console.error('Error saving article and updating blog:', error);
    throw error;
  }
}

function markdownToHtml(markdownString) {
  const html = marked.parse(markdownString);
  return html;
}

async function addTaxonomy(taxonomyArray, type, client, language) {
  const result = [];
  for (let tag of taxonomyArray) {
    try {
      const checkTag = await categoryExists(tag, type, client);

      if (!checkTag) {
        const catObj = await createTaxonomy(tag, type, language, client);
        result.push(catObj);
      } else {
        let categoryDetails = await getTermDetails(checkTag, type, client);
        const isComplete = isTaxonomyComplete(categoryDetails);
        if (!isComplete) {
          categoryDetails = await createTaxonomy(
            categoryDetails.name,
            type,
            language,
            client
          );
        }
        result.push(categoryDetails);
      }
    } catch (error) {
      console.log(error);
    }
  }
  return result;
}

function isTaxonomyComplete(taxonomy) {
  const requiredFields = ['name', 'description'];
  return requiredFields.every((key) => taxonomy[key] !== undefined && taxonomy[key] !== '');
}

async function createTaxonomy(taxonomyName, type, language, client) {
  const tagDescriptionPrompt = categoryDescriptionPromptGen(
    taxonomyName,
    type,
    language
  );
  const tagDescriptionPrompt_messages = [
    {
      role: 'system',
      content:
        'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
    },
    { role: 'user', content: tagDescriptionPrompt },
  ];
  const fetchtagDescription = await moduleCompletion({
    model: 'gpt-4o',
    messages: tagDescriptionPrompt_messages,
    max_tokens: 600,
  });
  const catObj = {
    name: capitalizeFirstLetter(taxonomyName),
    description: fetchtagDescription,
  };
  await ensureCategory(catObj, type, client);
  return catObj;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function translateTitle(japaneseTitle, model) {
  const translationPrompt = `Translate this title to English: "${japaneseTitle}".`;
  const translationPrompt_messages = [
    { role: 'system', content: 'You are a proficient language translator.' },
    { role: 'user', content: translationPrompt },
  ];

  const translationResult = await moduleCompletion({
    model: model,
    messages: translationPrompt_messages,
    max_tokens: 60,
  });

  return translationResult.trim();
}

function slugifyTitle(englishTitle) {
  return englishTitle
    .toLowerCase() // Convert to lowercase
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
}

module.exports = { autoBlog };
