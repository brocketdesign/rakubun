// init-bot.js
const {
  getCategoryId,
  categoryExists,
  ensureCategory,
  getTermDetails,
  post,
} = require('./post.js');
const { generatePrompt } = require('../services/prompt.js');
const { moduleCompletion } = require('./openai.js');
const { getTxt2ImgResult } = require('./sdapi.js')
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

  console.log({ modelGPT });
  if (!isBlogInfoComplete(blogInfo)) {
    console.log('You need to provide the blog information');
    return;
  }

  console.log(`Generating article for: ${blogInfo.botName}`);

  // Categories
  let promise_categories = addTaxonomy(['RAKUBUN'], 'category', client, language).then(
    (myCategories) => {
      let newCategories = blogInfo.postCategory;
      return updateCategories(myCategories, newCategories, 'category', client);
    }
  );

  // Title
  const promptDataTitle = titlePromptGen(blogInfo);
  const promptDataTitle_messages = [
    {
      role: 'system',
      content:
        'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
    },
    { role: 'user', content: promptDataTitle },
  ];
  const untreatedTitle = await moduleCompletion({
    model: modelGPT,
    messages: promptDataTitle_messages,
    max_tokens: 100,
  });
  const fetchTitle = untreatedTitle.trim().replace(/"/g, '');

  // Tags
  const PossibleAnswersExtraction = z.object({
    answers: z.array(z.string()),
  });
  const tagPrompt = categoryPromptGen(fetchTitle, 'post_tag', language);
  const tagPrompt_messages = [
    {
      role: 'system',
      content:
        'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
    },
    { role: 'user', content: tagPrompt },
  ];
  let promise_tags = moduleCompletion(
    { model: modelGPT, messages: tagPrompt_messages, max_tokens: 600 },
    PossibleAnswersExtraction
  ).then((parsedTags) => {
    if (parsedTags !== null) {
      return addTaxonomy(parsedTags, 'post_tag', client, language);
    } else {
      return [];
    }
  });

  // Initiate Image Generation
  const imageTaskId = await initiateImageGeneration(fetchTitle, modelGPT, blogInfo);

  // Generate Article Content
  const promise_content = generateCompleteArticle(fetchTitle, blogInfo, 'gpt-4o');

  // Post the article without the image
  try {
    const [content, categories, tags] = await Promise.all([
      promise_content,
      promise_categories,
      promise_tags,
    ]);

    try {
      saveArticleUpdateBlog(fetchTitle, content, categories, tags, null, blogInfo);
    } catch (error) {
      console.log(error);
      console.log(`Error Saving Article`);
    }
    const content_HTML = markdownToHtml(content).replace(/<h1>.*?<\/h1>/, '');
    const postId = await post(
      fetchTitle,
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
  } catch (err) {
    console.log(err);
    return err;
  }
}

// Function to initiate image generation
async function initiateImageGeneration(fetchTitle, modelGPT, blogInfo) {
  const promptDataImage = imagePromptGen(fetchTitle);
  const promptDataImage_messages = [
    {
      role: 'system',
      content:
        'You are a proficient blog writer. Provide concise, simply written content. Do not include chapters or subchapters, do not include numbers for each title, and do not use the names of celebrities. Do not invent false stories that involve real people.',
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

// Function to check image status and update post
async function checkImageAndUpdatePost(task_id, postId, client) {
  const POLLING_INTERVAL = 10000; // 10 seconds
  const MAX_ATTEMPTS = 30; // Up to 5 minutes
  let attempts = 0;

  const intervalId = setInterval(async () => {
    attempts++;
    try {
      const result = await getTxt2ImgResult(task_id);

      if (result.status === 'processing') {
        console.log('Image is still being generated. Will check again later.');
      } else if (result.imageBuffer) {
        clearInterval(intervalId);
        // Upload the image to WordPress
        const imageData = await new Promise((resolve, reject) => {
          client.uploadFile(
            {
              name: `${task_id}.png`,
              type: 'image/png',
              bits: result.imageBuffer,
            },
            (error, file) => {
              if (error) {
                console.log('Error when adding the thumbnail');
                reject(error);
              } else {
                resolve(file);
              }
            }
          );
        });

        // Update the post with the image
        await updatePostWithImage(postId, imageData.attachment_id, client);
        console.log('Post updated with the generated image.');
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(intervalId);
        console.log('Image generation timed out. Proceeding without image.');
      }
    } catch (error) {
      clearInterval(intervalId);
      console.error('Error checking image result:', error.message);
    }
  }, POLLING_INTERVAL);
}

// Function to update the post with the image
async function updatePostWithImage(postId, attachmentId, client) {
  return new Promise((resolve, reject) => {
    client.editPost(
      postId,
      { thumbnail: attachmentId },
      (error, data) => {
        if (error) {
          console.log('Error updating post with image:', error);
          reject(error);
        } else {
          resolve(data);
        }
      }
    );
  });
}

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

function titlePromptGen(blogInfo) {
  return `「${blogInfo.botDescription}」に関連する具体的なテーマを1つ提供してください。対象読者は${blogInfo.postLanguage}を話す人々です。これらのカテゴリーに適合するテーマを選択してください: ${blogInfo.articleCategories}。オリジナリティを目指してください。トーンは${blogInfo.writingTone}で、記事のスタイルは${blogInfo.writingStyle}に合わせてください。${blogInfo.postLanguage}で回答し、新鮮で魅力的な提案を優先してください。提供するタイトルは、有名な人物やキーワードを組み合わせて幅広い読者を惹きつけるものでなければなりません。タイトル文字列のみで回答してください。`;
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
  blogInfo
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
    };

    const articleResult = await global.db.collection('articles').insertOne(article);
    const articleId = articleResult.insertedId;

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
  return requiredFields.every(key => taxonomy[key] !== undefined && taxonomy[key] !== '');
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

module.exports = { autoBlog };
