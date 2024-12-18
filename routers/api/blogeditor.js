// blogeditor.js
// This file implements a blog writing assistant with three main routes:
// GET /init: Returns current session state (messages and blog content)
// POST /chat: Streams assistant response, along with special triggers [editor], [save], [reset]
// POST /generateEditorContent: Uses conversation and current editor content (not stored in message history) to produce updated blog content

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { ObjectId } = require('mongodb');
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the blog structure schema
const BlogStructureSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string()
  })),
  conclusion: z.string()
});
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
const initializeSession = (req) => {
  if (!req.session.initialized) {
    req.session.initialized = true;
    req.session.messages = [];
    req.session.blogPost = {};
  }
};

const generateSystemPrompt = (blogPost, content) => {
  return `
  You are a Japanese blog assistant. Respond concisely in Japanese to the text provided by the user. 
  Your response should be brief and focus solely on informing the user about the next action plan, without including specific blog article details or content. 
  If necessary, include one or more of the following triggers (only when needed):
  
  [full]: Use [full] when the user requests the full article.  
  [editor]: Use [editor] when interacting with the blog editor.  
  [save]: Use [save] when saving the blog post data.  
  [reset]: Use [reset] when resetting the conversation and article data.
  
  Do not include the article content in your reply.  
  If needed, inform the user that content is being generated in the editor.
  ` + (content.trim() !== '' 
        ? `Current editor content: ${content}
  You MUST not alter the previous editor content unless specifically requested. When making an update, restore the previous content.`
        : '');
  
}
function sanitizeContent(content) {

  if (typeof content === 'string') {
      const startIndex = content.indexOf('{');
      const endIndex = content.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
          try {
              content = JSON.parse(content.slice(startIndex, endIndex + 1));
          } catch (e) {
            console.log({content})
              throw new Error('Invalid JSON content');
          }
      } else {
          console.log({content})
          throw new Error('Content must contain a valid JSON object');
      }
  }
  if (typeof content !== 'object' || content === null) {
      throw new Error('Content must be a JSON object');
  }
  return content;
}

const buildResponseMessages = (systemPrompt, messages, userMessage) => [
  { role: 'system', content: systemPrompt },
  ...messages,
  { role: 'user', content: userMessage }
];

const handleStreamedResponse = async (completion, res, req) => {
  let assistantMessageContent = '';
  let insideBrackets = false;
  let bracketContent = '';

  for await (const part of completion) {
    const content = part.choices[0].delta?.content || '';
    for (const char of content) {
      if (!insideBrackets) {
        if (char === '[') {
          insideBrackets = true;
          bracketContent = '';
        } else {
          assistantMessageContent += char;
          res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
        }
      } else {
        if (char === ']') {
          insideBrackets = false;
          res.write(`data: ${JSON.stringify({ type: 'trigger', command: bracketContent })}\n\n`);

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
    req.session.messages.push({ role: 'assistant', content: assistantMessageContent });
  }
};

router.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message || '';
    initializeSession(req);

    const messages = req.session.messages;
    const blogPost = req.session.blogPost;
    const content = req.session?.blogPost?.content || '';
console.log(blogPost)
    const systemPrompt = generateSystemPrompt(blogPost, content);
    const responseMessages = buildResponseMessages(systemPrompt, messages, userMessage);

    if (userMessage.trim() !== '') {
      messages.push({ role: 'user', content: userMessage });
      req.session.messages = messages;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: responseMessages,
      stream: true,
    });

    await handleStreamedResponse(completion, res, req);
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Error generating response' });
  }
});


// POST /generateEditorContent
// This route interacts with the model to actually produce the structure or update the blog content.
// If no structure: Return a structured JSON answer inside [editor] and then the user can go back to /chat to [save] it.
// If structure exists: Use the structure to produce the requested content, return updates in Markdown with [editor].
router.post('/generateEditorContent', async (req, res) => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let content = req.body.content || '';
  let messages = req.session.messages || [];
  let blogPost = req.session.blogPost || {};
console.log({messages})
  if (messages.length === 0) return res.status(400).json({ error: 'No conversation found.' });

  // If no structure: produce a JSON structure fitting BlogStructureSchema within [editor].
  // If structure exists: update content based on that structure. Return updated content in Markdown with [editor].
  let systemPrompt;
  if (!blogPost.structure) {
    systemPrompt = `
You are a blog assistant.
Produce a JSON structure for the blog using the given schema:
{
  title: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string()
  })).length(3),
  conclusion: z.string()
}
It is only for structural purpose. You must on write short comment of what the content will be about. 
Do not write the entire article. It is a roadmap.
Return the JSON structure inside [editor]. Do not provide extra commentary. Just the JSON and then done.
    `;
  } else {
    // If structure exists, user wants to update content based on that structure.
    systemPrompt = `
You are a blog assistant.
A structure is defined as:
${JSON.stringify(blogPost.structure)}

User may ask for updates or new content for specific sections.
Return the updated section only in Markdown.
Do not produce extra text outside the updated content.
for example if he user ask for the first section heading, you should respond : 
{
  "title": ""// empty string or false,
  "sections": [
  {heading:"new heading"}
  ],
}
for example if he user ask for the title, you should respond : 
{
  "title": "The new title",
}
Respond in JSON with only the section to update. You MUST NOT respond with the full structure.
Only the section that is being edited.
Do not rewrite the entire structure. Omit the field that are not modified.
    `;
  }

  const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  if (content.trim() !== '') {
    //responseMessages.push({ role: 'user', content: 'Here is the current content : '+content });
  }
console.log({editormessage:responseMessages})
  try {
    let completion
      completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: responseMessages,
        max_tokens: 1500,
        temperature: 0.7,
        stream: false,
        response_format: zodResponseFormat(BlogStructureSchema, "blog_structure"),
      });
    
    const updatedContent = completion.choices[0].message.content.trim();

    // If structure was produced here, user will return to /chat to [save] it.
    // If content was updated, reflect in blogPost.content
    if (blogPost.structure) {
      blogPost.content = updatedContent;
      req.session.blogPost = blogPost;
    }

    if(!blogPost.structure){
      console.log(`Save the base structure`)
      blogPost.structure = sanitizeContent(updatedContent);
    }

    res.json({ editorContent: updatedContent });
  } catch (error) {
    console.error('Error generating editor content:', error);
    res.status(500).json({ error: 'Error generating editor content' });
  }
});
const convertToHTML = (structure) => {
  
  if (typeof structure !== 'object') {
    structure = JSON.parse(structure)
  }
  if (!structure || typeof structure !== 'object') {
    throw new Error('Invalid structure for HTML conversion.');
  }

  const parseSections = (sections) => {
    return sections
      .map((section) => {
        return `<h2>${section.heading}</h2><p>${section.content}</p>`;
      })
      .join('');
  };

  let html = '';

  if (structure.title) {
    html += `<h1>${structure.title}</h1>`;
  }

  if (structure.introduction) {
    html += `<p>${structure.introduction}</p>`;
  }

  if (structure.sections && Array.isArray(structure.sections)) {
    html += parseSections(structure.sections);
  }

  if (structure.conclusion) {
    html += `<p>${structure.conclusion}</p>`;
  }

  return html.trim();
};

router.get('/fullarticle', (req, res) => {
  try {
    const blogPost = req.session.blogPost;

    if (!blogPost || !blogPost.structure) {
      return res.status(400).json({ error: 'No blog post structure available to convert.' });
    }

    const htmlContent = convertToHTML(blogPost.structure);
    console.log({htmlContent})

    res.status(200).send(htmlContent);
  } catch (error) {
    console.error('Error generating full article:', error);
    res.status(500).json({ error: 'Error generating full article.' });
  }
});

const updateBlogStructure = (structure, updates) => {
  if (typeof structure !== 'object') structure = JSON.parse(structure);

  const merge = (orig, upd) => {
    if (typeof upd !== 'object' || upd === null)
      return (upd !== '' && upd !== false && upd !== undefined) ? upd : orig;

    if (Array.isArray(orig) && Array.isArray(upd))
      return orig.map((item, i) => merge(item, upd[i]));

    if (typeof orig === 'object') {
      const result = { ...orig };
      Object.keys(upd).forEach(key => {
        result[key] = merge(orig[key], upd[key]);
      });
      return result;
    }

    return orig;
  };

  return merge(structure, updates);
};


router.post('/updateStructure', (req, res) => {
  try {
    const blogPost = req.session.blogPost;

    if (!blogPost || !blogPost.structure) {
      return res.status(400).json({ error: 'No blog post structure available to update.' });
    }

    const updates = req.body.updates; 

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid updates provided.' });
    }

    const updatedStructure = updateBlogStructure(blogPost.structure, updates);
    req.session.blogPost.structure = updatedStructure;

    res.status(200).json({ message: 'Blog post structure updated successfully.', structure: updatedStructure });
  } catch (error) {
    console.error('Error updating blog structure:', error);
    res.status(500).json({ error: 'Error updating blog structure.' });
  }
});

module.exports = router;
