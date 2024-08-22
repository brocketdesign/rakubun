const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");




router.get('/google', function(req, res, next) {
  const callbackURL = `${req.protocol}://${req.get('host').replace('192.168.10.115', 'localhost')}/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
      },
      async function (accessToken, refreshToken, profile, done) {
        try {
          const users = db.collection('users');
          let user = await users.findOne({ social_user_id: profile.id });

          if (!user) {
            const newUser = {
              social_user_id: profile.id,
              name: profile.displayName,
              email: profile.emails[0].value,
              registration_type: "google",
            };
            const result = await users.insertOne(newUser);
            user = result.ops[0];
          }

          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', failureMessage: 'Whoops, something went wrong with Google sign-in!' }),
  function(req, res) {
    // Successful authentication, let's dance our way to the home page!
    res.redirect('/');
  });

  module.exports = router;