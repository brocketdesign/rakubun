const express = require('express');
const multer = require('multer');
const {
  formatDateToDDMMYYHHMMSS,
  addUsertoFreePlan
} = require('../services/tools')

const { handleFileUpload } = require('../services/tools')
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const { email, sendEmail } = require('../services/email')

const { ObjectId } = require('mongodb');
const { hostname } = require('os');

router.get('/setting', (req, res) => {
  console.log('User setting page requested');
  res.render('user/setting',{user:req.user}); // Render the login template
});


router.post('/updateProfile', async (req, res) => {
  let user;

  if (req.body.resetToken) {
      user = await global.db.collection('users').findOne({ resetToken: req.body.resetToken });
  } else {
      user = req.user;
  }

  try {
      const formData = req.body;
      let profileImageUrl;
console.log(req.files)
      if (req.files && req.files.profileImage) {
          const profileImage = req.files.profileImage[0];
          profileImageUrl = await handleFileUpload(profileImage);
          user.profileImage = profileImageUrl;
      }

      const updatedData = {
        email: formData.email,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        birthDate: formData.birthDate,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        country: formData.country,
        language: formData.language
    };
    
    if (profileImageUrl) {
        updatedData.profileImage = profileImageUrl;
    }    
console.log(updatedData)
      await global.db.collection('users').updateOne(
          { _id: user._id },
          { $set: updatedData }
      );

      res.json({ success: true, message: 'Profile updated successfully', profileImage: profileImageUrl });
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ success: false, message: 'An error occurred while updating the profile' });
  }
});

// POST /login
router.post('/login', async (req, res, next) => {
  try {
    // Destructure email from request body
    const { email } = req.body;

    // Log received email
    console.log(`Received email: ${email}`);

    // Check if the email exists in the 'users' collection
    const existingUser = await global.db.collection('users').findOne({ email: email });

    // Log existing user
    console.log(`Existing user: ${JSON.stringify(existingUser)}`);

    if (existingUser) {
      // If the email exists, execute the login function
      return await login(req,res);
    } else {
      // If the email doesn't exist, execute the signup function
      return await signup(req,res);
    }
  } catch (error) {
    console.log(`Error occurred: ${error}`);
    res.status(500).send('An error occurred');
  }
});

  async function login(req,res){
    const { email } = req.body;

    // Check if email is provided and is valid
    if (!email || !/^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,4}$/.test(email)) {
      console.log(`Login failed. Invalid email provided: ${email}`);
      return res.send({ 
        prelog: false, 
        status: false, 
        message: 'Please provide a valid email address.' 
      });
    }
  
    console.log(`Received login request for Email: ${email}`);
  
    try {
      // Find existing user
      const existingUser = await global.db.collection('users').findOne({ email: email });
  
      if (!existingUser) {
        console.log(`Login failed. User with Email: ${email} not found.`);
        return res.send({
          prelog: false, 
          status: false, 
          message: 'User with this email does not exist.'
        });
      }
  
      // Generate a new randomkey for login
      const randomkey = Math.random().toString(36).slice(-8);
      const hash_randomkey = await bcrypt.hash(randomkey, 10);
  
      // Update the randomkey and its timestamp in the database
      await global.db.collection('users').updateOne(
        { email: email },
        {
          $set: {
            randomkey: hash_randomkey,
            isKeyActive:false,
            randomkey_date: new Date()
          }
        }
      );
  
      console.log(`Randomkey updated for Email: ${email}`);
  
      // Send the randomkey via email
      const hostname = req.hostname;
      const loginEmailData = {
        FIRSTNAME: existingUser.username,
        RANDOMKEY: hash_randomkey,
        HOSTNAME: hostname,
        USERID: existingUser._id
      };
  
      sendEmail(email, 'login', loginEmailData)
        .then(() => console.log('Login Email sent!'))
        .catch(error => console.error(`Error sending login email: ${error}`));
  
      return res.send({
        prelog: true,
        status: true, 
        userID: existingUser._id,
        message:'Verify your email to login'
      });
  
    } catch (err) {
      console.error(`Login error for Email: ${email}. Error: ${err.message}`);
      return res.send({
        prelog:false,
        status:false,
        message:'An error occurred during login. Please try again.'
      });
    }
  }

  async function signup(req,res){
    const { email } = req.body;

    // Check if email is provided and is valid
    if (!email || !/^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,4}$/.test(email)) {
      console.log(`Signup failed. Invalid email provided: ${email}`);
      return res.send({ 
        prelog: false, 
        status: false, 
        message: 'Please provide a valid email address.' 
      });
    }
    
    console.log(`Received signup request for Email: ${email}`);
    
    try {
      const existingUser = await global.db.collection('users').findOne({ email: email });
    
      if (existingUser) {
        console.log(`Signup failed. User with Email: ${email} already exists.`);
        return res.send({
          prelog: false, 
          status: false, 
          message: 'A user with this email already exists.'
        });
      }
    
      // Here, you might want to generate a random username or some other mechanism
      // since you don't have a username in the request body.
      const generatedUsername = `${Math.random().toString(36).substring(7)}`;
      const password = Math.random().toString(36).slice(-8);
      const hash = await bcrypt.hash(password, 10);
      const randomkey = Math.random().toString(36).slice(-8);
      const hash_randomkey = await bcrypt.hash(randomkey, 10);
      // Add user to freePlan on Stripe and get Stripe info
      const stripeInfo = await addUsertoFreePlan(email);
  
      // Insert the user along with Stripe info into the database
      const result = await global.db.collection('users').insertOne({
        signup_date: new Date(),
        email: email,
        username: generatedUsername,
        password: hash,
        randomkey:hash_randomkey,
        isKeyActive:false,
        randomkey_date: new Date(),
        ...stripeInfo
      });
  
      console.log(`User successfully created. Email: ${email}, Username: ${generatedUsername}, ID: ${result.insertedId}`);
      const newUser = await global.db.collection('users').findOne({ _id: result.insertedId });
      const hostname = req.hostname;
  
      const welcomeEmailData = {
        FIRSTNAME: generatedUsername, 
        PASSWORD: password,
        HOSTNAME:hostname,
        RANDOMKEY:hash_randomkey,
        USERID:result.insertedId
      };
    
      sendEmail(email, 'welcome', welcomeEmailData)
        .then(() => console.log('Email sent!'))
        .catch(error => console.error(`Error sending email: ${error}`));
  
      return res.send({
        presign: true,
        status: true, 
        userID: result.insertedId,
        message:'Verify your email to login'
      });
      
  
    } catch (err) {
      console.error(`Signup error for Email: ${email}. Error: ${err.message}`);
      return res.send({
        prelog:false,
        status:false,
        message:'An error occurred during signup. Please try again.'
      });    
    }
  }
  

  router.get('/logout', (req, res) => {
    console.log('Logout requested');
  
    req.logout(function(err) {
      req.session.destroy((err) => {
        if (err) {
          console.log('Error : Failed to destroy the session during logout.', err);
        } else {
          req.user = null;
          console.log('Logout response: Redirecting to /');
          res.redirect('/');
        }
      });
    });
    
  });
  

router.post('/isOldPasswordCorrect', (req, res) => {
  const { oldPassword } = req.body;
  const storedPassword = req.user.password;

  bcrypt.compare(oldPassword, storedPassword).then(isMatch => {
    if (isMatch) {
      console.log('LocalStrategy: Old Passwords match.');
      res.status(200).json({ isMatch: true });
    } else {
      console.log('LocalStrategy: Old Passwords do not match.');
      res.status(200).json({ isMatch: false });
    }
  }).catch(err => {
    console.error(err);
    res.status(500).json({ message: 'An error occurred while verifying the old password.' });
  });
});

router.post('/reset', async (req, res) => {
  const { mode } = req.body;
  console.log('Reset data for mode:',mode)
  try{
    if(!mode){
      console.log('All data reseted ! For user:',req.user.id)
      await global.db.collection('users').updateOne({_id: new ObjectId(req.user._id)},
      {$set:{
        scrapInfo:{},
        scrapedData:[],
      }})
    }
    res.status(200).json({ message: 'Data deleted' });
  }catch{
    res.status(500).json({ message: 'An error occurred while deleting data.' });

  }

});

module.exports = router;
