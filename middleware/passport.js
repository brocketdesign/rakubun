const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const dotenvConfig = require("dotenv").config();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { MongoClient, ObjectId } = require('mongodb');
//
//
//  PASSPORT CONFIG
//
//
module.exports = function (passport) {
   // Passport config

    passport.serializeUser(function (user, done) {
        done(null, user._id.toString()); // Convert ObjectId to string
    });

    passport.deserializeUser(function (id, done) {
        db.collection('users')
        .findOne({ _id: new ObjectId(id) })
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
    });

      passport.use(
        new LocalStrategy({
          usernameField: 'email',
          passwordField: 'password'
        },function (email, password, done) {
          db.collection('users')
            .findOne({ email })
            .then(user => {
              if (!user) {
                console.log('LocalStrategy: No user found with this username.');
                return done(null, false, { message: 'Incorrect username.' });
              }
              console.log('LocalStrategy: User found, comparing passwords...');
              // Use bcrypt to compare the input password with the hashed password in the database
              bcrypt.compare(password, user.password).then(isMatch => {
                if (isMatch) {
                  console.log('LocalStrategy: Passwords match, login successful.');
                  return done(null, user);
                } else {
                  console.log('LocalStrategy: Passwords do not match.');
                  return done(null, false, { message: 'Incorrect password.' });
                }
              })
              .catch(err => {
                console.log('Error during password comparison:', err);
                return done(err);
              });
            })
            .catch(err => {
              console.log('Error in LocalStrategy:', err);
              return done(err);
            });
        })
      );

      passport.use(
        new GoogleStrategy(
          {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_APP_CALLBACK_URL,
          },
          async function (accessToken, refreshToken, profile, done) {
            try {
              const users = db.collection('users');
      
              // Try to find the user
              let user = await users.findOne({ social_user_id: profile.id });
      
              // If user doesn't exist, create a new one
              if (!user) {
                const newUser = {
                  social_user_id: profile.id,
                  name: profile.displayName,
                  registration_type: "google",
                  // add any other fields you need
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
    }


