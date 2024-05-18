const { StableDiffusionApi } = require("a1111-webui-api");
const { ObjectId } = require('mongodb');
const fs = require('fs');

const sdapi = new StableDiffusionApi({
    host: 'localhost',
    port: 42421, 
    protocol: "http",
    defaultSampler: "DPM++ SDE",
    sampler_name: "DPM++ SDE",
    defaultStepCount: 40,
    cfg_scale :7,
    safety_checker: true,
  });
  
const default_prompt = "High-quality photorealistic, showcasing a vibrant,detailed, expressive characters, futuristic fashion, lively , colorful.clear, dynamic poses and emotions. golden hour, enhancing the colors and shadows for a cinematic feel./n"
const default_negative_prompt = '(low quality, worst quality, bad quality, lowres:1.2), bad photo, bad art,oversaturated, watermark, username, signature, text, error, cropped, jpeg artifacts, autograph, trademark, (canvas frame, canvas border, out of frame:1.2),bad anatomy, bad hands, missing fingers, extra digit, fewer digits, bad feet, extra fingers, mutated hands, poorly drawn hands, bad proportions, extra limbs, disfigured, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck,nsfw,naked,nipple'

async function txt2img(options){

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
    await ensureFolderExists('./public/output');

    const imagePath = `./public/output/${imageID}.png`;
    await result.image.toFile(imagePath);

    //const base64Image = await convertImageToBase64(imagePath);
    return{ imageID, imagePath };
  } catch (err) {
    console.log(err)
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