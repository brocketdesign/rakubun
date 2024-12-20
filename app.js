require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const compression = require('compression');
const http = require('http');
const LocalStrategy = require('passport-local').Strategy;
const { MongoClient, ObjectId } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);

const { initializeCronJobs } = require('./modules/cronJobs-bot.js');
const { updateAllFavicons } = require('./services/tools.js')
const passport = require("passport");
const passportConfig = require('./middleware/passport')(passport);
const path = require('path'); // Add path module
const ip = require('ip');
const app = express();
const mongoose = require('mongoose');
const server = http.createServer(app);
const cors = require('cors');
const port = process.env.PORT || 3000;

const url = process.env.MONGODB_URL; // Use MONGODB_URL from .env file
const dbName = process.env.MONGODB_DATABASE; // Use MONGODB_DATABASE from .env file

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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

      app.use(compression());
      app.use(flash());
      app.use((req, res, next) => {
        res.locals.messages = req.flash();
        next();
      });
      app.use((req, res, next) => {
        if (process.env.NODE_ENV !== 'local' && req.header('x-forwarded-proto') !== 'https') {
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



      server.listen(port, () => 
      console.log(`Express running → PORT http://${ip.address()}:${port}`));

    })
    .catch(err => {
      console.log('Error occurred while connecting to MongoDB...\n', err);
    });
}

startServer();
