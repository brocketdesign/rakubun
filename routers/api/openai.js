const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const multer  = require('multer');
const upload = multer();
const { 
  formatDateToDDMMYYHHMMSS, 
  saveData ,
  askGPT ,
  fetchMediaUrls, 
  findDataInMedias,
  sanitizeData,
  updateSameElements,
  getOpenaiTypeForUser,
  fetchOpenAICompletion,
  initCategories,
  saveDataSummarize
} = require('../../services/tools')
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


router.post('/custom/:type', upload.fields([{ name: 'pdf1' }, { name: 'pdf2' }]), async (req, res) => {
  let { prompt, time, data } = req.body;

  const type = req.params.type;

  let isPDF = false
  let input1 = ''
  try{
    if(req.files && req.files.pdf1 ){
      isPDF = true
      input1 = await pdfToChunks(req.files.pdf1[0].path)
      if(isPDF){
        input1 = input1[0]
      }
      data = {pdf_content :input1}
      data.language= req.body.language
  
      //prompt = `
      // What is this content about ? 
      // Summarize this content in ${data.language} in a few lines : ${input1}
      //`
    }

  }catch(e){
      console.log('No PDF provided')
      console.log(e)
  }
  
  console.log(`Save ${type} data`)

  try {
    const result = await global.db.collection('openai').insertOne({ 
      userID:req.user?req.user._id : '', 
      data:data,
      prompt: prompt, 
      prompt_time:time,
      type 
    });

    const insertedId = result.insertedId;
    if(req.user){
      global.db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        { $push: {[`openai_${type}`]: insertedId } }
      );
    }

    res.json({
      redirect: `/api/openai/stream/${type}?id=${insertedId}`,
      insertedId: insertedId
    });

  } catch (error) {
  console.log(error);
  res.status(500).send('Internal server error');
  }
});

router.get('/stream/:type', async (req, res) => {
  const type = req.params.type;
  const id = req.query.id;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  res.flushHeaders(); // Flush the headers to establish the SSE connection

  try {
      // Fetch the prompt from the database using the provided id
      const record = await global.db.collection('openai').findOne({ _id: new ObjectId(id) });

      if (!record) {
          res.write('data: {"error": "Record not found"}\n\n');
          res.end();
          return;
      }

      const prompt = record.prompt;
      const messages = [
          { role: 'system', content: 'You are a powerful assistant' },
          { role: 'user', content: prompt },
      ];

      const fullCompletion = await fetchOpenAICompletion(messages, res);

      // Update the database with the full completion
      await global.db.collection('openai').updateOne(
          { _id: new ObjectId(id) },
          { $push: { completion: fullCompletion,completion_time:new Date() } }
      );

      // 文字列内のダブルクォートと改行をエスケープ
      const completionEscaped = fullCompletion.replace(/"/g, '\\"').replace(/\n/g, '\\n');

      res.write('event: end\n');
      res.write(`data: {"id": "${id}","completion":"${completionEscaped}"}\n\n'`);
      res.flush(); // Flush the response to send the data immediately
      res.end();
  } catch (error) {
      console.log(error);
      res.write('data: {"error": "Internal server error"}\n\n');
      res.end();
  }
});

router.post('/pdf/compare', upload.fields([{ name: 'pdf1' }, { name: 'pdf2' }]), async (req, res) => {

  let { input1, input2, time } = req.body;
  let isPDF = false
  try{

    if(req.files.pdf1 && req.files.pdf2){
      isPDF = true
      input1 = await pdfToChunks(req.files.pdf1[0].path)
      input2 = await pdfToChunks(req.files.pdf2[0].path)
    }
  }catch(e){
      console.log('No PDF provided')
    }

  if(!input1 || !input2){
    res.status(500).send('Error with the input');
    return
  }
  if(isPDF){
    input1 = input1[0]
    input2 = input2[0]
  }
  res.json({ success: true, completion:JSON.parse('[{"input2":"","input2":"","difference":""}]')});
  return 
  console.log(`Generate response for:  ${input1} and ${input2}`)

  const messages = [
    { role: 'system', content: 'You are a powerful assistant' },
    { role: 'user', content: `Compare this "${input1}" to "${input2}". 
    Generate a summary of each PDF and compare the summaries. you should answer in the document language.
    [{"input2":"","input2":"","difference":""}].
    return only the JSON array.` },
  ];

  try {
    const generatedJson = await generateJson(messages,openai);
    console.log(generatedJson)

    const dataUpdate = { input1, input2, completion:generatedJson, response_time: new Date(),message_time:time };
    const result = await global.db.collection('users').updateOne(
      { _id: req.user._id },
      { $push: { openai_compare: dataUpdate } }
    );

    res.json({ success: true, completion:generatedJson});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

router.get('/ask-gpt', async (req, res) => {
  try {
      const prompt = req.query.prompt;
      const response = await askGPT(prompt);
      res.json({ answer: response });
  } catch (error) {
      res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;