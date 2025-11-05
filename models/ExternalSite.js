const { ObjectId } = require('mongodb');

class Site {
  constructor(siteData) {
    this.instance_id = siteData.instance_id;
    this.api_token = siteData.api_token;
    this.webhook_secret = siteData.webhook_secret;
    this.site_url = siteData.site_url;
    this.site_title = siteData.site_title;
    this.admin_email = siteData.admin_email;
    this.wordpress_version = siteData.wordpress_version;
    this.plugin_version = siteData.plugin_version;
    this.php_version = siteData.php_version;
    this.theme = siteData.theme;
    this.timezone = siteData.timezone;
    this.language = siteData.language;
    this.post_count = siteData.post_count || 0;
    this.page_count = siteData.page_count || 0;
    this.media_count = siteData.media_count || 0;
    this.article_generations = siteData.article_generations || 0;
    this.image_generations = siteData.image_generations || 0;
    this.status = siteData.status || 'active';
    this.registered_at = siteData.registered_at || new Date();
    this.last_activity = siteData.last_activity;
    this.last_sync = siteData.last_sync;
    this.activation_date = siteData.activation_date;
  }

  static async create(siteData) {
    const db = global.db;
    const collection = db.collection('external_sites');
    
    // Generate API token (256+ bits)
    const crypto = require('crypto');
    siteData.api_token = crypto.randomBytes(32).toString('hex');
    
    // Generate webhook secret for HMAC-SHA256 signing
    siteData.webhook_secret = crypto.randomBytes(32).toString('hex');
    
    const site = new Site(siteData);
    const result = await collection.insertOne(site);
    return { ...site, _id: result.insertedId };
  }

  static async findByInstanceId(instanceId) {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.findOne({ instance_id: instanceId });
  }

  static async findByApiToken(apiToken) {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.findOne({ api_token: apiToken });
  }

  static async findById(id) {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async findAll() {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.find({}).sort({ registered_at: -1 }).toArray();
  }

  static async updateById(id, updateData) {
    const db = global.db;
    const collection = db.collection('external_sites');
    updateData.last_sync = new Date();
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
  }

  static async updateActivity(instanceId) {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.updateOne(
      { instance_id: instanceId },
      { $set: { last_activity: new Date() } }
    );
  }

  static async deleteById(id) {
    const db = global.db;
    const collection = db.collection('external_sites');
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'inactive' } }
    );
  }
}

module.exports = Site;