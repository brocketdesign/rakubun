// AutoBlog
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ObjectId } = require('mongodb');
const { getCategoryId, checkLoginInfo, post } = require('../../modules/post')
const { setCronJobForUser } = require('../../modules/cronJobs-bot.js');
var wordpress = require("wordpress");
const { txt2img,txt2imgOpenAI } = require('../../modules/sdapi.js')
const { fetchFavicon } = require('../../services/tools.js')
const mongoose = require('mongoose');
const authMiddleware = require('../../middleware/authMiddleware');
const BlogInfo = require('../../models/BlogInfo');
const TrendAnalysisResult = require('../../models/TrendAnalysisResult');

router.post('/generate-image', async (req, res) => {
  const { prompt, negativePrompt, aspectRatio, height, width, size, blogId } = req.body;

  try {
      const { imageID, imageBuffer, imageUrl } = await txt2imgOpenAI({ 
          prompt, 
          negativePrompt, 
          aspectRatio, 
          height, 
          width, 
          size,
          blogId 
      });

      const result = { imageID };
      if (imageBuffer) {
        result.imageBuffer = Array.from(new Uint8Array(imageBuffer));
      }
      if (imageUrl) {
        result.imageUrl = imageUrl;
      }

      res.json(result);
  } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({ error: 'Error generating image' });
  }
});

router.get('/user-blogs', async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch the user's blog data, sorted by the most recent
    const blogData = await global.db.collection('blogInfos')
      .find({ userId: new ObjectId(userId) })
      .sort({ _id: -1 })
      .toArray();
    for (let i = 0; i < blogData.length; i++) {
      const botCount = await global.db.collection('botInfos')
        .countDocuments({ blogId: (blogData[i]._id.toString()), isActive:true });
      blogData[i].botCount = botCount;
    }
    // Return the blog data to the client
    res.status(200).send(blogData);
  } catch (error) {
    console.log('Error fetching user blogs:', error);
    res.status(500).send('Internal server error');
  }
});

router.get('/info/category/:blogId', async (req, res) => {
  const { blogId } = req.params;

  try{
    const blogInfo = await global.db.collection('blogInfos')
                             .findOne({_id: new ObjectId(blogId), userId: new ObjectId(req.user._id)});

    if (!blogInfo) {
      return res.status(404).json({ message: 'Blog information not found or access denied.' });
    }
    
    blogInfo.username = blogInfo.blogUsername
    blogInfo.url = blogInfo.blogUrl
    blogInfo.password = blogInfo.blogPassword


    const client = wordpress.createClient(blogInfo);

    const categoryIds = await getCategoryId('category',client)

    res.json(categoryIds);
  }catch (error){
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });

  }

});

router.get('/blog-info/:blogId', async (req, res) => {
  const { blogId } = req.params;

  try {
    const blogInfo = await global.db.collection('blogInfos')
    .findOne({_id: new ObjectId(blogId)});

    if (!blogInfo) {
      return res.status(404).json({ message: 'Blog information not found or access denied.' });
    }
    blogInfo.blogId=blogId
    res.json(blogInfo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/blog-info', async (req, res) => {
  try {
    const userId = req.user._id;
    const blogData = req.body;
    const loginResult = await checkLoginInfo(blogData);
    if (!loginResult.success) {
      return res.status(401).send({ message: 'Login failed', error: loginResult.error });
    }

    if (blogData.additionalUrls) {
      blogData.additionalUrls = blogData.additionalUrls.filter(url => url !== "");
    }

    try {
      const domain = new URL(blogData.blogUrl).hostname;
      const faviconData = await fetchFavicon(domain);  
      if (faviconData && faviconData.hasIcon) {
        blogData.favicon = faviconData.icon;
      }
    } catch (faviconError) {
      console.error('Failed to fetch favicon:', faviconError);
    }

    const blogId = await saveBlogInfo(userId, blogData);
    res.status(201).send({ message: 'Blog info saved successfully', blogId });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});


router.delete('/blog/:blogId', async (req, res) => {
  const { blogId } = req.params;

  try {
    const deletionResult = await global.db.collection('blogInfos')
                                  .deleteOne({_id: new ObjectId(blogId), userId: new ObjectId(req.user._id)});
    
    if (deletionResult.deletedCount === 0) {
      return res.status(404).json({ message: 'ブログ情報が見つからないか、アクセスが拒否されました。' });
    }

    res.json({ message: 'ブログ情報が正常に削除されました。' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '内部サーバーエラー' });
  }
});

router.post('/duplicate-blog/:blogId', async (req, res) => {
  const { blogId } = req.params;
  try {
    // Fetch the existing blog info
    const blogInfo = await global.db.collection('blogInfos')
                        .findOne({_id: new ObjectId(blogId), userId: new ObjectId(req.user._id)});

    if (!blogInfo) {
      return res.status(404).send('Blog information not found.');
    }

    // Remove the _id property to ensure MongoDB assigns a new _id when inserting
    delete blogInfo._id;
    blogInfo.blogName = blogInfo.blogName + '(DUPLICATE)'
    // Insert the duplicated blog info as a new document
    const insertResult = await global.db.collection('blogInfos').insertOne(blogInfo);

    if (insertResult.acknowledged) {
      // Successfully duplicated, you can redirect or send back success response
      res.send({ message: 'Blog duplicated successfully', newBlogId: insertResult.insertedId });
    } else {
      res.status(500).send('Failed to duplicate blog info.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});
router.get('/bots',async (req, res) => {
  const blogId = req.query.blogId ? req.query.blogId : null;
  let botData;

  try {
      if (blogId != null) {
          botData = await global.db.collection('botInfos')
          .find({ blogId: blogId })
          .sort({_id:-1})
          .toArray();
          res.json({ success: true, botData });
      } else {
          res.json({ success: false, message: "Blog ID is required." });
      }
  } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// BOT API
const {autoBlog} = require('../../modules/init-bot.js')
router.post('/bot-start', async (req, res) => {
  try {
    const userId = req.user._id;
    const { botId } = req.body;

    // Fetch botInfo
    const botInfo = await global.db.collection('botInfos').findOne({ _id: new ObjectId(botId) });
    if (!botInfo) {
      return res.status(404).send('Bot not found');
    }

    // Fetch blogInfo
    const blogInfo = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(botInfo.blogId) });
    if (!blogInfo) {
      return res.status(404).send('Blog not found');
    }

    // Ensure blogUrl exists
    if (!blogInfo.blogUrl) {
      return res.status(500).send('Blog URL is not configured');
    }

    // Prepare combinedPowers
    blogInfo.userId = userId
    botInfo.botId = botInfo._id
    blogInfo.blogId = blogInfo._id
    const combinedPowers = {  ...blogInfo, ...botInfo, _id: blogInfo._id  };
 
    // Call autoBlog to post and save the article
    const { postId, articleLink, articleId } = await autoBlog(combinedPowers, global.db);

    // Respond with the article link
    res.send({ postId, articleLink, articleId });
  } catch (error) {
    console.error('Error in /bot-start:', error);
    res.status(500).send('Internal server error');
  }
});

router.get('/bot-info/:botId', async (req, res) => {
  const { botId } = req.params;

  try {
    const botInfo = await global.db.collection('botInfos')
                             .findOne({_id: new ObjectId(botId), userId: new ObjectId(req.user._id)});

    if (!botInfo) {
      return res.status(404).json({ message: 'Blog information not found or access denied.' });
    }
    botInfo.botId = botId
    res.json(botInfo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/bot-info', async (req, res) => {
  const userId = req.user._id;
  const botData = req.body;

  try {
    const botId = await saveBotInfo(userId, botData);
    const botInfo = await db.collection('botInfos').findOne({ _id: new ObjectId(botId) });
    await setCronJobForUser(db, botId, botInfo.postFrequency)
    res.status(201).send({ message: 'Bot info saved successfully', botId });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});

router.delete('/bot/:botId', async (req, res) => {
  const { botId } = req.params;

  try {
    // Optional: Check if the blog info belongs to the user before deletion
    const deletionResult = await global.db.collection('botInfos')
                                  .deleteOne({_id: new ObjectId(botId), userId: new ObjectId(req.user._id)});
    
    if (deletionResult.deletedCount === 0) {
      return res.status(404).json({ message: 'Blog information not found or access denied.' });
    }

    res.json({ message: 'Blog information deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
router.post('/duplicate-bot/:botId', async (req, res) => {
  const { botId } = req.params;
  console.log({botId})
  try {
    // Fetch the existing blog info
    const botInfo = await global.db.collection('botInfos')
                        .findOne({_id: new ObjectId(botId), userId: new ObjectId(req.user._id)});

    if (!botInfo) {
      return res.status(404).send('Blog information not found.');
    }

    // Remove the _id property to ensure MongoDB assigns a new _id when inserting
    delete botInfo._id;
    botInfo.botName = botInfo.botName + '(DUPLICATE)'
    // Insert the duplicated blog info as a new document
    const insertResult = await global.db.collection('botInfos').insertOne(botInfo);

    if (insertResult.acknowledged) {
      // Successfully duplicated, you can redirect or send back success response
      res.send({ message: 'Blog duplicated successfully', newBotId: insertResult.insertedId });
    } else {
      res.status(500).send('Failed to duplicate blog info.');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});
router.get('/articles/:botId', async (req, res) => {
  const botId = new ObjectId(req.params.botId);
  const articles = await global.db.collection('articles').find({ botId }).toArray();
  res.json({ success: true, articles });
});
router.get('/article/:articleId', async (req, res) => {
  const articleId = new ObjectId(req.params.articleId);
  const article = await global.db.collection('articles').findOne({ _id: articleId });
  res.json({ success: true, article });
});
router.post('/article/:articleId', async (req, res) => {
  const articleId = new ObjectId(req.params.articleId);
  const { title, slug, content } = req.body;
  await global.db.collection('articles').updateOne(
    { _id: articleId },
    { $set: { title, slug, content } }
  );
  res.json({ success: true });
});
router.post('/article/post/:articleId', async (req, res) => {
  try {
    const articleId = new ObjectId(req.params.articleId);
    const article = await global.db.collection('articles').findOne({ _id: articleId });
    const blogInfo = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(article.blogId) });

    blogInfo.username = blogInfo.blogUsername;
    blogInfo.url = blogInfo.blogUrl;
    blogInfo.password = blogInfo.blogPassword;

    const client = wordpress.createClient(blogInfo);

    const japaneseTitle = article.title;
    const slug = article.slug;
    const content_HTML = article.content;
    const categories = article.categories || [];
    const tags = article.tags || [];

    const postId = await post(
      japaneseTitle,
      slug,
      content_HTML,
      categories,
      tags,
      null,
      blogInfo.postStatus,
      client
    );

    res.json({ success: true, postId });
  } catch (error) {
    console.log(error);
    res.json({ success: false, error: error.message });
  }
});

router.get('/blog/:blogId/cached-trend-analysis', authMiddleware, async (req, res) => {
    const { blogId } = req.params;
    const userId = req.user._id;
    console.log(`[/api/autoblog/cached-trend-analysis] Received request for blogId: ${blogId}, userId: ${userId}`);

    try {
        if (!mongoose.Types.ObjectId.isValid(blogId)) {
            console.log(`[/api/autoblog/cached-trend-analysis] Invalid blogId format: ${blogId}`);
            return res.status(400).json({ success: false, message: 'Invalid blog ID format.' });
        }

        const blog = await BlogInfo.findById(blogId).lean();
        if (!blog) {
            console.log(`[/api/autoblog/cached-trend-analysis] Blog not found: ${blogId}`);
            return res.status(404).json({ success: false, message: 'Blog not found.' });
        }
        console.log(`[/api/autoblog/cached-trend-analysis] Blog found: ${blog.blogName}`);

        // Fetch the latest 20 TrendAnalysisResult for this blog, sorted by analyzedAt descending.
        // Then, join with the Trend collection to get the latest trend details (like tweetCount, scrapedAt).
        const cachedAnalysis = await TrendAnalysisResult.aggregate([
            { $match: { blogId: new mongoose.Types.ObjectId(blogId) } },
            { $sort: { analyzedAt: -1 } }, // Sort by when it was analyzed
            { $limit: 30 }, // Limit to last 30 analysis results for this blog
            {
                $lookup: {
                    from: 'trends', // The collection name for Trend model
                    localField: 'trendId', // Field from TrendAnalysisResult
                    foreignField: '_id',   // Field from Trend
                    as: 'trendDetails'
                }
            },
            {
                $unwind: {
                    path: "$trendDetails",
                    preserveNullAndEmptyArrays: true // Keep results even if trend is not found (e.g. deleted)
                }
            },
            {
                $project: { // Reshape the output
                    _id: 1,
                    blogId: 1,
                    trendName: 1,
                    trendId: 1,
                    isRelevant: 1,
                    relevanceScore: 1,
                    reasoning: 1,
                    suggestedAngle: 1,
                    analyzedAt: 1, // When this specific analysis was performed
                    keywordsUsed: 1,
                    // Include fields from the joined trend document
                    trend: {
                        name: "$trendDetails.name",
                        tweetCount: "$trendDetails.tweetCount",
                        scrapedAt: "$trendDetails.scrapedAt", // When the trend itself was scraped
                        source: "$trendDetails.source",
                        region: "$trendDetails.region"
                    },
                    // Keep the original analysis result structure for the frontend if it expects it
                    analysisResult: {
                        is_relevant: "$isRelevant",
                        relevance_score: "$relevanceScore",
                        reasoning: "$reasoning",
                        suggested_angle: "$suggestedAngle"
                    }
                }
            },
            { $sort: { "trend.scrapedAt": -1, analyzedAt: -1 } } // Final sort by trend scrape time, then analysis time
        ]);

        console.log(`[/api/autoblog/cached-trend-analysis] Found ${cachedAnalysis.length} cached analysis results for blogId: ${blogId}`);
        res.json({ success: true, data: cachedAnalysis });

    } catch (error) {
        console.error(`[/api/autoblog/cached-trend-analysis] Error fetching cached trend analysis for blog ${blogId}:`, error);
        res.status(500).json({ success: false, message: 'Internal server error while fetching cached analysis.', error: error.message });
    }
});

//TOOLS
async function saveBlogInfo(userId, blogData) {
  try {
    // Check if blogData contains blogId
    if (blogData.blogId) {
      // Attempt to update the existing blog info
      const blogId = blogData.blogId;
      delete blogData.blogId; // Remove blogId from blogData to prevent it from being updated in the document

      const updateResult = await global.db.collection('blogInfos').updateOne(
        { _id: new ObjectId(blogId), userId: new ObjectId(userId) }, // Ensure that the blog belongs to the user
        { $set: blogData }
      );

      // Check if the document to update was found and modified
      if (updateResult.matchedCount === 0) {
        throw new Error('No matching document found to update');
      }

      return blogId;
    } else {
      // Insert a new blog info document
      const blogInfo = {
        userId: new ObjectId(userId),
        ...blogData
      };
      const insertResult = await global.db.collection('blogInfos').insertOne(blogInfo);
      return insertResult.insertedId;
    }
  } catch (error) {
    console.error("Error saving blog info:", error);
    throw error; // Rethrow the error to be handled by the caller
  }
}
async function saveBotInfo(userId, botData) {

  try {
    // Check if blogData contains blogId
    if (botData.botId && botData.botId != '') {
      // Attempt to update the existing blog info
      const botId = botData.botId;
      delete botData.botId; // Remove blogId from botData to prevent it from being updated in the document

      const updateResult = await global.db.collection('botInfos').updateOne(
        { _id: new ObjectId(botId), userId: new ObjectId(userId) }, // Ensure that the blog belongs to the user
        { $set: botData }
      );

      // Check if the document to update was found and modified
      if (updateResult.matchedCount === 0) {
        throw new Error('No matching document found to update');
      }

      return botId;
    } else {
      console.log(`New blog`)
      // Insert a new blog info document
      const botInfo = {
        userId: new ObjectId(userId),
        ...botData
      };
      
      const insertResult = await global.db.collection('botInfos').insertOne(botInfo);
      return insertResult.insertedId;
    }
  } catch (error) {
    console.error("Error saving blog info:", error);
    throw error; // Rethrow the error to be handled by the caller
  }
}

module.exports = router