const { MongoClient } = require('mongodb');
const url = 'mongodb+srv://rakubun_admin:2oiH4JrX8RGJxEjO@cluster2.jyuma8a.mongodb.net/?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db('rakubun');

  const collections = await db.listCollections().toArray();
  console.log('COLLECTIONS:', collections.map(c => c.name).join(', '));

  const cronArticles = await db.collection('articles').find({ cronGenerated: true }).sort({ createdAt: -1 }).limit(3).toArray();
  console.log('\nCRON ARTICLES:');
  for (const a of cronArticles) {
    console.log(' -', a._id.toString(), '|', (a.title||'').substring(0,60), '|', a.status, '|', a.createdAt);
  }

  const planArticles = await db.collection('articles').find({ schedulePlanGenerated: true }).sort({ createdAt: -1 }).limit(3).toArray();
  console.log('\nPLAN ARTICLES:');
  for (const a of planArticles) {
    console.log(' -', a._id.toString(), '|', (a.title||'').substring(0,60), '|', a.status, '|', a.createdAt);
  }

  const notifs = await db.collection('notifications').find({}).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('\nNOTIFICATIONS:', notifs.length, 'found');
  for (const n of notifs) {
    console.log(' -', n.type, '|', (n.title && n.title.en) || 'no-title', '|', new Date(n.createdAt).toISOString());
  }

  const notifSettings = await db.collection('notification_settings').find({}).toArray();
  console.log('\nNOTIFICATION_SETTINGS:', notifSettings.length, 'found');
  for (const s of notifSettings) {
    console.log(' -', s.userId, '| primary:', s.primaryEmail, '| additional:', s.additionalEmail, '| enabled:', s.emailEnabled);
  }

  await client.close();
}

run().catch(console.error);
