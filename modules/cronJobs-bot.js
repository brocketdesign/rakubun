// cronjob.js
const cron = require('node-cron');
const { ObjectId } = require('mongodb');
const { autoBlog } = require('./init-bot');
const { scrapeTwittrend } = require('./trendScraper'); // Added for trend scraping

let cronJobsMap = {};
let trendScraperJob = null; // Added to manage the trend scraper job

// Function to set a cron job for a user
const setCronJobForUser = async (db, botId, schedule) => {

  const botInfo = await db.collection('botInfos').findOne({ _id: new ObjectId(botId) });
  const blogInfo = await db.collection('blogInfos').findOne({ _id: new ObjectId(botInfo.blogId) });

  if (cronJobsMap[botId]) {
    cronJobsMap[botId].stop();
  }
  
  if (!botInfo || !botInfo.isActive) {
    if (cronJobsMap[botId]) {
      cronJobsMap[botId].stop();
    }
    console.log(`Stop job for bot ${botId}`);
    return;
  }
  botInfo.botId = botInfo._id;
  blogInfo.blogId = blogInfo._id;
  const combinedPowers = { ...botInfo, ...blogInfo };

  if (botInfo.postFrequency) {
    console.log(`Set job for blog ${botId} at ${botInfo.postFrequency}`);
    cronJobsMap[botId] = cron.schedule(botInfo.postFrequency, () => {
      console.log(`Doing something for blog ${botId}`);
      autoBlog(combinedPowers, db);
    });
  }
};

// Function to initialize and manage the trend scraping job
const initializeTrendScraperJob = async (db) => {
  console.log('Initializing Trend Scraper Job to run hourly...');
  // Stop existing job if it's running
  if (trendScraperJob) {
    trendScraperJob.stop();
  }

  // Schedule the job to run every hour (at the beginning of the hour)
  trendScraperJob = cron.schedule('0 * * * *', async () => {
    console.log('Cron job: Running scrapeTwittrend...');
    try {
      const result = await scrapeTwittrend(); // Assumes scrapeTwittrend handles its own DB connection or can use one passed to it
      if (result.success) {
        console.log(`Trend scraping successful: ${result.count} trends processed. Message: ${result.message}`);
      } else {
        console.error(`Trend scraping failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error executing scheduled trend scraping:', error);
    }
  });

  // Optionally, run once on startup if desired, after a short delay
  setTimeout(async () => {
    console.log('Initial run: Running scrapeTwittrend...');
    try {
      const result = await scrapeTwittrend();
      if (result.success) {
        console.log(`Initial trend scraping successful: ${result.count} trends processed. Message: ${result.message}`);
      } else {
        console.error(`Initial trend scraping failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error during initial trend scraping:', error);
    }
  }, 5000); // 5-second delay
};

const initializeCronJobs = async (db) => {
  const bots = await db.collection('botInfos').find({ isActive: true }).toArray(); 
  bots.forEach(bot => {
    setCronJobForUser(db, bot._id, bot.postFrequency);
  });

  // Initialize the trend scraper job
  initializeTrendScraperJob(db); // Pass db if scrapeTwittrend needs it, otherwise it's not strictly necessary here
};

module.exports = { setCronJobForUser, initializeCronJobs, initializeTrendScraperJob }; // Export the new function as well

