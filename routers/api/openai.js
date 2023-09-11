const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const multer  = require('multer');
const upload = multer();
const { askGPT } = require('../../services/tools')
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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