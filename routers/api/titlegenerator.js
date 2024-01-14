const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Sets up multer for file uploads

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
    const { keywords, country, language } = data;
    const formattedKeywords = keywords.join(', '); // Assuming keywords is an array
  
    return `Generate 5 creative and SEO-friendly titles in ${language} for a blog post targeting the audience in ${country}, related to the following keywords: ${formattedKeywords}.`;
  }
  
  // Function to parse the response from OpenAI
  function parseOpenAIResponse(responseText) {
    // Assuming each title is separated by a newline
    return responseText.trim().split('\n').filter(title => title.length);
  }
  
  // The main function to call the OpenAI API and generate titles
  async function generateTitle(data) {
    try {
      const response = await openai.completions.create({
            model: "gpt-3.5-turbo-instruct",
            prompt: generatePrompt(data),
            max_tokens: 150,
            temperature: 0.7, // Adjust this as needed for creativity
            top_p: 1, // Typical value for most use cases
            frequency_penalty: 0, // Adjust if you want to penalize frequent tokens
            presence_penalty: 0, // Adjust if you want to penalize new tokens
            //n: 5, // Generate 5 completions
            //stop: ["\n"] // Stop the completions at new line
      });
  
      console.log(response)
      // Parse the response to get the titles
      const titles = parseOpenAIResponse(response.choices[0].text);
      console.log(titles)
      return titles;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return [];
    }
  }
  
  module.exports = router