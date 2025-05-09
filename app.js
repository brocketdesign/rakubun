// Load environment variables from .env file
require('dotenv').config();

// Import core modules
const fs = require('fs');
const path = require('path');
const http = require('http');
const ip = require('ip');

// Import npm packages
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const compression = require('compression');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');

// Import custom modules
const { initializeCronJobs } = require('./modules/cronJobs-bot.js');
const { updateAllFavicons } = require('./services/tools.js');
const passportConfig = require('./middleware/passport')(passport);
const { setupWebSocketServer, sendNotificationToUser, getActiveConnections } = require('./modules/websocket');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Set up port and MongoDB URL from environment variables
const port = process.env.PORT || 3000;
const url = process.env.MONGODB_URL; // Use MONGODB_URL from .env file
const dbName = process.env.MONGODB_DATABASE; // Use MONGODB_DATABASE from .env file

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName // Explicitly set the database name for Mongoose
});

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected');
});

mongoose.connection.on('error', (err) => {
  console.log('Mongoose connection error:', err);
});

function startServer() {
  MongoClient.connect(url, { useUnifiedTopology: true })
    .then(client => {
      console.log('Connected to MongoDB...');

      const db = client.db(dbName); // Use the database name from .env file
      global.db = db; // Save the db connection in a global variable
      initializeCronJobs(db)
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
      
      // Middleware to load translations
      function translationMiddleware(req, res, next) {
          const lang = req.query.lang || 'ja'; // Default to 'ja' if no lang is specified
          const langPath = path.join(__dirname, 'local', `${lang}.json`);
      
          try {
          const translations = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
          req.translations = translations; // Attach translations to the request
          global.translations = translations; // Attach translations to the global scope for WebSocket server
          } catch (error) {
          req.translations = {}; // Fallback if no file found
          global.translations = {}; // Fallback if no file found
          }
          next();
      }
      app.use(translationMiddleware);

      app.use(compression());
      app.use(flash());
      app.use((req, res, next) => {
        res.locals.messages = req.flash();
        next();
      });
      app.use((req, res, next) => {
        if (process.env.MODE !== 'local' && req.header('x-forwarded-proto') !== 'https') {
          res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
          next();
        }
      });         
      app.use(passport.initialize());
      app.use(passport.session());

      // Add other middleware
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));

      app.set('trust proxy', 1); 
      
      app.use(cors());

      app.set('view engine', 'pug');
      app.set('views', './views');

      // Define your routers
      const index = require('./routers/index');
      const user = require('./routers/user');
      const auth = require('./routers/auth');
      const payment = require('./routers/payment');
      const enterprise = require('./routers/enterprise');
      const dashboard= require('./routers/dashboard/index');
      const generator = require('./routers/api/generator');
      const autoblog = require('./routers/api/autoblog');
      const admin = require('./routers/admin.js');
      const templateRouter = require('./routers/dashboard/template');
      const transcription = require('./routers/api/transcription');
      const mailgen = require('./routers/api/mailgen');
      const pdfsummary = require('./routers/api/pdfsummary');
      const imageGenerator = require('./routers/api/imageGenerator');
      const blogeditor = require('./routers/api/blogeditor');
      const trendautoblog = require('./routers/api/trendautoblog'); // Added for trend auto blog API

      // Make MODE available in all routes
      app.use((req, res, next) => {
        res.locals.MODE = process.env.MODE;
        res.locals.translations = global.translations;
        next();
      });

      app.use('/', index); 
      app.use('/user', user); 
      app.use('/auth', auth); 
      app.use('/payment', payment);
      app.use('/dashboard', dashboard);
      app.use('/enterprise', enterprise);
      app.use('', templateRouter);
      app.use('/api/generator', generator);
      app.use('/api/autoblog', autoblog);
      app.use('/api/transcription', transcription);
      app.use('/api/mailgen', mailgen);
      app.use('/api/pdfsummary', pdfsummary);
      app.use('/api/imageGenerator', imageGenerator);
      app.use('/api/blogeditor', blogeditor);
      app.use('/admin', admin);
      app.use('/api/trendautoblog', trendautoblog); // Added for trend auto blog API


      // Initialize WebSocket server with translations
      setupWebSocketServer(server);

      server.listen(port, () => 
      console.log(`Express running → PORT http://${ip.address()}:${port}`));

    })
    .catch(err => {
      console.log('Error occurred while connecting to MongoDB...\n', err);
    });
}

startServer();
