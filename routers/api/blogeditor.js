// blogeditor.js
// Routes:
// POST /chat: user sends a message, server streams AI assistant response
// POST /generateEditorContent: generate updated editor content, and possibly save/reset
// Internal: saveBlogPost function

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { ObjectId } = require('mongodb');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function saveBlogPost(post, session) {
  const db = global.db;
  const collection = db.collection('blogeditor');
  if (post._id) {
    const postId = new ObjectId(post._id);
    const postToUpdate = { ...post };
    delete postToUpdate._id;
    await collection.updateOne({ _id: postId }, { $set: postToUpdate });
  } else {
    const result = await collection.insertOne(post);
    post._id = result.insertedId.toString();
    session.blogPost._id = post._id;
  }
}

// GET /init
// Returns current session messages and editor content if available
router.get('/init', (req, res) => {
  const messages = req.session.messages || [];
  const blogPost = req.session.blogPost || {};
  const content = blogPost.content || '';
  res.json({ messages, content });
});

// POST /chat
// Streams assistant response for user's message
router.post('/chat', async (req, res) => {
  let message = req.body.message;
  let messages = req.session.messages || [];
  if (!req.session.initialized) {
    req.session.initialized = true;
    messages = [];
    req.session.messages = messages;
    req.session.blogPost = {};
  }

  if (message && message.trim() !== '') {
    messages.push({ role: 'user', content: message });
  }

  const systemPrompt = "You are a Japanese blog writing assistant. Respond concisely in Japanese.";

  let responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: responseMessages,
      stream: true,
    });

    let assistantMessageContent = '';

    for await (const part of completion) {
      const content = part.choices[0].delta?.content || '';
      assistantMessageContent += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

    messages.push({ role: 'assistant', content: assistantMessageContent });
    req.session.messages = messages;

  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
});

// POST /generateEditorContent
// Uses conversation to update editor content, and possibly save/reset
router.post('/generateEditorContent', async (req, res) => {
  let content = req.body.content;
  let messages = req.session.messages || [];

  if (messages.length === 0) {
    return res.status(400).json({ error: 'No conversation history found.' });
  }

  const ResponseSchema = z.object({
    updateEditor: z.boolean(),
    editorContent: z.string().optional(),
    save: z.boolean().optional(),
    reset: z.boolean().optional()
  });

  const systemPrompt = "You are a Japanese blog assistant. Based on conversation and current content, update the blog editor content, possibly save or reset. Return JSON with updateEditor, editorContent, save, reset.";

  if (content && content.trim()) {
    messages.push({ role: 'user', content: `Current editor content: ${content}` });
  }

  const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: responseMessages,
      response_format: zodResponseFormat(ResponseSchema, 'chat_structured_answer'),
    });

    const assistantParsedResponse = JSON.parse(completion.choices[0].message.content);
    let responseData = {};

    if (assistantParsedResponse.updateEditor && assistantParsedResponse.editorContent) {
      responseData.updateEditor = true;
      responseData.editorContent = assistantParsedResponse.editorContent;
      messages.push({ role: 'assistant', content: assistantParsedResponse.editorContent });
    }

    if (assistantParsedResponse.save) {
      let blogPost = req.session.blogPost || {};
      blogPost.content = content;
      blogPost.conversation = messages;
      await saveBlogPost(blogPost, req.session);
      messages.push({ role: 'assistant', content: 'I saved the article data' });
    }

    if (assistantParsedResponse.reset) {
      req.session.messages = [];
      req.session.blogPost = {};
      req.session.initialized = false;
      messages = req.session.messages;
      messages.push({ role: 'assistant', content: 'I reset the article data' });
    }

    req.session.messages = messages;
    res.json(responseData);

  } catch (error) {
    console.error('Error generating editor content:', error);
    res.status(500).json({ error: 'Error generating editor content' });
  }
});

module.exports = router;
