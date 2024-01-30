const fetch = require('node-fetch');
const { createParser } = require('eventsource-parser');

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
                    model: "gpt-3.5-turbo-16k",
                    messages,
                    max_tokens: 100,
                    temperature: 0.75,
                    top_p: 0.95,
                    frequency_penalty: 0.5, // Adjust if you want to penalize frequent tokens
                    presence_penalty: 0.5, // Adjust if you want to penalize new tokens
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
  module.exports = {fetchOpenAICompletion}