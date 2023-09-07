const { MongoClient, ObjectId } = require('mongodb');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // You'll need to install axios: npm install axios
const { createParser } = require('eventsource-parser');
const fetch = require('node-fetch');


// Initialize OpenAI with your API key
let openai = null
try {
    openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('Successfully initialized OpenAI API');
} catch (err) {
  console.error('Error occurred while initializing OpenAI API...', err);
}

function formatDateToDDMMYYHHMMSS() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).substr(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ddmmyyhhmmss = `${day}${month}${year}${hours}${minutes}${seconds}`;
  return ddmmyyhhmmss;
}


async function saveData(user, documentId, update){
  try {
    
    // Step 1: Fetch the document based on the _id
    const resultElement = await global.db.collection('medias').findOne({ _id: new ObjectId(documentId) });
    
    if (resultElement) {
       // Step 2: Update that document
       const result = await global.db.collection('medias').updateOne(
        { _id: new ObjectId(documentId) },
        { $set: update }
      );
      
      // Check if the document was updated
      if (result.matchedCount > 0) {
        updateSameElements(resultElement,update)
        return true;
      } else {
          console.log("Failed to update the document.");
          return false;
      }
    }
  } catch (error) {
    console.log('Element not founded in medias collections');
  }
  
   try {
     const { elementIndex, foundElement } = await findElementIndex(user, documentId);
 
     if (elementIndex === -1) {
       console.log('Element with video_id not found.');
       return;
     }
 
     const userId = user._id;
     const userInfo = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
     const AllData = userInfo.scrapedData || [];
     AllData[elementIndex] = Object.assign({}, AllData[elementIndex], update);
 
     const result = await global.db.collection('users').updateOne(
       { _id: new ObjectId(userId) },
       { $set: { scrapedData: AllData } }
     );

     if(result.matchedCount > 0){
      console.log(`Updated the database `,update)
     }else{
      console.log('Could not update the database')
     }

     return true
   } catch (error) {
      console.log(error)
      console.log('Could not save the data in the user data')
   }
   return false
}

async function askGPT(prompt) {
  const messages = [
    { role: 'system', content: 'You are a powerful japanese assistant' },
    { role: 'user', content: prompt },
];
  const gptResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",  // Updated to GPT-3 Turbo
    messages,
    max_tokens: 100,
    temperature: 0,
  });
  const content = gptResponse.choices[0].message.content.trim();

  return content;
}

async function findDataInMedias(userId, query, categoryId = null) {
  // Retrieve the current user's data
  const user = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });
  await initCategories(userId)
  // If a specific category ID is provided, use it
  // Otherwise, find the "All" category within the user's categories
  let categoryToUse;
  if (categoryId) {
    categoryToUse = user.categories && user.categories.find(cat => cat.id.toString() === categoryId.toString());
    if (!categoryToUse) {
      throw new Error('指定されたカテゴリが見つかりませんでした'); // Specified category not found
    }
  } else {
    categoryToUse = user.categories && user.categories.find(cat => cat.name === 'All');
    if (!categoryToUse) {
      throw new Error('カテゴリ「All」が見つかりませんでした'); // Category "All" not found
    }
  }

  // Add the category ID to the query
  query.categories = { $in: [categoryToUse.id.toString()] };

  // Find the medias that match the query
  const medias = await global.db.collection('medias').find(query).toArray();

  return medias;
}

function sanitizeData(scrapedData,query) {
  //check for object with the same source and keep only one
  let uniqueData = [];
  let seenSources = new Set();
  
  for (let item of scrapedData) {
      if (!seenSources.has(item[query])) {
          seenSources.add(item[query]);
          uniqueData.push(item);
      }
  }

  return uniqueData
}

async function updateItemsByField(fieldName, fieldValue, query) {
  const itemsWithSameLink = await global.db.collection('medias').find({ [fieldName]: fieldValue }).toArray();
  console.log(`Found ${itemsWithSameLink.length} item(s) with the same ${fieldName} `, fieldValue);

  for (let item of itemsWithSameLink) {
      await global.db.collection('medias').updateOne({ _id: new ObjectId(item._id) }, { $set: query });
  }
}

async function updateSameElements(foundElement, query) {

  if (foundElement.source) {
      await updateItemsByField('source', foundElement.source, query);
  }
  if (foundElement.url) {
      await updateItemsByField('url', foundElement.url, query);
  }
  if (foundElement.link) {
      await updateItemsByField('link', foundElement.link, query);
  }
  
}
async function getOpenaiTypeForUser(userId, type) {
  // 1. Fetch the user's document.
  const userDoc = await global.db.collection('users').findOne({ _id: new ObjectId(userId) });

  // If userDoc doesn't exist or doesn't have the specified openai_type, return an empty array.
  if (!userDoc || !userDoc[`openai_${type}`]) {
    return [];
  }

  // 2. Extract the list of openai document IDs from the user's document.
  const openaiIds = userDoc[`openai_${type}`].map(id => new ObjectId(id));

  // 3. Fetch the openai documents using the extracted IDs.
  const openaiDocs = await global.db.collection('openai').find({ _id: { $in: openaiIds } }).sort({_id:-1}).toArray();

  return openaiDocs;
}
const fetchOpenAICompletion = async (messages, res) => {
  try {
      let response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
              },
              method: "POST",
              body: JSON.stringify({
                  model: process.env.COMPLETIONS_MODEL,
                  messages,
                  temperature: 0.75,
                  top_p: 0.95,
                  frequency_penalty: 0,
                  presence_penalty: 0,
                  max_tokens: 150,
                  stream: true,
                  n: 1,
              }),
          }
      );

      // Log the status and status text
      console.log("Response status:", response.status);
      console.log("Response status text:", response.statusText);

      // If the status indicates an error, log the response body
      if (!response.ok) {
          console.error("Response body:", await response.text());
      }

      let fullCompletion = ""; // Variable to collect the entire completion
      let chunkIndex = 0; // Variable to keep track of the current chunk's index
      const parser = createParser((event) => {
        try { // Add try block to catch potential errors
          if (event.type === 'event') {
            if (event.data !== "[DONE]") {
              const content = JSON.parse(event.data).choices[0].delta?.content || "";
              //console.log(`Chunk Index: ${chunkIndex}, Content: ${content}`); // Uncomment this line to log chunks
              fullCompletion += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
              res.flush(); // Flush the response to send the data immediately
              chunkIndex++; // Increment the chunk index
            }
          }
        } catch (error) { // Catch block to handle any errors
          console.log(error)
          console.error("Error in parser:", error);
          console.error("Event causing error:", event);
        }
      });


      for await (const chunk of response.body) {
        parser.feed(new TextDecoder('utf-8').decode(chunk));
      }
      
      return fullCompletion;

  } catch (error) {
      console.error("Error fetching OpenAI completion:", error);
      throw error;
  }
}


async function initCategories(userId) {
  // Convert userId to ObjectId
  const objectId = new ObjectId(userId);

  // Find the current user's data
  const user = await global.db.collection('users').findOne({ _id: objectId });
  
  // Utility function to check if a category exists and create if it doesn't
  async function createCategoryIfNotExists(categoryName) {
    const existingCategory = user.categories && user.categories.find(cat => cat.name === categoryName);

    // If category doesn't exist, create and return it
    if (!existingCategory) {
      const newCategory = { id: new ObjectId().toString(), name: categoryName };
      await global.db.collection('users').updateOne(
        { _id: objectId },
        { $push: { categories: newCategory } }
      );
      return newCategory;
    }

    // If it exists, return the existing one
    return existingCategory;
  }

  // Check and create "All" category if it doesn't exist
  const allCategory = await createCategoryIfNotExists('All');

  // Check and create "Favorites" category if it doesn't exist
  await createCategoryIfNotExists('Favorites');

  // Check and create "Delete" category if it doesn't exist
  await createCategoryIfNotExists('Delete');

  // Return the "All" category's ID in an array
  return [allCategory.id];
}


async function saveDataSummarize(videoId, format){
  try {
    const foundElement = await global.db.collection('medias').findOne({_id:new ObjectId(videoId)})

    format.last_summarized = Date.now();
    const result = await global.db.collection('medias').updateOne(
      {_id:new ObjectId(videoId)},
      {$set:format}
    )

    console.log(`${result.modifiedCount} element updated in the database.`);
  } catch (error) {
    console.log('Error while updating element:', error);
  }
}

module.exports = { 
  formatDateToDDMMYYHHMMSS, 
  saveData ,
  askGPT,
  findDataInMedias,
  sanitizeData,
  updateSameElements,
  getOpenaiTypeForUser,
  fetchOpenAICompletion,
  initCategories,
  saveDataSummarize
}