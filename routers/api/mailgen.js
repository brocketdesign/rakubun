// mailgen.js

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/generate', async (req, res) => {
  const emailContent = req.body.emailContent;
  const replyContent = req.body.replyContent;

  try {
    const prompt = `
メールの文章:
${emailContent}

返信内容:
${replyContent}

上記の内容を元に、丁寧で適切なビジネスメールを作成してください。敬語やビジネスマナーに注意してください。日本語で返信してください。回答はMarkdown形式で出力してください。
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders(); // Establish SSE with client

    for await (const part of completion) {
      const content = part.choices[0].delta?.content || '';
      // Send each chunk of data to the client
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }

    // Signal completion
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating email' });
  }
});

module.exports = router;
