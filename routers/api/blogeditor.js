// blogeditor.js
// This file implements a blog writing assistant with three main routes:
// GET /init: Returns current session state (messages and blog content)
// POST /chat: Streams assistant response, along with special triggers [editor], [save], [reset]
// POST /generateEditorContent: Uses conversation and current editor content (not stored in message history) to produce updated blog content

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { ObjectId } = require('mongodb');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Saves the blog post to MongoDB.
 */
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

/**
 * GET /init
 * Returns current session messages and editor content if available.
 */
router.get('/init', (req, res) => {
  const messages = req.session.messages || [];
  const blogPost = req.session.blogPost || {};
  const content = blogPost.content || '';
  res.json({ messages, content });
});

/**
 * POST /chat
 * Streams assistant response for the user's message. The assistant can produce triggers:
 * [editor], [save], [reset].
 * These triggers are sent as 'trigger' SSE events. The text content is sent as 'text' SSE events.
 * On [save], server saves the current data.
 * On [reset], server resets the session.
 * The [editor] trigger indicates that the front end should call /generateEditorContent next.
 */
router.post('/chat', async (req, res) => {
  let message = req.body.message;
  let messages = req.session.messages || [];
  let content = req.session?.blogPost?.content || '';

  if (!req.session.initialized) {
    req.session.initialized = true;
    messages = [];
    req.session.messages = messages;
    req.session.blogPost = {};
  }

  if (message && message.trim() !== '') {
    const newMessage = { role: 'user', content: message }
    messages.push(newMessage);
    req.session.messages = messages;
    console.log('add new message')
  }
// System prompt instructs the assistant to produce concise Japanese answers and possibly triggers.
const systemPrompt = `
あなたは日本語のブログアシスタントです。ユーザーが提供するテキストに対して簡潔な日本語の応答をしてください。
返答は短く、行動計画をユーザーに知らせる目的のみで行い、具体的なブログ記事の内容や詳細は含めないでください。
必要に応じて以下のトリガーを1つ以上加えることがあります（ない場合は加えないでください）：
[editor] : ブログエディタの内容を更新する時に入れてください。
[save] : ブログポストのデータを保存する時に入れてください。
[reset] : 会話と記事データをリセットする時に入れてください。

Do not provide the content in your answer. If needed tell me that the content is being generated in the editor.
`+ 
(content.trim() !== '' 
  ? `現在のエディタコンテンツ:${content}
You MUST not alter the previous editor content unless asked for. When you make an update, restore the previous content.` 
  : '');


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
    let insideBrackets = false;
    let bracketContent = '';

    for await (const part of completion) {
      const content = part.choices[0].delta?.content || '';
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (!insideBrackets) {
          // We're reading normal text
          if (char === '[') {
            insideBrackets = true;
            bracketContent = '';
          } else {
            // Normal visible text
            assistantMessageContent += char;
            res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
          }
        } else {
          // We're inside brackets, reading trigger commands
          if (char === ']') {
            insideBrackets = false;
            // bracketContent contains a trigger like 'editor', 'save', or 'reset'
            res.write(`data: ${JSON.stringify({ type: 'trigger', command: bracketContent })}\n\n`);
            
            // Handle triggers on the server side if needed
            if (bracketContent === 'save') {
              let blogPost = req.session.blogPost || {};
              blogPost.content = req.session.blogPost.content || '';
              blogPost.conversation = req.session.messages;
              await saveBlogPost(blogPost, req.session);
            } else if (bracketContent === 'reset') {
              req.session.messages = [];
              req.session.blogPost = {};
              req.session.initialized = false;
            }

          } else {
            bracketContent += char;
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    if (assistantMessageContent.trim() !== '') {
      // Only add the visible assistant message to conversation
      req.session.messages.push({ role: 'assistant', content: assistantMessageContent });
    }

  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
});

/**
 * POST /generateEditorContent
 * Uses the current conversation (without the editor content being stored in the conversation) 
 * and the provided `content` field to generate updated editor content.
 * The editor content is not pushed into the message history.
 */
router.post('/generateEditorContent', async (req, res) => {
  let content = req.body.content || '';
  let messages = req.session.messages || [];

  if (messages.length === 0) {
    return res.status(400).json({ error: 'No conversation history found.' });
  }

  // We do not include the editor content in the chat message history.
  // Instead, we provide it directly in the system prompt.
  const systemPrompt = `
  あなたは日本語のブログアシスタントです。以下は現在の会話とエディタの内容です。
  これらを考慮して、ブログエディターに表示する最新のコンテンツ(Markdown)を提案してください。
  返答は頼まれたコンテンツのみ返してください。余計なことしないで。` + 
  (content.trim() !== '' 
    ? `現在のエディタコンテンツ:${content}
  You MUST not alter the previous editor content unless asked for. When you make an update, restore the previous content.` 
    : '');
  

  const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: responseMessages,
      max_tokens: 1500,
      temperature: 0.7,
      stream: false,
    });

    const updatedContent = completion.choices[0].message.content.trim();
    // Update the session blogPost content
    let blogPost = req.session.blogPost || {};
    blogPost.content = updatedContent;
    req.session.blogPost = blogPost;

    res.json({ editorContent: updatedContent });
  } catch (error) {
    console.error('Error generating editor content:', error);
    res.status(500).json({ error: 'Error generating editor content' });
  }
});

module.exports = router;
