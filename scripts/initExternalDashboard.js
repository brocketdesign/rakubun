const { MongoClient } = require('mongodb');
const CreditPackage = require('./models/CreditPackage');
const OpenAIConfig = require('./models/OpenAIConfig');

// Load environment variables
require('dotenv').config();

async function initializeExternalDashboard() {
  const url = process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DATABASE;

  try {
    const client = await MongoClient.connect(url, { useUnifiedTopology: true });
    const db = client.db(dbName);
    global.db = db;

    console.log('Connected to MongoDB...');
    console.log('Initializing External Dashboard data...');

    // Seed credit packages
    console.log('Seeding credit packages...');
    await CreditPackage.seedDefaultPackages();
    console.log('✓ Credit packages seeded');

    // Seed OpenAI configuration
    console.log('Seeding OpenAI configuration...');
    await OpenAIConfig.seedDefaultConfig();
    console.log('✓ OpenAI configuration seeded');

    console.log('✓ External Dashboard initialization complete!');
    console.log('\nTo access the external dashboard:');
    console.log('1. Login as an admin user');
    console.log('2. Go to /dashboard/external');
    console.log('\nAPI endpoints available at:');
    console.log('- WordPress Plugin API: /api/v1/*');
    console.log('- Admin API: /api/v1/admin/*');

    await client.close();
  } catch (error) {
    console.error('Error initializing external dashboard:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeExternalDashboard();
}

module.exports = initializeExternalDashboard;