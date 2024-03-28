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
    res.render('dashboard/top', {
      user: req.user,
      title: "RAKUBUN - Dashboard",
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Route for handling '/generator/'
router.get('/app/generator/:appname', ensureAuthenticated,ensureMembership, async (req, res) => {  
  const appname = req.params.appname
  res.render('dashboard/app/generator/'+appname,{user:req.user,title:"RAKUBUN - Dashboard"});
});
// Route for handling '/rss/'
router.get('/app/rss', ensureAuthenticated,ensureMembership, async (req, res) => {  
  res.render('dashboard/app/rss/index',{user:req.user,title:"RAKUBUN - Dashboard"});
  
});
// Route for handling '/feed/'
router.get('/app/feed', ensureAuthenticated,ensureMembership, async (req, res) => {  
  res.render('dashboard/app/rss/feed',{user:req.user,title:"RAKUBUN - Dashboard"});
});
// Assuming 'ensureAuthenticated' and 'ensureMembership' middleware functions are correctly setting up 'req.user'

router.get('/app/autoblog', ensureAuthenticated, ensureMembership, async (req, res) => {
  const blogUrl = req.query.blogUrl
  let blogData
  try {
    // Fetching blog data for the current user
    blogData = await global.db.collection('blogInfos')
                            .find({userId: new ObjectId(req.user._id)})
                            .sort({_id:-1})
                            .toArray(); 
    if(blogUrl){
      blogData = getDataFor(blogData,blogUrl)
    }else{
      blogData = listOfBlogs(blogData,blogUrl)
    }
    res.render('dashboard/app/autoblog/list', {
      user: req.user,
      blogData, 
      blogUrl,
      title: "RAKUBUN - Dashboard"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});

function listOfBlogs(blogData) {
  // Use a Map to keep track of unique URLs and their corresponding names
  const blogMap = new Map();

  // Loop through each blog in blogData
  blogData.forEach(blog => {
    // If the URL isn't already in the map, add it with its name
    if (!blogMap.has(blog.blogUrl)) {
      blogMap.set(blog.blogUrl, blog.blogName);
    }
  });

  // Now, let's convert our map back into an array of objects as requested
  const uniqueBlogsArray = Array.from(blogMap, ([blogUrl, blogName]) => ({
    blogUrl,
    blogName
  }));

  return uniqueBlogsArray;
}


function getDataFor(blogData, blogUrl) {
  // Filter the blogData array to find objects where the blogUrl matches
  const matchingBlogs = blogData.filter(blog => blog.blogUrl === blogUrl);

  // Return the array of objects that have the matching blogUrl
  return matchingBlogs;
}

router.get('/app/autoblog/info/:blogId?', async (req, res) => {
  const { blogId } = req.params || null; // Extract blogId from URL parameters, if available

  try {
    res.render('dashboard/app/autoblog/info', {
      user: req.user,
      blogId, // Pass the specific blog info or null to the template
      title: "RAKUBUN - Dashboard"
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});


module.exports = router;
