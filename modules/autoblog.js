const { getCategoryId, categoryExists, ensureCategory, getTermDetails, post } = require('./post.js')
const { getOrUpdateArticles } = require('./feedScraper.js');
const { generatePrompt } = require('../services/prompt.js')
const { moduleCompletion, moduleCompletionOllama } = require('./openai.js');
const { getSearchResult, getImageSearchResult } = require('../services/tools.js')
const { ObjectId } = require('mongodb');
const fetch = require('node-fetch');
const marked = require('marked');
const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function autoBlog(blogInfo,db){

  blogInfo.username = blogInfo.blogUsername
  blogInfo.url = blogInfo.blogUrl
  blogInfo.password = blogInfo.blogPassword
  const language = blogInfo.postLanguage
  
  if(!isBlogInfoComplete(blogInfo)){
    console.log('You need to provide the blog informations')
    return
  }   
  
  console.log(`Generating article for: ${blogInfo.blogName}`);

  let myCategories = await addTaxonomy(['RAKUBUN'],'category',blogInfo,language)
  let newCategories = blogInfo.postCategory
  myCategories = await updateCategories(myCategories,newCategories,'category',blogInfo)

  const promptDataTitle = `Provide an interesting subject that could be discuss in relation to : ["${blogInfo.blogDescription}"] tailored to a ${blogInfo.postLanguage}-speaking audience.Choose a concrete and specific subject for the main categories are ${blogInfo.articleCategories}. Aim for originality. The tone should be ${blogInfo.writingTone}, aligning with the article's ${blogInfo.writingStyle} style. Please respond in ${blogInfo.postLanguage} and prioritize freshness and appeal in your suggestions. Provide only one the title without anything else,without prefix "Titre: ".`;
  const fetchTitle = await moduleCompletion({prompt:promptDataTitle,max_tokens:100});
  console.log(`Generated title : ${fetchTitle}`)

  const tagPrompt = categoryPromptGen(fetchTitle, 'post_tag',language)
  const fetchTag= await moduleCompletion({prompt:tagPrompt,max_tokens:600});
  const parsedTags = JSON.parse(fetchTag)
  parsedTags.push('RAKUBUN')

  const myTags = await addTaxonomy(parsedTags,'post_tag',blogInfo,language)

  const promptDataContent = `Write an interesting blog post about "${fetchTitle}". The blog aims to ${blogInfo.blogDescription}. This post should cater to ${blogInfo.targetAudience} with content that fits within the categories of ${blogInfo.articleCategories}. The language of the post should be ${blogInfo.postLanguage}. Aim to make short sentences, using simple words to improve readability and a well structured content. Style: ${blogInfo.writingStyle}, Tone: ${blogInfo.writingTone}. Use Markdown for formatting.`;
  const fetchContent = await moduleCompletion({prompt:promptDataContent,max_tokens:3000});
  const convertContentHTML = markdownToHtml(fetchContent);

  const finalContent = convertContentHTML + '<br>' + disclaimer(language);
  
  try {
        // Post the concocted content to the mystical web
        await post(fetchTitle, finalContent, myCategories, myTags, blogInfo);
        
        // Mark the article as published in the grand book of articles
        saveArticleUpdateBlog(fetchTitle, finalContent, myCategories, myTags, blogInfo);
  } catch (error) {
    console.log('Could not publish the article')
    console.log(error)
  }
}
async function updateCategories(myCategories,newCategories,type,option) {
  // Let's handle the case where we need to fetch details first
  if (Array.isArray(newCategories)) {
    // It's an array, time for a group adventure
    const promises = newCategories.map(cat => getTermDetails(cat, type, option));
    const details = await Promise.all(promises);
    // Using map to transform the details into a list of names (or whatever property you need)
    myCategories.push(...details);
  } else {
    // It's a single string, a solo mission
    const detail = await getTermDetails(newCategories, type, option);
    myCategories.push(detail);
  }
  return myCategories
}

function isAutoBlogInfoComplete(blogInfo) {
  // A list of ingredients we expect in our potion
  const requiredIngredients = ['blogPassword', 'blogUrl', 'blogUsername'];

  // Checking every ingredient for its presence and clarity
  return requiredIngredients.every(key => blogInfo[key] !== undefined && blogInfo[key] !== '');
}

async function autorsspost(db) {
  // Summon the active feeds from the ethereal database realms
  const feeds = await findActiveFeeds(db);
  
  // For each feed, we seek the first unpublished article
  const firstUnpublishedArticles = await Promise.all(feeds.map(async (feed) => {
    const articles = await getOrUpdateArticles(feed._id);
    const firstUnpublishedArticle = articles.find(article => !article.published);
    
    // If a hidden gem is found, we morph it with the feed's essence
    if (firstUnpublishedArticle) {
      return {
        ...firstUnpublishedArticle,
        feedName: feed.name,
        userId: feed.userId,
      };
    }
    return null; // If no such article exists, we return a null spell
  })).then(results => results.filter(Boolean)); // Banish all nulls from our result

  // If our quest finds no articles, we simply return to our quarters
  if (firstUnpublishedArticles.length === 0) {
    console.log("No unpublished articles found across all feeds.");
    return;
  }
  // For each first unpublished article, we embark on a posting journey
  for (const article of firstUnpublishedArticles) {
    const blogInfo = await getBlogInfo(db, article.userId);
    if(!isBlogInfoComplete(blogInfo)){
      console.log('You need to provide the blog informations')
      return
    }   
    const language = await getLanguage(db, article.userId)
    // Prepare the data scroll for the article generation ritual
    let data = {
      TITLE: article.metaDescription,
      WRITING_STYLE: 'narrative',
      LANGUAGE: language,
      WRITING_TONE: 'friendly',
      THEME:blogInfo.theme
    };
    
    console.log(`Generating article for: ${article._id}`);

    let myCategories = await addTaxonomy(['AI Content',article.feedName ],'category',blogInfo,language)

    const tagPrompt = categoryPromptGen(data.TITLE, 'post_tag',language)
    const fetchTag= await moduleCompletion({prompt:tagPrompt,max_tokens:600});
    const parsedTags = JSON.parse(fetchTag)
    parsedTags.push('AI Content')

    const myTags = await addTaxonomy(parsedTags,'post_tag',blogInfo,language)

    const promptDataTitle = generatePrompt(data, "0");
    const fetchTitle = await moduleCompletion(promptDataTitle);
    data.TITLE = fetchTitle;
    console.log(`Generated title : ${fetchTitle}`)

    const promptDataContent = generatePrompt(data, "8");
    const fetchContent = await moduleCompletion(promptDataContent);
    const convertContentHTML = markdownToHtml(fetchContent);

    //const seoSearch = await getSearchResult(data.TITLE);
    //const seoSearchHTML = searchResultsToHtml(seoSearch);

    const imageSearch = await getImageSearchResult(article.articleUrl);
    const imageSearchHTML = imageSearchToHTML(imageSearch,article.articleUrl);

    const finalContent = convertContentHTML + '<br>' + imageSearchHTML + '<br>' + disclaimer(language);
    
    try {
          // Post the concocted content to the mystical web
          await post(fetchTitle, finalContent, myCategories, myTags, blogInfo);
          
          // Mark the article as published in the grand book of articles
          updateArticleStatus(article._id);
    } catch (error) {
      console.log('Could not publish the article')
      console.log(error)
    }
  }
}


// Tools

async function saveArticleUpdateBlog(fetchTitle, finalContent, myCategories, myTags, blogInfo) {
  try {
    // Step 1: Save the article in the articles collection
    const article = {
      title: fetchTitle,
      content: finalContent,
      categories: myCategories,
      tags: myTags,
      blogId: new ObjectId(blogInfo._id), // Assuming blogInfo contains blogId
      createdAt: new Date() // Capture the creation date of the article
    };

    const articleResult = await global.db.collection('articles').insertOne(article);
    const articleId = articleResult.insertedId;

    // Step 2: Update the corresponding blog entry to include the new article ID in its articles array
    // Ensure the blogInfos collection and the field that stores the article IDs (e.g., 'articleIds') are correctly named
    const blogUpdateResult = await global.db.collection('blogInfos').updateOne(
      { _id: new ObjectId(blogInfo._id) }, // Use the blogId to find the correct blog
      { $push: { articleIds: articleId } } // Push the new article ID to the articles array
    );

    // Check the result and handle accordingly
    if (blogUpdateResult.modifiedCount === 0) {
      throw new Error('Failed to update the blog with the new article ID.');
    }

    return {
      message: 'Article saved and blog updated successfully',
      articleId: articleId
    };
  } catch (error) {
    console.error('Error saving article and updating blog:', error);
    throw error; // Rethrow or handle as needed
  }
}

async function updateArticleStatus(articleId){
  await global.db.collection('articles').updateOne({_id:new ObjectId(articleId)},{$set:{published:true}})
}
async function getBlogInfo(db,userId){
  const user = await db.collection('users').findOne({_id:new ObjectId(userId)})
  return {password:user.blogPassword,url:user.blogUrl,username:user.blogUsername,theme:user.blogTheme}
}
function isBlogInfoComplete(blogInfo) {
  // A list of ingredients we expect in our potion

  const requiredIngredients = ['password', 'url', 'username'];

  // Checking every ingredient for its presence and clarity
  return requiredIngredients.every(key => blogInfo[key] !== undefined && blogInfo[key] !== '');
}
function isTaxonomyComplete(taxonomy) {
  const requiredFields = ['name', 'description'];
  return requiredFields.every(key => taxonomy[key] !== undefined && taxonomy[key] !== '');
}
async function getLanguage(db,userId){
  const user = await db.collection('users').findOne({_id:new ObjectId(userId)})
  return user.language || 'japanese'
}
async function findActiveFeeds(db){
  return db.collection('feeds').find({'status':'active'}).toArray()
}
function markdownToHtml(markdownString) {
  // Use marked to convert the markdown string to HTML
  const html = marked.parse(markdownString);

  return html;
}
function searchResultsToHtml(processedResults) {

  // Then, transform these results into HTML list items
  const listItemsHtml = processedResults.map(result => {
    return `<li><a href="${result.link}" target="_blank">${result.title}</a></li>`;
  }).join(''); // Join all list items into a single string

  // Finally, wrap the list items in a <ul> element
  return `<ul>${listItemsHtml}</ul>`;
}
function imageSearchToHTML(imageSearch,articleUrl) {
  if (!imageSearch || !imageSearch.length) {
    return '<div>No images found, the gallery is as empty as a cauldron after a potion class.</div>';
  }

  // Begin our HTML gallery with a touch of responsive style
  let html = `<style>
    .image-gallery {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    /* The spell of responsiveness: one column on screens narrower than 600 pixels */
    @media (max-width: 600px) {
      .image-gallery {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <div class="image-gallery">`;

  // For each image, create a card-like element
  imageSearch.forEach(image => {
    html += `
      <div style="border: 1px solid #ddd; box-shadow: 0px 0px 5px #aaa; margin-bottom: 20px;">
        <a href="${articleUrl}" target="_blank">
          <img src="${image.link}" alt="${image.title}" style="width: 100%; height: auto;">
        </a>
      </div>
    `;
  });

  // Close our gallery div
  html += '</div>';

  return html;
}
function disclaimer(language) {
  switch (language) {
    case 'japanese':
      return '<i>ご注意ください！このページの内容は、私たちのAI仲間によって自動的に生成されました。生成型AIは時に間違った情報を吐き出すこともありますので、この記事の内容を鵜呑みにせず、自分の目で確かめてくださいね。専門的な判断や重要な行動をする前には、信頼できる情報源をチェックすることを忘れずに。</i><br>';
    case 'french':
      return '<i>Attention, chers lecteurs ! Le contenu de cette page a été généré automatiquement par notre complice, l\'IA générative. Comme notre ami l\'IA peut parfois se tromper, ne prenez pas tout ce qui est écrit ici pour parole d\'évangile. Vérifiez par vous-même et consultez des sources fiables avant de prendre des décisions spécialisées ou d\'agir.</i><br>';
    case 'english':
    default:
      return `<i>Heads up, folks! The content on this very page was whipped up automatically by our pal, the generative AI. Since our AI buddy can sometimes mix up its facts, please don't swallow everything you read here hook, line, and sinker. Do your own fact-checking and consult trustworthy sources before making any specialized decisions or taking action.</i><br>`;
  }
}

function categoryPromptGen(title,type,language){
  return  `For a blog post titled: '${title}', provide 5 ${type} names. Respond in ${language} only with a json string array only.Only include the json string , with no variable declaration`
}

function categoryDescriptionPromptGen(category,type,language){
  return  `For a blog ${type}: '${category}', provide a description. Respond in ${language} only.`
}
async function addTaxonomy(taxonomyArray,type,blogInfo,language){
  const result = []
  for(let tag of taxonomyArray){
    try {
      const checkTag = await categoryExists(tag,type,blogInfo);
      
      if(!checkTag){
        console.log(`Creating new taxonomy (${type}) : ${tag}`)
        const catObj = await createTaxonomy(tag,type,language,blogInfo)
        result.push(catObj)
      }else{
        console.log(`Already exist : ${tag}`)
        let categoryDetails = await getTermDetails(checkTag, type, blogInfo)
        const isComplete = isTaxonomyComplete(categoryDetails)
        if(!isComplete){
          categoryDetails = await createTaxonomy(categoryDetails.name, type, language, blogInfo)
        }
        result.push(categoryDetails)
      }
    } catch (error) {
      console.log(error)
    }
  }
  return result
}
async function createTaxonomy(taxonomyName,type,language, blogInfo){
  const tagDescriptionPrompt = categoryDescriptionPromptGen(taxonomyName,type,language)
  const fetchtagDescription = await moduleCompletion({prompt:tagDescriptionPrompt,max_tokens:600});
  const catObj = {name:capitalizeFirstLetter(taxonomyName),description:fetchtagDescription}
  await ensureCategory(catObj, type, blogInfo)
  return catObj
}
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {autorsspost,autoBlog}