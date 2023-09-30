require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const compression = require('compression');

const http = require('http');
const LocalStrategy = require('passport-local').Strategy;
const { MongoClient, ObjectId } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);
const { StableDiffusionApi } = require("stable-diffusion-api");

const passport = require('passport');
const path = require('path'); // Add path module
const ip = require('ip');
const bcrypt = require('bcrypt');
const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;

const url = process.env.MONGODB_URL; // Use MONGODB_URL from .env file
const dbName = process.env.MONGODB_DATABASE; // Use MONGODB_DATABASE from .env file

function startServer() {
  MongoClient.connect(url, { useUnifiedTopology: true })
    .then(client => {
      console.log('Connected to MongoDB...');

      const db = client.db(dbName); // Use the database name from .env file
      global.db = db; // Save the db connection in a global variable
      
      // Use the express-session middleware
      app.use(
        session({
          secret: process.env.SESSION_SECRET, // Use SESSION_SECRET from .env file
          resave: false,
          saveUninitialized: false,
          store: new MongoDBStore({
            uri: url,
            collection: 'sessions',
          }),
        })
      );

      // Serve static files from the 'public' directory
      app.use(express.static(path.join(__dirname, 'public')));

      // Continue with the remaining code...

      // Passport config
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
      
      app.use(compression());
      app.use(flash());
      app.use((req, res, next) => {
        res.locals.messages = req.flash();
        next();
      });
      
      app.use(passport.initialize());
      app.use(passport.session());

      // Add other middleware
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.set('view engine', 'pug');
      app.set('views', './views');

      // Define your routers
      const index = require('./routers/index');
      const user = require('./routers/user');
      const payment = require('./routers/payment');
      const dashboard= require('./routers/dashboard/index');
      const dating = require('./routers/dashboard/dating');

      app.use('/', index); 
      app.use('/user', user); 
      app.use('/payment', payment);
      app.use('/dashboard', dashboard);
      app.use('/dashboard/app/dating', dating);



      server.listen(port, () => 
      console.log(`Express running → PORT http://${ip.address()}:${port}`));
    })
    .catch(err => {
      console.log('Error occurred while connecting to MongoDB...\n', err);
    });
}

startServer();
