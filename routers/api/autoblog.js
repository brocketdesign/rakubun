// AutoBlog
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { ObjectId } = require('mongodb');
const { getCategoryId } = require('../../modules/post')
const { setCronJobForUser } = require('../../modules/cronJobs');
var wordpress = require("wordpress");

router.post('/info', async (req, res) => {
  const userId = req.user._id;
  const blogData = req.body;

  try {
    const blogId = await saveBlogInfo(userId, blogData);
    const blogInfo = await db.collection('blogInfos').findOne({ _id: new ObjectId(blogId) });
    await setCronJobForUser(db, blogId,blogInfo.postFrequency)
    res.status(201).send({ message: 'Blog info saved successfully', blogId });
  } catch (error) {
    console.log(error);
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
router.get('/info/:blogId', async (req, res) => {
  const { blogId } = req.params;

  try {
    const blogInfo = await global.db.collection('blogInfos')
                             .findOne({_id: new ObjectId(blogId), userId: new ObjectId(req.user._id)});

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
router.delete('/info/:blogId', async (req, res) => {
  const { blogId } = req.params;

  try {
    // Optional: Check if the blog info belongs to the user before deletion
    const deletionResult = await global.db.collection('blogInfos')
                                  .deleteOne({_id: new ObjectId(blogId), userId: new ObjectId(req.user._id)});
    
    if (deletionResult.deletedCount === 0) {
      return res.status(404).json({ message: 'Blog information not found or access denied.' });
    }

    res.json({ message: 'Blog information deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/duplicate/:blogId', async (req, res) => {
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
      console.log(`New blog`)
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


module.exports = router