// txt2img.js

const { ObjectId } = require('mongodb');
const axios = require('axios');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: './.env' });

const NOVITA_API_URL = 'https://api.novita.ai/v3/async/txt2img';

// Function to initiate image generation and return task ID
async function txt2img(options) {
  const { prompt, negativePrompt, width, height, blogId } = options;
  try {
    const image_request = {
      model_name:
        options.checkpoint ||
        'protovisionXLHighFidelity3D_beta0520Bakedvae_106612.safetensors',
      prompt: prompt,
      negative_prompt:
        negativePrompt ||
        '(worst quality, low quality:1.4), blurry, text, error, missing fingers, extra digit, cropped, jpeg artifacts, signature, watermark, username, blurry,',
      width: width || 877,
      height: height || 480,
      image_num: 1,
      steps: 30,
      seed: -1,
      clip_skip: 1,
      guidance_scale: 7.5,
      sampler_name: 'DPM++ 2S a Karras',
    };

    // Initiate image generation request to Novita API
    const response = await axios.post(
      NOVITA_API_URL,
      {
        extra: {
          response_image_type: 'jpeg',
          enable_nsfw_detection: false,
          nsfw_detection_level: 0,
        },
        request: image_request,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Error: ${response.status} - ${response.data}`);
    }

    const task_id = response.data.task_id;

    // Save the task in the database with status 'pending'
    await saveImageTaskToDB(blogId, prompt, task_id);

    // Return the task ID immediately
    return { task_id };
  } catch (error) {
    console.error('Error initiating image generation:', error.message);
    throw error;
  }
}

// Function to save the task in the database
async function saveImageTaskToDB(blogId, prompt, task_id) {
  const imageTaskID = new ObjectId();
  const collection = global.db.collection('imageTasks');
  await collection.insertOne({
    _id: imageTaskID,
    blogId: new ObjectId(blogId),
    prompt: prompt,
    task_id: task_id,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return imageTaskID;
}

// Function to check the task status and retrieve the result
async function getTxt2ImgResult(task_id) {
  try {
    const response = await axios.get(
      `https://api.novita.ai/v3/async/task-result?task_id=${task_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Error fetching result: ${response.status} - ${response.data}`);
    }

    const taskStatus = response.data.task.status;

    if (taskStatus === 'TASK_STATUS_SUCCEED') {
      const images = response.data.images;
      if (images.length === 0) {
        throw new Error('No images returned from Novita API');
      }

      // Download the image from Novita
      const imageUrl = images[0].image_url;
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imageResponse.data, 'binary');

      // Update the task status in the database
      await updateImageTaskStatus(task_id, 'completed');

      return { imageBuffer: buffer };
    } else if (taskStatus === 'TASK_STATUS_FAILED') {
      // Update the task status in the database
      await updateImageTaskStatus(task_id, 'failed');
      throw new Error(`Task failed with reason: ${response.data.task.reason}`);
    } else {
      // Task is still processing
      return { status: 'processing' };
    }
  } catch (error) {
    console.error('Error fetching image result:', error.message);
    throw error;
  }
}

// Function to update the task status in the database
async function updateImageTaskStatus(task_id, status) {
  const collection = global.db.collection('imageTasks');
  await collection.updateOne(
    { task_id: task_id },
    {
      $set: {
        status: status,
        updatedAt: new Date(),
      },
    }
  );
}

module.exports = { txt2img, getTxt2ImgResult };
