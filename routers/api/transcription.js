const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const OpenAI = require('openai');
const ObjectId = require('mongodb').ObjectId;
const { pipeline } = require('stream/promises');
const fs = require('fs');
const tmp = require('tmp');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    key: (req, file, cb) => {
      const userId = req.user._id.toString();
      cb(null, `${userId}/${Date.now()}-${file.originalname}`);
    },
  }),
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/upload', upload.single('audio'), async (req, res) => {
  const file = req.file;
  const result = await db.collection('files').insertOne({
    userId: new ObjectId(req.user._id),
    filename: file.key,
    originalname: file.originalname,
    bucket: file.bucket,
  });
  res.json({ message: 'File uploaded', file: { _id: result.insertedId, originalname: file.originalname } });
});

router.post('/transcribe/:id', async (req, res) => {
  console.log('POST /transcribe/:id called with id:', req.params.id);

  const fileId = req.params.id;
  try {
    const fileRecord = await db.collection('files').findOne({ _id: new ObjectId(fileId) });
    if (!fileRecord) {
      console.error('File not found for id:', fileId);
      return res.status(404).json({ error: 'File not found' });
    }

    console.log('File record found:', fileRecord);
    res.json({ message: 'Transcription started' });

    process.nextTick(async () => {
      try {
        console.log('Starting transcription process for file:', fileRecord.filename);
    
        const params = {
          Bucket: fileRecord.bucket,
          Key: fileRecord.filename,
        };
        console.log('S3 params:', params);
    
        const command = new GetObjectCommand(params);
        const data = await s3.send(command);
        console.log('S3 response received');
    
        const audioStream = data.Body;
        const chunks = [];
    
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
    
        const audioBuffer = Buffer.concat(chunks);
        console.log('Audio buffer created');
    
        // Write the buffer to a temporary file
        const tempFilePath = tmp.tmpNameSync({ postfix: '.m4a' });
        fs.writeFileSync(tempFilePath, audioBuffer);
        console.log('Temporary file written at:', tempFilePath);
    
        // Create a read stream from the temporary file
        const audioReadStream = fs.createReadStream(tempFilePath);
    
        const response = await client.audio.transcriptions.create({
          file: audioReadStream,
          model: 'whisper-1',
        });
        console.log('Transcription response received');
    
        const transcription = response.text;
        console.log('Transcription text:', transcription);
    
        await db.collection('files').updateOne(
          { _id: new ObjectId(fileId) },
          { $set: { transcription } }
        );
        console.log('Database updated with transcription');
    
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.error('Transcription process error:', error);
      }
    });
    
    
  } catch (error) {
    console.error('Error during initial file lookup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/status/:id', async (req, res) => {
  const fileId = req.params.id;
  const fileRecord = await db.collection('files').findOne({ _id: new ObjectId(fileId) });
  if (!fileRecord) return res.status(404).json({ error: 'File not found' });
  res.json({ transcription: fileRecord.transcription || null });
});

router.get('/get/:id', async (req, res) => {
  const fileId = req.params.id;
  const fileRecord = await db.collection('files').findOne({ _id: new ObjectId(fileId) });
  if (!fileRecord) return res.status(404).json({ error: 'File not found' });
  res.json({ transcription: fileRecord.transcription || null });
});

router.post('/save/:id', async (req, res) => {
  const fileId = req.params.id;
  const transcription = req.body.transcription;
  await db.collection('files').updateOne(
    { _id: new ObjectId(fileId) },
    { $set: { transcription } }
  );
  res.json({ message: 'Transcription saved' });
});

router.post('/rename/:id', async (req, res) => {
  const fileId = req.params.id;
  const newName = req.body.newName;
  await db.collection('files').updateOne(
    { _id: new ObjectId(fileId) },
    { $set: { originalname: newName } }
  );
  res.json({ message: 'File renamed' });
});

router.post('/delete/:id', async (req, res) => {
  const fileId = req.params.id;
  const fileRecord = await db.collection('files').findOne({ _id: new ObjectId(fileId) });
  if (fileRecord) {
    await s3.send(new DeleteObjectCommand({
      Bucket: fileRecord.bucket,
      Key: fileRecord.filename,
    }));
    await db.collection('files').deleteOne({ _id: new ObjectId(fileId) });
  }
  res.json({ message: 'File deleted' });
});

module.exports = router;
