const { StableDiffusionApi } = require("a1111-webui-api");
const { ObjectId } = require('mongodb');
const fs = require('fs');
const ngrok = require('ngrok');
const {startNgrok,stopNgrok} = require('../services/startNgrok');

async function getApiConfiguration() {
  let host = 'localhost';
  let port = 42421;

  if (process.env.NODE_ENV !== 'local') {
    // Start NGROK and get a public URL
    const url = await startNgrok(port);
    if (!url) {
      throw new Error('Failed to start NGROK. Check logs for more details.');
    }
    const urlObj = new URL(url);
    host = urlObj.hostname;
    port = urlObj.port || ''; // NGROK might provide a different port
    console.log(`NGROK running at ${url}`);
  }

  // Assuming StableDiffusionApi is imported or defined elsewhere
  return new StableDiffusionApi({
    host: host,
    port: port, 
    protocol: "http",
    defaultSampler: "DPM++ SDE",
    sampler_name: "DPM++ SDE",
    defaultStepCount: 40,
    cfg_scale: 7,
    safety_checker: true,
  });
}
  
const default_prompt = "High-quality photorealistic, showcasing a vibrant,detailed , colorful,clear,enhancing the colors and shadows for a cinematic feel./n"
const default_negative_prompt = 'face,man,woman,character,realistic face, body, (low quality, worst quality, bad quality, lowres:1.2), bad photo, bad art,oversaturated, watermark, username, signature, text, error, cropped, jpeg artifacts, autograph, trademark, (canvas frame, canvas border, out of frame:1.2),bad anatomy, bad hands, missing fingers, extra digit, fewer digits, bad feet, extra fingers, mutated hands, poorly drawn hands, bad proportions, extra limbs, disfigured, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck,nsfw,naked,nipple'

async function txt2img(options){
  const sdapi = await getApiConfiguration();

  const prompt = options.prompt ? default_prompt + options.prompt : default_prompt;
  const negative_prompt = (options.negativePrompt && options.negativePrompt != '')? options.negativePrompt : default_negative_prompt;
  const aspectRatio = options.aspectRatio;

  const height = options.height ? options.height :768
  // Calculate the width based on the aspect ratio and the fixed height of 768
  const width = getWidthForAspectRatio(height, aspectRatio);

  const payload = {
    prompt,
    negative_prompt,
    width, // Use the calculated width
    height // Fixed height as provided
  };

  try {
    const result = await sdapi.txt2img(payload);
    const imageID = await saveImageToDB(db, options.blogId, prompt, result.image, aspectRatio);

    //await ensureFolderExists('./public/output');
    //const imagePath = `./public/output/${imageID}.png`;
    //await result.image.toFile(imagePath);
    //const base64Image = await convertImageToBase64(imagePath);

    //const imagePath = await uploadFileToS3(result.image, `${imageID}.png`)

    // Assume 'result.image' is a Sharp object
    const imageBuffer = await result.image.toBuffer();

    if (process.env.NODE_ENV !== 'local') {
      //stopNgrok();
    }
    return{ imageID, imageBuffer };
  } catch (err) {
    console.log(err)
    if (process.env.NODE_ENV !== 'local') {
      //stopNgrok();
    }
    return
  }
}

module.exports = {txt2img}


function getWidthForAspectRatio(height, ratio) {
  const [widthRatio, heightRatio] = ratio.split(':').map(Number);
  return Math.round((height * widthRatio) / heightRatio);
}

async function convertImageToBase64(imagePath) {
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  return base64Image;
}
async function saveImageToDB(db, blogId, prompt, image, aspectRatio) {
  const imageID = new ObjectId();
  const collection = db.collection('images');
  await collection.insertOne({
    _id: imageID,
    blogId,
    prompt,
    aspectRatio
  });
  
  return imageID;
}
async function ensureFolderExists(folderPath) {
  try {
    // Check if the folder exists
    await fs.promises.access(folderPath, fs.constants.F_OK);
  } catch (error) {
    // Folder does not exist, create it
    await fs.promises.mkdir(folderPath, { recursive: true });
  }
}