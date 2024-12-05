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
    let currentStep = req.session.currentStep || 'title';

    if (!req.session.initialized) {
        req.session.initialized = true;
        req.session.currentStep = 'title';
        currentStep = 'title';
        messages = [];
        req.session.messages = messages;
    }

    let systemPrompt = `You are a japanese blog writing assistant. You answer with a short message to the user explaining what you will do next, but not the content itself. We are currently working on ${currentStep}. Respond in Japanese.`;

    // Include previously saved data
    let blogPost = req.session.blogPost || {};
    let title = blogPost.title || '';
    let structure = blogPost.structure || [];
    let introduction = blogPost.introduction || '';
    let conclusion = blogPost.conclusion || '';

    // Add a new user message that contains the data of each previous step
    let contextMessage = '';

    switch (currentStep) {
        case 'structure':
            if (title) {
                contextMessage = `これまでのデータ:\nタイトル: ${title}`;
            }
            break;
        case 'introduction':
            if (title && structure.length > 0) {
                contextMessage = `これまでのデータ:\nタイトル: ${title}\n構成: ${JSON.stringify(structure)}`;
            }
            break;
        case 'conclusion':
            if (title && structure.length > 0 && introduction) {
                contextMessage = `これまでのデータ:\nタイトル: ${title}\n構成: ${JSON.stringify(structure)}\n導入部分: ${introduction}`;
            }
            break;
        default:
            break;
    }

    if (contextMessage) {
        messages.push({ role: 'user', content: contextMessage });
    }

    if (message && message.trim() !== '') {
        messages.push({ role: 'user', content: message });
    }

console.log({messages})
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

router.post('/generateEditorContent', async (req, res) => {
    let content = req.body.content;
    let messages = req.session.messages || [];
    let currentStep = req.session.currentStep || 'title';
    let title = req.session.blogPost?.title || '';
    let structure = req.session.blogPost?.structure || [];

    if (messages.length === 0) {
        return res.status(400).json({ error: 'No conversation history found.' });
    }

    try {
        const ResponseSchema = z.object({
            updateEditor: z.boolean(),
            editorContent: z.string().optional()
        });

        let systemPrompt = '';

        switch (currentStep) {
            case 'title':
                systemPrompt = `あなたは日本語のブログ記事作成アシスタントです。これまでの会話に基づいてブログのタイトルを最終決定するのを手伝ってください。JSON形式でupdateEditorとeditorContentのフィールドを含めて回答してください。`;
                break;
            case 'structure':
                systemPrompt = `あなたは日本語のブログ記事作成アシスタントです。タイトル「${title}」に基づいて記事の構成を作成するのを手伝ってください。JSON形式でupdateEditorとeditorContentのフィールドを含めて回答してください。`;
                break;
            case 'introduction':
                systemPrompt = `あなたは日本語のブログ記事作成アシスタントです。タイトル「${title}」と構成${JSON.stringify(structure)}に基づいて記事の導入部分を書くのを手伝ってください。JSON形式でupdateEditorとeditorContentのフィールドを含めて回答してください。`;
                break;
            case 'conclusion':
                systemPrompt = `あなたは日本語のブログ記事作成アシスタントです。タイトル「${title}」と構成${JSON.stringify(structure)}に基づいて記事の結論部分を書くのを手伝ってください。JSON形式でupdateEditorとeditorContentのフィールドを含めて回答してください。`;
                break;
            default:
                break;
        }

        if (content && content.trim()) {
            messages.push({ role: 'user', content: `最新のエディターコンテンツ: ${content}` });
        }

        const responseMessages = [{ role: 'system', content: systemPrompt }, ...messages];

        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: responseMessages,
            response_format: zodResponseFormat(ResponseSchema, 'chat_structured_answer'),
        });

        const assistantParsedResponse = JSON.parse(completion.choices[0].message.content);

        let responseData = {};

        if (assistantParsedResponse.updateEditor) {
            responseData.updateEditor = assistantParsedResponse.updateEditor;
            responseData.editorContent = assistantParsedResponse.editorContent;

            messages.push({ role: 'assistant', content: assistantParsedResponse.editorContent });
            req.session.messages = messages;
        }

        res.json(responseData);
    } catch (error) {
        console.error('Error generating editor content:', error);
        res.status(500).json({ error: 'Error generating editor content' });
    }
});

router.post('/save', async (req, res) => {
    const content = req.body.content;
    let currentStep = req.session.currentStep || 'title';
    let blogPost = req.session.blogPost || {};

    try {
        let structuringPrompt = '';
        let schema;

        switch (currentStep) {
            case 'title':
                structuringPrompt = `次のテキストからブログ記事のタイトルを抽出してください。\n\n${content}\n\nJSON形式で"title"フィールドのみを含めて出力してください。`;
                schema = z.object({
                    title: z.string()
                });
                break;
            case 'structure':
                structuringPrompt = `次のテキストからブログ記事の構成を抽出してください。\n\n${content}\n\nJSON形式で"structure"フィールドのみを含めて出力してください。構成は見出しと説明の配列です。`;
                schema = z.object({
                    structure: z.array(z.object({
                        heading: z.string(),
                        description: z.string()
                    }))
                });
                break;
            case 'introduction':
                structuringPrompt = `次のテキストからブログ記事の導入部分を抽出してください。\n\n${content}\n\nJSON形式で"introduction"フィールドのみを含めて出力してください。`;
                schema = z.object({
                    introduction: z.string()
                });
                break;
            case 'conclusion':
                structuringPrompt = `次のテキストからブログ記事の結論部分を抽出してください。\n\n${content}\n\nJSON形式で"conclusion"フィールドのみを含めて出力してください。`;
                schema = z.object({
                    conclusion: z.string()
                });
                break;
            default:
                break;
        }

        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: structuringPrompt }],
            response_format: zodResponseFormat(schema, 'content_structured'),
        });

        const structuredDataContent = completion.choices[0].message.content;

        let structuredData;
        try {
            structuredData = JSON.parse(structuredDataContent);
        } catch (parseError) {
            console.error('Error parsing structured data:', parseError);
            return res.status(500).json({ error: 'Error parsing structured data' });
        }

        blogPost = { ...blogPost, ...structuredData };
        req.session.blogPost = blogPost;

        if (currentStep === 'conclusion') {
            await saveBlogPost(blogPost);
        }

        switch (currentStep) {
            case 'title':
                req.session.currentStep = 'structure';
                break;
            case 'structure':
                req.session.currentStep = 'introduction';
                break;
            case 'introduction':
                req.session.currentStep = 'conclusion';
                break;
            case 'conclusion':
                req.session.currentStep = 'completed';
                break;
            default:
                break;
        }

        req.session.messages = [];

        res.status(200).json({ message: 'Data saved', nextStep: req.session.currentStep });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving data' });
    }
});

router.get('/currentStep', (req, res) => {
    try {
        // Check if the session is initialized, otherwise set the default step
        if (!req.session.currentStep) {
            req.session.currentStep = 'title';
        }

        res.status(200).json({
            currentStep: req.session.currentStep,
        });
    } catch (error) {
        console.error('Error fetching current step:', error);
        res.status(500).json({ error: 'Error fetching current step' });
    }
});

router.post('/reset', (req, res) => {
    try {
        req.session.messages = [];
        req.session.currentStep = 'title';
        req.session.blogPost = {};
        req.session.initialized = false;

        res.status(200).json({ message: 'ブログ投稿が正常にリセットされました。新しいブログ投稿を開始する準備ができました。' });
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({ error: 'Error resetting data' });
    }
});

module.exports = router;
