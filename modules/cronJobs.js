// cronjob.js
const cron = require('node-cron');
const { ObjectId } = require('mongodb');
const { autorsspost ,autoBlog} = require('./autoblog')

let cronJobsMap = {};

// Function to set a cron job for a user
const setCronJobForUser = async (blogId, schedule) => {
  const blogInfo = await db.collection('blogInfos').findOne({ _id: new ObjectId(blogId) });

  if (cronJobsMap[blogId] ) {
    cronJobsMap[blogId].stop();
  }
  
  if(!blogInfo || !blogInfo.isActive){
    cronJobsMap[blogId].stop();
    console.log(`Stop job for blog ${blogId}`)
    return
  }

  console.log(`Set job for blog ${blogId} at ${blogInfo.postFrequency}`)
  cronJobsMap[blogId] = cron.schedule(blogInfo.postFrequency, () => {
    console.log(`Doing something for blog ${blogId}`);
    autoBlog(blogInfo,db)
  });
};

// Function to initialize all cron jobs from database at app start
const initializeCronJobs = async (db) => {
  // Assuming you have a function to get all user schedules from your database
  const blogs = await db.collection('blogInfos').find({ isActive: true }).toArray(); // You'll need to implement this
  blogs.forEach(blog => {
    setCronJobForUser(blog._id, blog.postFrequency);
  });
};

module.exports = { setCronJobForUser, initializeCronJobs };
