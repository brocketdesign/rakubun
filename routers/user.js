const express = require('express');
const multer = require('multer');
const {
  formatDateToDDMMYYHHMMSS,
  addUsertoFreePlan
} = require('../services/tools')

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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_STORAGE_FOLDER);
  },
  filename: function (req, file, cb) {
    cb(null, `${file.fieldname}-${req.user._id}-${formatDateToDDMMYYHHMMSS()}.jpg`);
  }
});


const upload = multer( {storage: storage });

router.post('/updateProfile', upload.fields([{ name: 'profileImage' }, { name: 'bannerImage' }, {name : 'imageUpload'}]), async (req, res) => {

  try {
      let user

      if(req.body.resetToken){
        // Find the user with the matching reset token
        user = await global.db.collection('users').findOne({ resetToken : req.body.resetToken });
      }else{
        user = req.user
      }

      const userId = user._id;  // Retrieve user ID from req object
      const updatedInfo = req.body;  // Retrieve updated data from form submission
      updatedInfo.galleryImages = user.galleryImages || []

      //console.log(req.body) 
      //console.log(req.files) 

      if (req.files) {

        let profileImage = req.files['profileImage'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['profileImage'][0].filename}` : null;
        let bannerImage = req.files['bannerImage'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['bannerImage'][0].filename}` : null;
        let galleryImage = req.files['imageUpload'] ? `${process.env.UPLOAD_STORAGE_FOLDER.replace('public','')}${req.files['imageUpload'][0].filename}` : null;

        // If a file was uploaded, add the file path to the user's data
        if (profileImage) {
          updatedInfo.profileImage = profileImage;
        }
        if (bannerImage) {
          updatedInfo.bannerImage = bannerImage;
        }
        if (galleryImage) {
          // Assuming updatedInfo.galleryImages is initially an empty array or already an array
          updatedInfo.galleryImages.push(galleryImage);
        }
      }
      if(updatedInfo.userPassword){
        updatedInfo.password = await bcrypt.hash(updatedInfo.userPassword, 10);
        user.password = updatedInfo.password

        const EmailData = {
          username: user.username, 
        };
    
        sendEmail(user.email, 'password update', EmailData)
          .then(() => console.log('Email sent!'))
          .catch(error => console.error(`Error sending email: ${error}`));

      }
      // Use global.db to get a reference to the users collection
      const usersCollection = global.db.collection('users');

      // Update user in the collection
      await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: updatedInfo });

      if(req.body.resetToken){
        await global.db.collection('users').updateOne({ resetToken : req.body.resetToken },{$set:{resetToken:false,validityToken:false}});
      }
      
      res.json({ status: 'success', message: 'Profile has been updated.' });
  } catch (error) {
    console.log(error)
      res.json({ status: 'error', message: 'An error occurred while updating the profile.' });
  }
});

router.get('/login',async (req, res) => {
  console.log('Login page requested');
  if(req.user){
    res.redirect('/dashboard')
  }
  res.render('user/login'); // Render the login template
});

router.post('/login', async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided and is valid
  if (!email || !/^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,4}$/.test(email)) {
    console.log(`Login failed. Invalid email provided: ${email}`);
    req.flash('error', 'Please provide a valid email address.');
    return res.redirect('/user/login');
  }

  console.log(`Received login request for Email: ${email}`);

  try {
    // Find existing user
    const existingUser = await global.db.collection('users').findOne({ email: email });

    if (!existingUser) {
      console.log(`Login failed. User with Email: ${email} not found.`);
      req.flash('error', 'User with this email does not exist.');
      return res.redirect('/user/login');
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

    return res.render('user/login', {
      prelog: true,
      userID: existingUser._id
    });

  } catch (err) {
    console.error(`Login error for Email: ${email}. Error: ${err.message}`);
    req.flash('error', 'An error occurred during login. Please try again.');
    return res.redirect('/user/login');
  }
});



router.get('/signup', (req, res) => {
  console.log('Signup page requested');
  if(req.user){
    res.redirect('/dashboard')
  }
  res.render('user/signup'); // Render the signup template
});

router.get('/logout', (req, res) => {
  console.log('Logout requested');

  req.logout(function(err) {
    req.session.destroy((err) => {
      if (err) {
        console.log('Error : Failed to destroy the session during logout.', err);
      } else {
        req.user = null;
        console.log('Logout response: Redirecting to /login');
        res.redirect('/user/login');
      }
    });
  });
  
});

router.get('/resetpassword', async (req, res) => {
  const resetToken = req.query.resetToken || false; // Assuming the token is passed as a query parameter

  try {
    // Find the user with the matching reset token
    const user = await global.db.collection('users').findOne({ resetToken });

    if (!user) {
      // No user found with the provided reset token
      return res.render('user/resetpassword', { error: 'Invalid reset token' });
    }

    if (new Date() > user.validityToken) {
      // The token has expired
      return res.render('user/resetpassword', { error: 'Reset token has expired' });
    }

    // Valid reset token, proceed with password reset
    res.render('user/resetpassword', { resetToken });

  } catch (err) {
    console.error('Error during password reset:', err);
    res.render('user/resetpassword', { error: 'Error during password reset' });
  }
});


router.post('/resetpassword', async (req, res, next) => {
  const crypto = require('crypto');

  const { email } = req.body;
  console.log(`Password reset request: ${JSON.stringify(req.body)}`);
  
  try {
    const existingUser = await global.db.collection('users').findOne(
      { $or: [{ email: email }] }
    );
  
    if (!existingUser) {
      req.flash('error', 'We could not find your email in our database'); // Set an error flash message
      return res.redirect('/user/resetpassword');
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const validity = new Date();
    validity.setMinutes(validity.getMinutes() + 10);
    const protocol = req.protocol;
    const host = req.get('host');
    const link = `${protocol}://${host}/user/resetpassword?resetToken=${resetToken}`;


    await global.db.collection('users').updateOne({_id:new ObjectId(existingUser._id)},{$set:{resetToken:resetToken,validityToken:validity}})
    
    const EmailData = {
      username: existingUser.username, 
      resetToken: resetToken,
      link:link
    };

    sendEmail(email, 'password reset', EmailData)
      .then(() => console.log('Email sent!'))
      .catch(error => console.error(`Error sending email: ${error}`));


    req.flash('info', 'We sent you an email with a reset password link valide for 10 minutes.'); // Set an info flash message
    res.redirect('/user/login');
  } catch (err) {
    console.log('Signup error:', err);
    return next(err);
  }
});



router.post('/signup', async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided and is valid
  if (!email || !/^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,4}$/.test(email)) {
    console.log(`Signup failed. Invalid email provided: ${email}`);
    req.flash('error', 'Please provide a valid email address.');
    return res.redirect('/user/signup');
  }
  
  console.log(`Received signup request for Email: ${email}`);
  
  try {
    const existingUser = await global.db.collection('users').findOne({ email: email });
  
    if (existingUser) {
      console.log(`Signup failed. User with Email: ${email} already exists.`);
      req.flash('error', 'A user with this email already exists.');
      return res.redirect('/user/signup');
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

    return res.render('user/signup', {
      presign: true,
      userID: result.insertedId
    });
    

  } catch (err) {
    console.error(`Signup error for Email: ${email}. Error: ${err.message}`);
    req.flash('error', 'An error occurred during signup. Please try again.');
    return res.redirect('/user/signup');
  }
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
