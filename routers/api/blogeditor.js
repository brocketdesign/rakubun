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

const BlogStructureSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.object({
      text: z.string(),
      subSections: z.array(z.object({
        subHeading: z.string(),
        subContent: z.string()
      })).optional()
    })
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
  You are a blog assistant. Respond concisely in to the text provided by the user. You must respond in my language. \n
  Your response should be brief and focus solely on informing the user about the next action plan, without including specific blog article details or content.\n 
  If necessary, include one or more of the following triggers (only when needed):\n\n
  
  [full]: Use [full] when the user requests the full article.  \n
  [editor]: Use [editor] when interacting with the blog editor.  \n
  [save]: Use [save] when saving the blog post data.  \n
  [reset]: Use [reset] when resetting the conversation and article data.\n
  
  **All interactions related to editing or modifying the article must use the trigger [editor] in the response. Do not skip or forget this trigger.**\n

  Do not include the article content in your reply.  \n
  Example : \n
  USER : Update the title.\n
  ASSISTANT : [editor] Understood, I will update the title. \n\n
  USER : Update the intro.\n
  ASSISTANT : [editor] Understood, I will update the intro. \n\n
  USER : Reset the data .\n
  ASSISTANT : [reset] Understood, I will reset the data. \n\n
  USER : Save the data .\n
  ASSISTANT : [save] Understood, I will save the data. \n\n
  USER : Show me the full article.\n
  ASSISTANT : [full] Understood, I will display the full article.\n\n
  USER : Show me the article.\n
  ASSISTANT : [full] Understood, I will display the full article in the editor.\n\n

  Always include [editor] if an update is required.
  `;
};

const smallInstruction = `  
  Always include the necessary trigger : \n\n
  [full]: Use [full] when the user requests the full article. \n 
  [editor]: Use [editor] when interacting with the blog editor.  \n
  [save]: Use [save] when saving the blog post data.  \n
  [reset]: Use [reset] when resetting the conversation and article data.
  You are just a guide. Do no respond with the content but only a short answer.You must respond in my language.
  `

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
  { role: 'user', content: userMessage },
  { role: 'user', content: smallInstruction}
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

    const systemPrompt = generateSystemPrompt(blogPost, content);
    const responseMessages = buildResponseMessages(systemPrompt, messages, userMessage);

    messages.push({ role: 'user', content: userMessage });
    req.session.messages = messages;

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

  if (messages.length === 0) return res.status(400).json({ error: 'No conversation found.' });

  // If no structure: produce a JSON structure fitting BlogStructureSchema within [editor].
  // If structure exists: update content based on that structure. Return updated content in Markdown with [editor].
  let systemPrompt;
  if (!blogPost.structure) {
    systemPrompt = `
You are a blog assistant. You must respond in my language.
Produce a JSON structure for the blog using the given schema:

const BlogStructureSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.object({
      text: z.string(),
      subSections: z.array(z.object({
        subHeading: z.string(),
        subContent: z.string()
      })).optional()
    })
  })),
  conclusion: z.string()
});

It is only for structural purpose. You must on write short comment of what the content will be about. 
Do not write the entire article. It is a roadmap.
Return the JSON structure inside [editor]. Do not provide extra commentary. Just the JSON and then done.
    `;
  } else {
    // If structure exists, user wants to update content based on that structure.
    systemPrompt = `
You are a blog assistant. You must respond in my language.\n
A structure is defined as:\n
${JSON.stringify(blogPost.structure)}\n
User may ask for updates or new content for specific sections.
Return the updated section only in Markdown.
Do not produce extra text outside the updated content.
for example :\n
if he user ask for the first section heading, you should respond\n
{
  "title": ""// empty string or false,
  "sections": [
  {heading:"new heading"}
  ],
}\n\n
if he user ask for the third section heading, you should respond\n
{
  "title": ""// empty string or false,
  "sections": [
    null,
    null,
    { "heading": "Updated Section 1" }
  ],
}\n
In this cas you MUST include null for me to now which sections you are refering to. \n\n
for example if he user ask for the title, you should respond\n
{
  "title": "The new title",
}\n
Respond in JSON with only the section to update. You MUST NOT respond with the full structure.
Only the section that is being edited.\n
Do not rewrite the entire content for the field that are not updated. 
\nThe field that are not concerned by the update should be set to null.
    `;
  }

  const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  if (content.trim() !== '') {
    //responseMessages.push({ role: 'user', content: 'Here is the current content : '+content });
  }

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
    structure = JSON.parse(structure);
  }
  if (!structure || typeof structure !== 'object') {
    throw new Error('Invalid structure for HTML conversion.');
  }

  const parseSections = (sections) => {
    return sections
      .map((section) => {
        let sectionHTML = `<h2>${section.heading}</h2><p>${section.content.text}</p>`;

        if (section.content.subSections && Array.isArray(section.content.subSections)) {
          sectionHTML += section.content.subSections
            .map(
              (subSection) =>
                `<h3>${subSection.subHeading}</h3><p>${subSection.subContent}</p>`
            )
            .join('');
        }

        return sectionHTML;
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
      return orig.map((item, i) => (i in upd ? merge(item, upd[i]) : item));

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
