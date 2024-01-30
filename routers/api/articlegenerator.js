// Section generator
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const {fetchOpenAICompletion}=require('../../modules/openai')

// Function to generate the prompt text based on the received data
function generatePrompt(data) {
    const { SECTION, TITLE, WRITING_STYLE, LANGUAGE, WRITING_TONE } = data;
    return `Write a paragraph about "${SECTION}" for an acrticle "${TITLE}" in ${LANGUAGE}. Use Markdown for formatting. Style: ${WRITING_STYLE}. Tone: ${WRITING_TONE}.`
  }

router.post('/generate/:type', async (req, res) => {
  let { SECTION, TITLE, WRITING_STYLE, LANGUAGE, WRITING_TONE } = req.body;
  const prompt = generatePrompt(req.body)
  const type = req.params.type;

  try {
    const result = await global.db.collection('openai').insertOne({ 
      userID:req.user._id, 
      request:req.body,
      prompt, 
      prompt_time:new Date(),
      type 
    });

    const insertedId = result.insertedId;
    
    global.db.collection('users').updateOne(
      { _id: new ObjectId(req.user._id) },
      { $push: {[`openai_${type}`]: insertedId } }
    );

    res.json({
      redirect: `/api/articlegenerator/stream/${type}?id=${insertedId}`,
      insertedId: insertedId
    });

  } catch (error) {
  console.log(error);
  res.status(500).send('Internal server error');
  }
});

router.get('/stream/:type', async (req, res) => {
  const type = req.params.type;
  const stream_id = req.query.id;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.flushHeaders(); // Flush the headers to establish the SSE connection

  try {
      // Fetch the prompt from the database using the provided id
      const record = await global.db.collection('openai').findOne({ _id: new ObjectId(stream_id) });

      if (!record) {
          res.write('data: {"error": "Record not found"}\n\n');
          res.end();
          return;
      }

      const prompt = record.prompt;
      const messages = [
          { role: 'system', content: 'You are a proficient blog writer.' },
          { role: 'user', content: prompt },
      ];
      
      const fullCompletion = await fetchOpenAICompletion(messages,1000, res);

      // 文字列内のダブルクォートと改行をエスケープ
      const completionEscaped = fullCompletion.replace(/"/g, '\\"').replace(/\n/g, '\\n');

      // Update the database with the full completion
      await global.db.collection('openai').updateOne(
          { _id: new ObjectId(stream_id) },
          { $push: { completion: completionEscaped,completion_time:new Date() } }
      );

            
      const data = JSON.stringify({
        id: stream_id,
        completion: completionEscaped
      });
    
      // Write the SSE message
      res.write('event: end\n');
      res.write(`data: ${data}\n\n`);
      res.flush(); // Flush the response to send the data immediately
      res.end();
  } catch (error) {
      console.log(error);
      res.write('data: {"error": "Internal server error"}\n\n');
      res.end();
  }
});
module.exports = router