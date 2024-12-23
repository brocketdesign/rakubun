const express = require('express');
const router = express.Router();
const multer = require('multer');
const AWS = require('aws-sdk');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const upload = multer({ storage: multer.memoryStorage() });

const File = require('../../models/File');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = 'あなたはPDF文書の内容に詳しいアシスタントです。回答はMarkdown形式で出力してください。ユーザーの質問に対して、PDFの内容を元に適切な回答を日本語で提供してください。';

router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error('ファイルがアップロードされていません');

    const key = `${uuidv4()}${path.extname(file.originalname)}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const data = await s3.upload(params).promise();

    const pdfText = await extractTextFromPDF(file.buffer);
    if (!pdfText) throw new Error('PDFのテキスト抽出に失敗しました');

    const newFile = new File({
      userId: req.user._id,
      originalname: file.originalname,
      filename: key,
      mimetype: file.mimetype,
      size: file.size,
      s3Url: data.Location,
      textContent: pdfText,
    });

    await newFile.save();

    res.json({ file: newFile });
  } catch (error) {
    console.log('Upload Error:', error);
    res.status(500).json({ error: 'ファイルのアップロード中にエラーが発生しました' });
  }
});

router.get('/history/:id', async (req, res) => {
  const id = req.params.id;
  const file = await File.findOne({ _id: id, userId: req.user._id });
  if (!file) return res.status(404).json({ error: 'ファイルが見つかりません' });

  if (!file.chatHistory || file.chatHistory.length === 0) {
    const prompt = `以下のPDF文書を要約してください:\n\n${file.textContent}`;
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const summary = response.choices[0].message.content.trim();

    file.summary = summary;
    file.chatHistory = [{ role: 'assistant', content: summary }];
    await file.save();
  }

  res.json({ chatHistory: file.chatHistory });
});

router.post('/chat/:id', async (req, res) => {
  const id = req.params.id;
  const userMessage = req.body.message;
  const file = await File.findOne({ _id: id, userId: req.user._id });
  if (!file) return res.status(404).send('ファイルが見つかりません');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...file.chatHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    // Save the user's message to chatHistory
    file.chatHistory.push({ role: 'user', content: userMessage });
    await file.save();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();

    let assistantResponse = '';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      stream: true,
    });

    for await (const part of completion) {
      const content = part.choices[0].delta?.content || '';
      assistantResponse += content;
      res.write(content);
    }

    // Save the assistant's response to chatHistory
    file.chatHistory.push({ role: 'assistant', content: assistantResponse });
    await file.save();

    res.end();

  } catch (error) {
    console.error('Error during streaming:', error);
    res.status(500).send('エラーが発生しました');
  }
});

router.get('/get/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const file = await File.findOne({ _id: id, userId: req.user._id });
    if (!file) return res.status(404).json({ error: 'ファイルが見つかりません' });

    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.filename, // Use the S3 object key (filename)
      Expires: 60 * 5, // Signed URL valid for 5 minutes
    });

    res.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'サイン付きURLの生成中にエラーが発生しました' });
  }
});


const extractTextFromPDF = async (pdfBuffer) => {
  const data = await pdfParse(pdfBuffer);
  return data.text;
};

module.exports = router;
