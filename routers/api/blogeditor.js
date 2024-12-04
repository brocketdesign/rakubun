const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function saveBlogPost(post) {
    const db = global.db;
    const collection = db.collection('blogeditor');
    await collection.insertOne(post);
}

router.post('/chat', async (req, res) => {
    let message = req.body.message;
    let messages = req.session.messages || [];

    if (messages.length === 0) {
        const initialAssistantMessage = {
            role: 'assistant',
            content: 'こんにちは！ブログ記事のテーマは何にしますか？'
        };
        messages.push(initialAssistantMessage);
    }

    if (message && message.trim() !== '') {
        messages.push({ role: 'user', content: message });
    }

    req.session.messages = messages;

    try {

        const systemPrompt = `Your are a japanese blog writing assistant. You answer with a short message to the user explaining what you will do next, but not the content itself. Respond in Japanese.`;

        const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

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

        messages.push({ role: 'assistant', content: assistantMessageContent});
        req.session.messages = messages;

    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({ error: 'Error generating response' });
    }
});

router.post('/generateEditorContent', async (req, res) => {
    let messages = req.session.messages || [];

    if (messages.length === 0) {
        return res.status(400).json({ error: 'No conversation history found.' });
    }

    try {
        const ResponseSchema = z.object({
            updateEditor: z.boolean(),
            editorContent: z.string().optional()
        });

        const systemPrompt = `Your are a japanese blog writing assistant. Generate editorContent based on the conversation so far, and indicate whether to update the editor with updateEditor flag. Respond in JSON format with updateEditor and editorContent fields. Respond in Japanese.`;

        const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: responseMessages,
            response_format: zodResponseFormat(ResponseSchema,'chat_structured_answer'),
        });

        const assistantParsedResponse = JSON.parse(completion.choices[0].message.content);

        let responseData = {};

        if (assistantParsedResponse.updateEditor) {
            responseData.updateEditor = assistantParsedResponse.updateEditor;
            responseData.editorContent = assistantParsedResponse.editorContent;
        }

        res.json(responseData);
    } catch (error) {
        console.error('Error generating editor content:', error);
        res.status(500).json({ error: 'Error generating editor content' });
    }
});

router.post('/save', async (req, res) => {
    const content = req.body.content;
    try {
        const structuringPrompt = `次のブログ記事の内容をタイトル、構成、本文のJSON形式に変換してください。\n\n${content}\n\nJSON形式で出力してください。`;

        const schema = z.object({
            title: z.string(),
            structure: z.array(z.object({
                heading: z.string(),
                content: z.string()
            })),
            content: z.string()
        });

        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: structuringPrompt }],
        });

        const structuredDataContent = completion.choices[0].message.content;

        let structuredData;
        try {
            structuredData = schema.parse(JSON.parse(structuredDataContent));
        } catch (parseError) {
            console.error('Error parsing structured data:', parseError);
            return res.status(500).json({ error: 'Error parsing structured data' });
        }

        await saveBlogPost(structuredData);
        res.status(200).json({ message: 'Blog post saved' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving blog post' });
    }
});

module.exports = router;
