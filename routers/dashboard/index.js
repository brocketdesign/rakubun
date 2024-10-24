const express = require('express');
const router = express.Router();

const fs = require('fs');
const OpenAI = require('mongodb');
const { premiumPlan} = require('../../modules/products')
const ensureAuthenticated = require('../../middleware/authMiddleware');
const ensureMembership = require('../../middleware/ensureMembership');
const {sendEmail} = require('../../services/email')
const path = require('path');
const { ObjectId } = require('mongodb');

// Route for handling '/dashboard/'
router.get('/', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    //return res.redirect('/dashboard/app/autoblog')

    return res.render('dashboard/top', {
      user: req.user,
      title: "RAKUBUN - Dashboard",
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

router.get('/app/transcription', async (req, res) => {
  const userId = req.user._id;
  const files = await db.collection('files').find({ userId: new ObjectId(userId) }).toArray();
  res.render('dashboard/app/transcription', { 
    files,
    user:req.user,
   });
});
router.get('/app/mailgen', async (req, res) => {
  const userId = req.user._id;
  res.render('dashboard/app/mailgen', { 
    user:req.user,
   });
});
router.get('/app/pdfsummary', async (req, res) => {
  const File = require('../../models/File');
  const userId = req.user._id;
  const files = await File.find({ userId });
  res.render('dashboard/app/pdfsummary', {
    user: req.user,
    files
  });
});

// Route for handling '/generator/'
router.get('/app/generator/:appname', ensureAuthenticated,ensureMembership, async (req, res) => {  
  const appname = req.params.appname
  res.render('dashboard/app/generator/'+appname,{user:req.user,title:"RAKUBUN - Dashboard"});
});
const adminMail = 'japanclassicstore@gmail.com'

router.get('/app/autoblog', ensureAuthenticated, ensureMembership, async (req, res) => {
  const blogId = req.query.blogId ? new ObjectId(req.query.blogId) : null;
  const botId = req.query.botId && req.query.botId != 'undefined'
    ? new ObjectId(req.query.botId) : null;
  const userId = new ObjectId(req.user._id);
  let blogData;
  let botData;
  let postData;

  try {
    // Fetching blog data for the current user
    blogData = await global.db.collection('blogInfos')
      .find({ userId: userId })
      .sort({ _id: -1 })
      .toArray();

    // Count bots for each blog
    for (let i = 0; i < blogData.length; i++) {
      const botCount = await global.db.collection('botInfos')
        .countDocuments({ blogId: (blogData[i]._id.toString()) });
      blogData[i].botCount = botCount;
    }

    if (blogId != null) {
      blogData = await global.db.collection('blogInfos').findOne({ _id: blogId });
      botData = await global.db.collection('botInfos').find({ blogId: blogId }).toArray();
    }

    if (botId != null) {
      botData = await global.db.collection('botInfos').findOne({ _id: botId });
      postData = await global.db.collection('articles').find({ botId }).toArray();
    }
    const user = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });
    const sanitizedUser = {
      _id: user._id,
      subscriptionStatus: user.subscriptionStatus,
      profileImage: user.profileImage
    };
    const isAdmin = user?.email === adminMail;

    res.render('dashboard/app/autoblog/list', {
      user: sanitizedUser,
      isAdmin,
      blogData,
      botData,
      postData,
      botId,
      blogId,
      user:req.user,
      title: "RAKUBUN - Dashboard"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});


router.get('/app/autoblog/bot/', async (req, res) => {
  let { blogId, botId } =  req.query || null
  try {

    if(!blogId){
      blogId = await global.db.collection('botInfos').findOne({_id:new ObjectId(botId)})
      .then((botInfo)=>{
        return botInfo.blogId
      })
    }

    res.render('dashboard/app/autoblog/bot', {
      user: req.user,
      blogId, 
      botId,
      title: "RAKUBUN - Dashboard"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});

router.get('/app/autoblog/blog-info/:blogId?', async (req, res) => {
  const { blogId } = req.params || null; // Extract blogId from URL parameters, if available

  try {
    res.render('dashboard/app/autoblog/blog-info', {
      user: req.user,
      blogId, // Pass the specific blog info or null to the template
      title: "RAKUBUN - Dashboard"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});
router.get('/app/autoblog/article/edit/:articleId', async (req, res) => {
  try {
    const articleId = new ObjectId(req.params.articleId);
    const article = await global.db.collection('articles').findOne({ _id: articleId });
    res.render('dashboard/app/autoblog/edit',{ success: true, article });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});
module.exports = router;
