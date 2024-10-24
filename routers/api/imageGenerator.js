const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const OpenAI = require('openai');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const taskSchema = new mongoose.Schema({
  taskId: String,
  status: String,
  imageUrls: [String],
  error: String,
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

const defaultPrompt = {
  anime: {
    sfw: {
      model_name: "novaAnimeXL_ponyV20_461138.safetensors",
      sampler_name: "Euler a",
      prompt: "score_9, score_8_up, source_anime, masterpiece, best quality, (ultra-detailed), (perfect hands:0.1), (sfw), dressed, clothes, ",
      negative_prompt: "score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple, topless, nsfw, naked, nude, sex, worst quality, low quality,young,child,",
      loras: []
    }
  },
  realistic: {
    sfw: {
      model_name: "epicrealismXL_v10_247189.safetensors",
      sampler_name: "DPM++ 2M Karras",
      prompt: "best quality, ultra high res, (photorealistic:1.4), masterpiece,",
      negative_prompt: "nsfw,nude, topless, worst quality, low quality,disform,weird body,multiple hands,young,child, ",
      loras: []
    }
  }
};

const params = {
  width: 768,
  height: 1024,
  guidance_scale: 10,
  steps: 30,
  image_num: 1,
  clip_skip: 0,
  seed: -1
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/enhance-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'プロンプトを画像生成に適した形に最適化してください。詳細な描写を追加してください。Respond in english only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    const enhancedPrompt = response.choices[0].message.content.trim();
    res.json({ enhancedPrompt });
  } catch (error) {
    console.error(error);
    res.status(500).send('プロンプトの強化に失敗しました');
  }
});

async function fetchNovitaMagic(data) {
  const response = await axios.post('https://api.novita.ai/v3/async/txt2img', {
    extra: {
      response_image_type: 'jpeg',
      enable_nsfw_detection: false,
      nsfw_detection_level: 0
    },
    request: data
  }, {
    headers: {
      Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.task_id;
}

async function fetchNovitaResult(taskId) {
  const response = await axios.get(`https://api.novita.ai/v3/async/task-result?task_id=${taskId}`, {
    headers: {
      Authorization: `Bearer ${process.env.NOVITA_API_KEY}`
    }
  });
  const taskStatus = response.data.task.status;

  if (taskStatus === 'TASK_STATUS_SUCCEED') {
    const images = response.data.images;
    const imageUrls = [];

    for (const image of images) {
      const imageResponse = await axios.get(image.image_url, { responseType: 'arraybuffer' });
      const key = `${uuidv4()}.jpeg`;
      await s3.putObject({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: imageResponse.data,
        ContentType: 'image/jpeg',
      }).promise();
      imageUrls.push(`https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}`);
    }

    return imageUrls;
  } else if (taskStatus === 'TASK_STATUS_FAILED') {
    throw new Error(`Task failed with reason: ${response.data.task.reason}`);
  } else {
    return null;
  }
}

router.post('/generate-image', async (req, res) => {
  try {
    const { prompt, imageStyle, imageCount, aspectRatio } = req.body;

    const selectedStyle = defaultPrompt[imageStyle]['sfw'];
    const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number);

    let width, height;

    if (ratioWidth >= ratioHeight) {
    width = 1024;
    height = Math.round(1024 * (ratioHeight / ratioWidth));
    } else {
    height = 1024;
    width = Math.round(1024 * (ratioWidth / ratioHeight));
    }

    width = Math.floor(width / 8) * 8;
    height = Math.floor(height / 8) * 8;
    const requestData = {
      ...params,
      model_name: selectedStyle.model_name,
      sampler_name: selectedStyle.sampler_name,
      loras: selectedStyle.loras,
      prompt: selectedStyle.prompt + prompt,
      negative_prompt: selectedStyle.negative_prompt,
      image_num: parseInt(imageCount),
      width: width,
      height: height
    };

    const taskId = await fetchNovitaMagic(requestData);

    const newTask = new Task({
      taskId: taskId,
      status: 'pending'
    });
    await newTask.save();

    res.json({ taskId: taskId });
  } catch (error) {
    console.error(error);
    res.status(500).send('画像生成の開始に失敗しました');
  }
});

router.get('/task-status/:taskId', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const task = await Task.findOne({ taskId: taskId });

    if (!task) {
      return res.status(404).send('タスクが見つかりません');
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return res.json(task);
    }

    const imageUrls = await fetchNovitaResult(taskId);

    if (imageUrls) {
      task.status = 'completed';
      task.imageUrls = imageUrls;
      await task.save();
      res.json(task);
    } else {
      res.json({ status: 'processing' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('タスクステータスの確認に失敗しました');
  }
});

module.exports = router;
