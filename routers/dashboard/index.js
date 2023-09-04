const express = require('express');
const router = express.Router();

const fs = require('fs');
const OpenAI = require('mongodb');

const BasicPlan = {
  id: process.env.STRIPE_BASIC_PLAN,
  price: process.env.STRIPE_BASIC_PLAN_PRICE,
  type: process.env.STRIPE_BASIC_PLAN_TYPE
}
const PremiumPlan = {
  id: process.env.STRIPE_PREMIUM_PLAN,
  price: process.env.STRIPE_PREMIUM_PLAN_PRICE,
  type: process.env.STRIPE_PREMIUM_PLAN_TYPE
}

const ensureAuthenticated = require('../../middleware/authMiddleware');
const ensureMembership = require('../../middleware/ensureMembership');
const { 
  formatDateToDDMMYYHHMMSS, 
  saveData ,
  translateText ,
  fetchMediaUrls, 
  findDataInMedias,
  sanitizeData,
  updateSameElements,
  getOpenaiTypeForUser,
  fetchOpenAICompletion,
  initCategories,
  saveDataSummarize
} = require('../../services/tools')

const ManageScraper = require('../../modules/ManageScraper');
const { ObjectId } = require('mongodb');

// Route for handling '/dashboard/'
router.get('/', ensureAuthenticated,ensureMembership, async (req, res) => {
  const userId = req.user._id;

  const latestNews = await global.db.collection('latestNews').find().limit(2).toArray();
  const books = await fetchUserAssociatedData(userId, 'users', 'books', 'bookIds');
  const memos = await fetchUserAssociatedData(userId, 'users', 'memo', 'memoIds');

  res.render('dashboard/top',{user:req.user,latestNews,books,memos,title:"Dashboadr"});
});

router.get('/app/openai/:app', ensureAuthenticated, ensureMembership, async (req, res) => {
  //await global.db.collection('openai').deleteMany()
  const userOpenaiDocs = await getOpenaiTypeForUser(req.user._id, req.params.app);
  console.log(userOpenaiDocs)
  res.render(`chatgpt/${req.params.app}.pug`, { user:req.user,userOpenaiDocs, title:'ChatGPT '+req.params.app });
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode', ensureAuthenticated,ensureMembership, async (req, res) => {

  try {
      const { mode } = req.params; // Get the 'mode' parameter from the route URL
      let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
      nsfw = req.user.nsfw === 'true'?true:false
      page = parseInt(page) || 1
    
      console.log(`Dashboard mode ${mode} requested`);

      if(!searchTerm){
        res.redirect(`/dashboard/app/${mode}/history`); // Pass the user data and scrapedData to the template
        return
      }
      // If 'mode' is not provided, use the mode from the session (default to '1')
      const currentMode = mode || req.session.mode || '1';
    
      await initCategories(req.user._id)
      let scrapedData = await ManageScraper(searchTerm,nsfw,mode,req.user, page);

      let scrapInfo  
      try {
        const userInfo = await global.db.collection('users').findOne({_id:new ObjectId(req.user._id)})
        scrapInfo = userInfo.scrapInfo.find(info => info.url === searchTerm);
      } catch (error) {
        console.log(error)
      }
      res.render(`search`, { user: req.user, result:true, searchTerm, scrapedData, scrapInfo, mode, page, title: `Mode ${mode} : ${searchTerm}` }); // Pass the user data and scrapedData to the template
    
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred while scraping.');
  }
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/fav', ensureAuthenticated,ensureMembership, async (req, res) => {

  console.log('Dashboard page requested');
  const { mode } = req.params; // Get the 'mode' parameter from the route URL
  let { searchTerm, nsfw, page } = req.query; // Get the search term from the query parameter
  nsfw = req.user.nsfw === 'true'?true:false
  page = parseInt(page) || 1

  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';

  try{
    let query_obj = {
      query: {
        $regex: searchTerm,
      },
      mode:mode,
      nsfw:nsfw,
      isdl:true,
    }
    if(!searchTerm){
      console.log('Should see all')
      query_obj = {
        mode:mode,
        nsfw:nsfw,
        isdl:true,
      }
    }
    let medias = await findDataInMedias(req.user._id, query_obj);
    console.log(`Found ${medias.length} element(s).`)
    medias = getUniqueElementBySource(medias)
    res.render(`search`, { user: req.user,result:true, searchTerm, scrapedData:medias.reverse(), mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template

  }catch(err){
    console.log(err)
    res.render(`search`, { user: req.user, searchTerm, scrapedData:[], mode, page, title: `Mode ${mode}` }); // Pass the user data and scrapedData to the template

  }
  
});

// Route for handling '/dashboard/:mode'
router.get('/app/:mode/history', ensureAuthenticated, ensureMembership, async (req, res) => {

  console.log('Dashboard history page requested');
  const { mode, categoryId } = req.params; // Get the 'mode' parameter from the route URL

  // If 'mode' is not provided, use the mode from the session (default to '1')
  const currentMode = mode || req.session.mode || '1';
  const userId = new ObjectId(req.user._id);

  const nsfw = req.user.nsfw === 'true'

  try{

    const medias = await findDataInMedias(userId, {
      mode: mode,
      nsfw: nsfw,
      hide_query: { $exists: false },
    }, categoryId);

    console.log(`Found ${medias.length} items.`)
    const data = mapArrayHistory(medias)
    const userOpenAi = await mapArrayOpenai(req.user)
    res.render('history', { user: req.user,userOpenAi, data, mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

  } catch (error) {
    console.log(error);
    res.render('history', { user: req.user, data:[], mode, title: `History of mode ${mode}` }); // Pass the user data and uniqueCurrentPages to the template

  }
});

const fetchUserAssociatedData = async (userId, userCollection, targetCollection, field) => {
  const userData = await global.db.collection(userCollection).findOne(
    { _id: new ObjectId(userId) },
    { projection: { [field]: 1 } }
  );

  let data = [];

  if (userData && userData[field] && userData[field].length > 0) {
    data = await global.db.collection(targetCollection).find(
      { _id: { $in: userData[field].map(id => new ObjectId(id)) } }
    ).sort({ _id: -1 }).toArray();
  }

  return data;
};
function getUniqueElementBySource(medias) {
  // Map the sources and filter those that are undefined
  const undefinedSources = medias.filter(object => object.link === undefined);

  let uniqueData = [];
  let seenSources = new Set();
  
  for (let item of medias) {
    if (item.link === undefined) {
        continue; // Skip undefined sources, as we've already collected them
    }
    
    if (!seenSources.has(item.link)) {
        seenSources.add(item.link);
        uniqueData.push(item);
    }
}

  // Combine unique data with the undefined sources
  return [...uniqueData, ...undefinedSources]; // Now, the return value contains unique items based on the source property and all items with an undefined source.
}
async function mapArrayOpenai(user){
  const summarize = user.openai_summarize

  const all_summarize = await findAllOpenAI(summarize)
  const info_summarize = await findAllData(all_summarize)

  return info_summarize
}
async function findAllOpenAI(data){
  let result = [];
  try {
    // Get a reference to the 'openai' collection
    const collection = global.db.collection('openai');

    // Convert string IDs to ObjectIds
    const objectIds = data.map(id => new ObjectId(id));

    // Find all matching documents in the 'openai' collection
    result = await collection.find({
      '_id': { '$in': objectIds }
    }).toArray();


    // Extract the videoId fields into a new array
    result = result.map(doc => doc.videoId);

    // If no documents are found
    if(result.length === 0) {
      console.log("一致するドキュメントはありません。"); // No matching documents
    }

    return result
  } catch (err) {
    console.error("データベースエラー:", err); // Database error
  }
}
async function findAllData(data){
  let result = [];
  try {
    // Get a reference to the 'openai' collection
    const collection = global.db.collection('medias');

    // Convert string IDs to ObjectIds
    const objectIds = data.map(id => new ObjectId(id));

    // Find all matching documents in the 'openai' collection
    result = await collection.find({
      '_id': { '$in': objectIds }
    }).toArray();

    // If no documents are found
    if(result.length === 0) {
      console.log("一致するドキュメントはありません。"); // No matching documents
    }

    return result
  } catch (err) {
    console.error("データベースエラー:", err); // Database error
  }
}
function mapArrayHistory(medias) {
  let highestPagePerQuery = {}; // Map to keep track of the highest page for each query
  let queryMap = {};

  medias.forEach(item => {
    if (!item.query) return;

    const page = parseInt(item.page);

    // If this is the highest page for this query, update highestPagePerQuery
    if (!highestPagePerQuery[item.query] || page > highestPagePerQuery[item.query]) {
      highestPagePerQuery[item.query] = page;
    }
  });

  // Iterate through filteredData again, adding items to queryMap only if they are on the highest page for that query
  medias.forEach(item => {
    if (!item.query) return;

    const page = parseInt(item.page);

    if (page === highestPagePerQuery[item.query]) {
      const key = item.query;
      if (!queryMap[key]) {
        queryMap[key] = [];
      }

      if (queryMap[key].length < 4 && item.hide !== true) {
        queryMap[key].push(item);
      }
    }
  });

  return queryMap; // Return an object with one set of data for each query, containing the items for the highest page
}
module.exports = router;
