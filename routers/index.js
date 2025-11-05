const express = require('express');
const router = express.Router();
const axios = require('axios');

// Require and use 'express-session' middleware
const session = require('express-session');
const { email, sendEmail } = require('../services/email')

const imageGeneratorRoutes = require('./api/imageGenerator');
const trendAutoBlogRoutes = require('./api/trendautoblog'); // Added this line

router.get('/',async(req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard'); // Redirect to the dashboard if user is logged in
  }

  // Set the mode to 1 in the session
  req.session.mode = '1';
  const faq = require('../services/faq')

  res.render('index',{faq,googleTag:process.env.GOOGLE_TAG}); // Render the top page template
});
router.get('/lp1',async(req, res, next) => {
  res.render('lp/index1',{googleTag:process.env.GOOGLE_TAG}); // Render the top page template
});
// This route renders the contact form
router.get('/login', async (req, res, next) => {
  res.redirect('/');
});
// This route renders the contact form
router.get('/contact', async (req, res, next) => {
  res.render('contact', { user: req.user, sent: false });
});

// This route renders the contact form with a success message after the emails are sent
router.get('/contact-success', async (req, res, next) => {
  res.render('contact', { user: req.user, sent: true });
});

// This route handles the form submission
router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;

  const EmailDataForAdmin = {
      username: name,
      email: email,
      message: message
  };

  const EmailDataForUser = {
      username: name
  };

  const sendEmailToAdmin = sendEmail('admin@hatoltd.com', 'contact form admin', EmailDataForAdmin);
  const sendEmailToUser = sendEmail(email, 'contact form user', EmailDataForUser);

  // Sending both emails in parallel using Promise.all
  Promise.all([sendEmailToAdmin, sendEmailToUser])
      .then(() => {
          console.log('Both emails sent!');
          
          // Redirect to the GET route with a success flag
          res.redirect('/contact-success');
      })
      .catch(error => {
          console.error(`Error sending emails: ${error}`);
          res.status(500).send('Error sending emails.');
      });
});



// Handle GET request for /about-us
router.get('/about-us', (req, res) => {
  // Log that a GET request has been received for /about-us
  console.log('GET request received for /about-us');
  const user = req.user 
  // Render the 'about-us' template
  res.render('about-us',{user});
});

router.post('/notify-user', (req, res) => {
  const { userId, type, additionalData } = req.body;
  sendNotificationToUser(userId, type, additionalData);
  res.send({ status: 'Notification sent' });
});

router.get('/active-connections', (req, res) => {
  const activeConnections = getActiveConnections();
  res.send({ activeConnections });
});

router.use('/api/image-generator', imageGeneratorRoutes);
router.use('/api/trendautoblog', trendAutoBlogRoutes); // Added this line

// landing-page routes rakubun-wordpress-plugin
const rakubunWordpressPluginRoutes = require('./landing-page/rakubun-wordpress-plugin');
router.use('/landing-page/rakubun-wordpress-plugin', rakubunWordpressPluginRoutes);

// Export the router
module.exports = router;
