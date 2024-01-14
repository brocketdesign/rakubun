const express = require('express');
const router = express.Router();
const passport = require('passport');

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
  function(req, res) {
    // The request will be redirected to Google for authentication, so this
    // function will not be called.
  });

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', failureMessage: 'Whoops, something went wrong with Google sign-in!' }),
  function(req, res) {
    // Successful authentication, let's dance our way to the home page!
    res.redirect('/');
  });

  module.exports = router;