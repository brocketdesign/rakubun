const express = require('express');
const router = express.Router();

const getHighestQualityVideoURL = require("../../modules/getHighestQualityVideoURL")
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { askGPT } = require('../../services/tools')
const userCategoryController = require('../../controllers/category');
const mediasCategoryController = require('../../controllers/medias-category');
const postArticleToWordpress = require('../../modules/postArticleToWordpress')
const ManageScraper = require('../../modules/ManageScraper');

const axios = require('axios');
const fs = require('fs');
const url = require('url');
const { MongoClient, ObjectId } = require('mongodb');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


router.post('/user/:elementCreated', async (req, res) => {
  try {
      const userID = new ObjectId(req.user._id);
      const elementCreated = req.params.elementCreated;
      const content = req.body.content;

      console.log(`Request for ${elementCreated} by ${userID}. Data: ${content}`);

      // 1. Create a new document in the elementCreated collection
      const creationResult = await global.db.collection(elementCreated).insertOne({ content: content });

      // 2. Get the _id of the newly created document
      const newElementId = creationResult.insertedId;

      // 3. Push this _id into the user's elementCreated + "Ids" array
      const fieldToUpdate = elementCreated + "Ids";
      console.log(fieldToUpdate)
      const updateUserResult = await global.db.collection('users').updateOne(
          { _id: userID },
          { $push: { [fieldToUpdate]: newElementId } }
      );

      if (updateUserResult.modifiedCount === 1) {
          res.status(200).send({ message: 'Data added successfully', newElementId: newElementId });
      } else {
          res.status(400).send({ message: 'Failed to add data' });
      }
  } catch (error) {
      console.error('Error updating user data:', error);
      res.status(500).send({ message: 'Internal server error' });
  }
});

router.delete('/user/:elementRemoved/:elementId', async (req, res) => {
    try {
        const userID = new ObjectId(req.user._id);
        const elementRemoved = req.params.elementRemoved; // This should be "memo" in your use case
        const elementIdToRemove = new ObjectId(req.params.elementId); // The ID of the memo to be removed

        console.log(`Request to remove ${elementRemoved} with ID ${elementIdToRemove} for user ${userID}`);

        // Construct the field name by appending "Ids" to the elementRemoved value
        const fieldToUpdate = elementRemoved + "Ids";

        // Remove the specified ID from the user's elementRemoved + "Ids" array
        const updateUserResult = await global.db.collection('users').updateOne(
            { _id: userID },
            { $pull: { [fieldToUpdate]: elementIdToRemove } }
        );

        if (updateUserResult.modifiedCount === 1) {
            res.status(200).send({ message: 'Data removed successfully' });
        } else {
            res.status(400).send({ message: 'Failed to remove data' });
        }
    } catch (error) {
        console.error('Error updating user data:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Wordpress 
router.post('/post-article', async (req, res) => {
  const wordpress = require( "wordpress" );

  const client = wordpress.createClient({
    url: req.user.wpURL,
    username: req.user.wpUsername,
    password: req.user.wpPassword
  });
  
  const { title, content } = req.body;

  if (!content) {
      res.status(400).json({status: 'error', message: 'Article content is required'});
      return;
  }

  try {

      const response = await client.newPost({
          title: title,
          content: content,
          status: eq.user.wpPostStatus || 'draft'
      }, function( error, id ){
        if(!error){
          res.status(200).json({status: 'success', message: `Article posted successfully with ID: ${id}`,link:`${req.user.wpURL}/`});
        }else{
          console.error(error);
          res.status(500).json({status: 'error', message: 'Internal server error'});
        }
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({status: 'error', message: 'Internal server error'});
  }
});

router.post('/submit/:sectionName', ensureAuthenticated, (req, res) => {
  const sectionName = req.params.sectionName;
  const formData = req.body;

  // Save the form data to the MongoDB collection
  global.db
    .collection(sectionName)
    .updateOne({ userId: req.user._id }, { $set: formData }, { upsert: true })
    .then(result => {
      res.json({ message: 'Data saved successfully.' });
    })
    .catch(err => {
      console.log('Submit error:', err);
      res.status(500).json({ error: err });
    });
});

// Define a route to handle video requests
router.get('/video', async (req, res) => {
  try {
    const { videoId } = req.query;
    
    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})
    // Call the function to get the highest quality video URL for the provided id
    const url = await getHighestQualityVideoURL(videoId,req.user);

    if (!url) {
      return res.status(404).json({ error: 'Video not found or no valid URL available.' });
    }

    // Respond with the highest quality video URL
    return res.json({ url,data:foundElement });
  } catch (error) {
    console.error('Error occurred while processing the request:', error);
    return res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

router.post('/hide', async (req, res) => {
  let { element_id, category} = req.body;

  if (!element_id ) {
    return res.status(400).json({ message: 'IDまたはカテゴリが提供されていません' });
  }
  if(!category){
      // Find the current user's data
    const user = await global.db.collection('users').findOne({ _id: new ObjectId(req.user._id) });

    // Check if the category "All" already exists
    let base_category = user.categories && user.categories.find(cat => cat.name === 'All');

    // If the category already exists, return its ID in an array
    category = [base_category.id];
  }
  try {
    // このエレメントIDに関連するソースを見つける (Find the source related to this element_id)
    const element = await global.db.collection('medias').findOne({ _id: new ObjectId(element_id) });
    const source = element.source; // ソースの取得 (Assuming 'source' is the field you want to match)

    console.log({source})
    if(source && source != undefined){
      // 同じソースを持つすべてのエレメントを更新する (Update all elements with the same source)
      const result = await global.db.collection('medias').updateMany(
        { source: source }, // 条件 (Criteria: Match all documents with the same source)
        {
          $pull: { categories: category.toString() }, // カテゴリの削除 (Removing the category)
          $set: { hide: true } // 非表示フィールドを追加 (Add hide field)
        }
      );   
      console.log(`Updated ${result.modifiedCount} elements with the same source.`);

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: '要素が見つかりませんでした' });
      }

    }else{
      const result = await global.db.collection('medias').updateOne(
        { _id: new ObjectId(element_id) }, // 条件 (Criteria: Match all documents with the same source)
        {
          $pull: { categories: category.toString() }, // カテゴリの削除 (Removing the category)
          $set: { hide: true } // 非表示フィールドを追加 (Add hide field)
        }
      );   
      console.log(`Updated ${result.modifiedCount} elements with the same source.`);

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: '要素が見つかりませんでした' });
      }
    }

    console.log('メディアが正常に更新されました');
    res.status(200).json({ message: 'この要素はもう表示されません' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' });
  }
});

router.post('/hideHistory', async (req, res) => {
  const { query, category } = req.body;
  console.log('クエリを非表示にする:', query); // Hide the query: query
  if (!query) {
    return res.status(400).json({ message: 'クエリが提供されていません' }); // Query not provided
  }

  const userId = req.user._id; // Assuming you are getting userId from a logged in user
  
  try {
    // Getting all the medias that match the query
    const medias = await global.db.collection('medias').find({ query }).toArray();
    
    // Looping through each media and removing the category from the categories array
    for (const media of medias) {
      await global.db.collection('medias').updateOne(
        { _id: media._id }, // 条件 (Criteria)
        { 
          $pull: { categories: category } ,
          $set:{hide_query:true}
        }
      );
    }
    
    console.log('メディアが正常に更新されました'); // Media has been successfully updated

    res.status(200).json({ message: 'この要素はもう表示されません' }); // This element won't be displayed anymore
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'エラーが発生しました' }); // An error occurred
  }
});

// User category routes
router.post('/user-category/add', userCategoryController.add);
router.put('/user-category/update', userCategoryController.update);
router.delete('/user-category/delete', userCategoryController.delete);
router.post('/user-category/get', userCategoryController.get); // Using POST here as we might send query data in the request body

// Medias category routes
router.post('/medias-category/add', mediasCategoryController.add);
router.delete('/medias-category/delete', mediasCategoryController.delete);
router.delete('/medias-category/deleteAll', mediasCategoryController.deleteAll);
router.post('/medias-category/get', mediasCategoryController.get); // Using POST here as we might send query data in the request body

// Route to fetch media documents by category ID
router.get('/medias-category/:categoryId', async (req, res) => {
  const categoryId = req.params.categoryId;
console.log(`Request medias category : ${categoryId}`)
  try {
      // Fetch media documents that contain the provided category ID
      // and sort them from most recent to less recent
      const medias = await global.db.collection('medias').find({
          userId: new ObjectId(req.user._id),
          categories: new ObjectId(categoryId)
      }).sort({ createdAt: -1 }).toArray();  // Assuming your documents have a createdAt field

      if (medias.length > 0) {
          res.json(medias);
      } else {
          // If no medias are found, return an empty array
          res.json([]);
      }
  } catch (err) {
      res.status(500).send({
          error: 'サーバーエラーが発生しました。'  // "A server error occurred."
      });
  }
});
// ルーターを定義して '/loadpage' への POST リクエストを処理します
router.post('/loadpage', async (req, res) => {
  console.log('API request loadmore')
  try {
    // リクエストボディをコンソールにログ

    const data = { 
      searchTerm: req.body.searchterm || req.body.searchTerm , 
      page: req.body.page ,
      mode: req.body.mode 
    }
    
    let scrapedData = await ManageScraper(
      data.searchTerm,
      data.mode,
      req.user, 
      parseInt(data.page)
      );
  
    // JSON 応答を送る
    res.status(200).json({
      status: '成功', // Status as success
      message: 'ページが正常にロードされました' // Message indicating the page has been successfully loaded
    });
} catch (error) {
  console.log(error)
  res.status(500).json({
    status: 'Error', // Status as success
    message: 'An error occured' // Message indicating the page has been successfully loaded
  });
}
});

router.post('/postArticle', async (req, res) => {
  // Get user information and article details from request
  const user = req.user;
  const title = req.body.title;
  const content = req.body.content;
  const new_title = await askGPT(`Generate a SEO title for an article about : \n ${content} \n Your respose must be in japanese, without any comments.`)

  try {
    // Make sure the user exists and is valid
    if (!user || !ObjectId.isValid(new ObjectId(user._id))) {
      return res.json({
        status: 'error',
        message: 'ユーザーが無効です' // User is invalid
      });
    }

    // Post the article to WordPress
    const result = await postArticleToWordpress({ user, title:new_title, content });

    // Check if posting was successful (this depends on what your function returns)
    if (result) {
      return res.json({
        status: 'success',
        message: '記事が正常に投稿されました' // Article successfully posted
      });
    } else {
      return res.json({
        status: 'error',
        message: '記事の投稿に失敗しました' // Failed to post the article
      });
    }

  } catch (error) {
    // Handle any errors that occurred during the process
    console.error("Error in posting article: ", error);
    return res.json({
      status: 'error',
      message: '内部エラーが発生しました' // Internal error occurred
    });
  }
});

module.exports = router;
