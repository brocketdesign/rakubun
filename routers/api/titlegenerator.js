const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Sets up multer for file uploads
const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Make sure you have set your API key in the environment variables
  });
  router.post('/generate-titles', async (req, res) => {
    console.log(req.body)
    const titles = await generateTitle(req.body)
    res.json(titles);
});

// Function to generate the prompt text based on the received data
function generatePrompt(data) {
    const { keywords, country, language, formattedKeywords, seoSearch } = data;
    return `Generate 5 creative and SEO-friendly titles in ${language} for a blog post targeting the audience in ${country}, related to the following keywords: ${formattedKeywords}. Here are some examples : ${seoSearch}`;
  }
  
  // Function to parse the response from OpenAI
  function parseOpenAIResponse(responseText) {
    // Assuming each title is separated by a newline
    return responseText.trim().split('\n').filter(title => title.length);
  }
  
  // The main function to call the OpenAI API and generate titles
  async function generateTitle(data) {
    try {

      data.formattedKeywords = data.keywords.join(', '); // Assuming keywords is an array
      data.seoSearch = await getSearchResult(data.formattedKeywords) 
      console.log(data)
  
      const response = await openai.completions.create({
            model: "gpt-3.5-turbo-instruct",
            prompt: generatePrompt(data),
            max_tokens: 300,
            temperature: 0.7, // Adjust this as needed for creativity
            top_p: 1, // Typical value for most use cases
            frequency_penalty: 0, // Adjust if you want to penalize frequent tokens
            presence_penalty: 0, // Adjust if you want to penalize new tokens
            //n: 5, // Generate 5 completions
            //stop: ["\n"] // Stop the completions at new line
      });
  
      // Parse the response to get the titles
      const titles = parseOpenAIResponse(response.choices[0].text);
      return titles;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return [];
    }
  }

  async function getSearchResult(query) {
      const google = {
          api_id: process.env.GOOGLE_RAKUBUN_API,
          engine_id: process.env.GOOGLE_SEARCH_ENGINE_ID
      };
  
      const url = new URL(`https://www.googleapis.com/customsearch/v1?key=${google.api_id}&cx=${google.engine_id}&q=${query}&num=5`).href;
  
      try {
          const response = await axios.get(url);
          return processSearchResults(response.data); // Contains the search results
      } catch (error) {
          console.error('Error fetching search results:', error);
          return null; // Or handle the error as needed
      }
  }

  function processSearchResults(data) {
    if (!data || !data.items) {
        console.error('Invalid or empty search data');
        return [];
    }
    // Process the search results here
    // For example, extract titles and links
    return data.items.map(item => {
        return item.title;
    });
}
  module.exports = router