const fetch = require('node-fetch');
const { createParser } = require('eventsource-parser');

const apiDetails = {
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    key: process.env.OPENAI_API_KEY
  },
  novita: {
    apiUrl: 'https://api.novita.ai/v3/openai/chat/completions',
    model: 'google/gemma-2-9b-it',
    key: process.env.NOVITA_API_KEY
  },
  novita_nsfw: {
    apiUrl: 'https://api.novita.ai/v3/openai/chat/completions',
    model: 'openchat/openchat-7b',
    key: process.env.NOVITA_API_KEY
  },
  venice: {
    apiUrl: 'https://api.venice.ai/api/v1/chat/completions',
    model:  'llama-3.1-405b', //'dolphin-2.9.2-qwen2-72b',
    key: process.env.VENICE_API_KEY
  }
};

let currentModel = apiDetails.openai; // Change this to switch models

async function generateCompletion(messages, maxToken = 1000, model = null, lang = 'en') {
  const selectedModel = model ? apiDetails[model] : currentModel;
  const finalModel = lang === 'ja' ? apiDetails.openai : selectedModel;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(finalModel.apiUrl, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${finalModel.key}`
        },
        method: "POST",
        body: JSON.stringify({
            model: finalModel.model,
            messages,
            temperature: 0.85,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_tokens: maxToken,
            stream: false,
            n: 1,
        }),
      });

      if (!response.ok) {
        if (attempt === 2) {
          const errorData = await response.json().catch(() => ({}));
          console.log(`Failed after ${attempt} attempts:`, errorData.error?.message || '');
          return false;
        }
        continue; // Try second attempt
      }

      const data = await response.json();
      const filter = data.choices[0]?.content_filter_results;
      return data.choices[0].message.content.trim();
    } catch (error) {
      if (attempt === 2) {
        console.error(`Failed after ${attempt} attempts:`, error.message);
        return false;
      }
    }
  }
}
const fetchOpenAICompletion = async (messages,max_tokens, res) => {
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
                    model: "gpt-4o",
                    messages,
                    max_tokens,
                    temperature: 1.2,
                    top_p: 0.95,
                    frequency_penalty: 1.1, // Adjust if you want to penalize frequent tokens
                    presence_penalty: 1.1, // Adjust if you want to penalize new tokens
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

const moduleCompletion = async (promptData, PossibleAnswersExtraction = null) => {
  const { OpenAI } = require("openai");
  const { z } = require("zod");
  const { zodResponseFormat } = require("openai/helpers/zod");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await getChatResponse(promptData, promptData.max_tokens, PossibleAnswersExtraction);
  
  if (PossibleAnswersExtraction) {
    const parsed = response.choices[0].message?.parsed;

    return parsed?.answers && parsed.answers.length > 0
          ? parsed.answers 
          : parsed;

  } else {
    return response.choices[0].message.content;
  }

  async function getChatResponse(promptData, max_tokens, PossibleAnswersExtraction) {
    try {
      const modelGPT = promptData.model;
      
      let response;
      
      if (PossibleAnswersExtraction) {
        // Using the response_format for parsing with Zod
        response = await openai.beta.chat.completions.parse({
          model: modelGPT,
          messages: promptData.messages,
          response_format: zodResponseFormat(PossibleAnswersExtraction, "possible_answers_extraction"),
        });
      } else {
        // Standard completion request
        const options = {
          model: modelGPT,
          messages: promptData.messages,
          max_tokens: max_tokens,
          temperature: 1,
          top_p: 0.95,
          frequency_penalty: 0.75,
          presence_penalty: 0.75,
          stream: false,
          n: 1,
        };
        response = await openai.chat.completions.create(options);
      }

      return response;
    } catch (error) {
      console.error("The spell encountered an error:", error);
      throw error;
    }
  }
};

const fetchOllamaCompletion = async (messages, res) => {
  console.log('Starting fetchOllamaCompletion');
  let fullCompletion = ""; // Initialize the variable to accumulate the full response

  try {
    let response = await fetch(
      "http://localhost:11434/api/chat",
      {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          model: 'mistral',
          messages,
          temperature: 0.75,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: 1000,
          n: 1,
        }),
      }
    );

    if (!response.ok) {
      console.error("Bad response:", await response.text());
      res.status(response.status).send("Error fetching data from Ollama.");
      return;
    }

    for await (const chunk of response.body) {
      const decodedChunk = new TextDecoder('utf-8').decode(chunk);

      try {
        const jsonChunk = JSON.parse(decodedChunk);

        if (!jsonChunk.done) {
          const content = jsonChunk.message.content;
          fullCompletion += content; // Accumulate the content
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          res.flush();
        } else {
          // Optionally, send fullCompletion as a final piece of data
          res.write(`data: ${JSON.stringify({ content: fullCompletion, done: true })}\n\n`);
          res.flush();
          res.end(); // End the stream
          break; // Exit the loop since we're done
        }
      } catch (error) {
        console.error("Error parsing chunk:", error);
        // Handle parsing error, maybe break or continue based on your needs
      }
    }
    
    // Here you can log, store, or otherwise handle the fullCompletion
    return fullCompletion
  } catch (error) {
    console.error("Error during fetch or stream processing:", error);
    res.status(500).send("Server encountered an error.");
  }
};
const moduleCompletionOllama = async (promptData) => {
  const messages = [
    {"role": "system", "content": "You are a proficient blog writer."},
    {"role": "user", "content": promptData.prompt}
  ];

  try {
    const response = await getChatResponseOllama(messages, promptData.max_tokens);
    if (!response.ok) {
      console.error("Ollama returned an error:", await response.text());
      throw new Error('Failed to fetch chat response from Ollama.');
    }
    const responseData = await response.json(); // Convert the response body to JSON
    return responseData.message.content; // Assuming you want to return the JSON data
  } catch (error) {
    console.error("The spell encountered an error:", error);
    throw error; // Rethrow or handle it as needed
  }
};

async function getChatResponseOllama(messages, max_tokens) {
  try {
    const response = await fetch(
      "http://localhost:11434/api/chat",
      {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          model: 'mistral',
          messages,
          temperature: 0.75,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens,
          n: 1,
          stream: false
        }),
      }
    );
    return response; // Return the fetch response to be processed outside
  } catch (error) {
    console.error("The spell encountered an error fetching the chat response:", error);
    throw error; // Or handle it in a more sophisticated manner
  }
}

  module.exports = {fetchOpenAICompletion, generateCompletion, moduleCompletion, fetchOllamaCompletion, moduleCompletionOllama}