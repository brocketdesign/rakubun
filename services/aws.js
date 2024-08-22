const axios = require('axios');
const { createHash } = require('crypto');
const aws = require('aws-sdk');

// Configure AWS S3
const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
// Function to get the current counter value from the database
async function getCounter(db) {
const counterDoc = await db.collection('counters').findOne({ _id: 'storyCounter' });
return counterDoc && !isNaN(counterDoc.value) ? counterDoc.value : 0;
}

// Function to update the counter value in the database
async function updateCounter(db, value) {
  await db.collection('counters').updateOne({ _id: 'storyCounter' }, { $set: { value: value } }, { upsert: true });
}

const uploadToS3 = async (buffer, hash, filename) => {
  const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${hash}_${filename}`,
      Body: buffer,
      ACL: 'public-read'
  };
  const uploadResult = await s3.upload(params).promise();
  return uploadResult.Location;
};
const handleFileUpload = async (part) => {
  let buffer;
  
  if (part.file) {
      // Handling uploaded file
      const chunks = [];
      for await (const chunk of part.file) {
          chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
  } else if (part.value && isValidUrl(part.value)) {
      // Handling file from URL
      const response = await axios.get(part.value, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data, 'binary');
  } else {
      throw new Error('No valid file or URL provided');
  }

  const hash = createHash('md5').update(buffer).digest('hex');
  const existingFiles = await s3.listObjectsV2({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: hash,
  }).promise();
  
  if (existingFiles.Contents.length > 0) {
      return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
  } else {
      return uploadToS3(buffer, hash, part.filename || 'uploaded_file');
  }
};

/**
 * Test access to the specified S3 bucket.
 * @param {string} bucketName - The name of the S3 bucket to access.
 * @returns {Promise} - A promise that resolves with the list of objects in the bucket or an error message.
 */
function testS3Access(bucketName) {
    const params = {
      Bucket: bucketName
    };
  
    return new Promise((resolve, reject) => {
      s3.listObjectsV2(params, (err, data) => {
        if (err) {
          console.error("Error accessing S3:", err);
          reject(err);
        } else {
          console.log("Successfully accessed S3. Data:", data);
          resolve(data);
        }
      });
    });
  }
  

module.exports = {handleFileUpload}