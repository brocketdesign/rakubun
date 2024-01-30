// Section generator
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const {fetchOpenAICompletion}=require('../../modules/openai')

// Function to generate the prompt text based on the received data
function generatePrompt(data) {
    const { SECTIONS_COUNT,TITLE, WRITING_STYLE, LANGUAGE, WRITING_TONE } = data;
    return `I’m writing a blog post with the title [${TITLE}]. Write ${SECTIONS_COUNT} headings for a  blog post outline in ${LANGUAGE}. Style: ${WRITING_STYLE}. Tone: ${WRITING_TONE}. Each heading is between 40 and 60 characters. Use Markdown for the headings (## ).`;
  }

  function parseOpenAIResponse(responseText) {
    // Remove all newline characters and then process
    const cleanedResponse = responseText.replace(/\n/g, '');
    return cleanedResponse.trim().split('##').filter(title => title.trim().length);
}

router.post('/generate/:type', async (req, res) => {
  let { SECTIONS_COUNT,TITLE, WRITING_STYLE, LANGUAGE, WRITING_TONE } = req.body;
  const prompt = generatePrompt(req.body)
  const type = req.params.type;

  try {
    const result = await global.db.collection('openai').insertOne({
      userID: req.user._id,
      request:req.body,
      prompt,
      prompt_time: new Date(),
      type
  });

    const insertedId = result.insertedId;
    
    global.db.collection('users').updateOne(
      { _id: new ObjectId(req.user._id) },
      { $push: {[`openai_${type}`]: insertedId } }
    );

    res.json({
      redirect: `/api/sectiongenerator/stream/${type}?id=${insertedId}`,
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
          { role: 'system', content: 'You are a proficient content planner.' },
          { role: 'user', content: prompt },
      ];

      const fullCompletion = await fetchOpenAICompletion(messages,300, res);

      // 文字列内のダブルクォートと改行をエスケープ
      const completionEscaped = parseOpenAIResponse(fullCompletion); //fullCompletion.replace(/"/g, '\\"').replace(/\n/g, '\\n');

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

router.get('/sectiondata', async (req, res) => {
  const sectionId = req.query.sectionId;
  try{
    const data = await global.db.collection('openai').findOne({ _id: new ObjectId(sectionId) });
    res.status(200).json(data)
  }catch{
    console.log(`${sectionId} not founded`)
  }
});
module.exports = router