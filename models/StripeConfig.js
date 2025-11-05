const { ObjectId } = require('mongodb');

class StripeConfig {
  constructor(configData) {
    this.publishable_key = configData.publishable_key;
    this.secret_key = configData.secret_key;
    this.webhook_secret = configData.webhook_secret;
    this.default_currency = configData.default_currency || 'jpy';
    this.mode = configData.mode || 'test'; // 'test' or 'live'
    this.fee_percentage = configData.fee_percentage || 0;
    this.updated_at = new Date();
    this.updated_by = configData.updated_by;
  }

  static async getConfig() {
    const db = global.db;
    const collection = db.collection('stripe_configs');
    
    // Get the most recent config (singleton pattern)
    return await collection.findOne({}, { sort: { updated_at: -1 } });
  }

  static async updateConfig(configData) {
    const db = global.db;
    const collection = db.collection('stripe_configs');
    
    const config = new StripeConfig(configData);
    
    // Delete old configs and insert new one (singleton pattern)
    await collection.deleteMany({});
    const result = await collection.insertOne(config);
    
    return { ...config, _id: result.insertedId };
  }

  static async verifyConnection(publishableKey, secretKey) {
    try {
      const stripe = require('stripe')(secretKey);
      
      // Try to retrieve account info to verify credentials
      const account = await stripe.account.retrieve();
      
      return {
        success: true,
        account_id: account.id,
        account_email: account.email,
        country: account.country
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getWebhooks(secretKey) {
    try {
      const stripe = require('stripe')(secretKey);
      
      // Get all webhook endpoints
      const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
      
      return {
        success: true,
        webhooks: webhooks.data.map(webhook => ({
          id: webhook.id,
          url: webhook.url,
          events: webhook.enabled_events,
          enabled: webhook.enabled_events && webhook.enabled_events.length > 0,
          created_at: new Date(webhook.created * 1000).toISOString()
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async createWebhook(secretKey, webhookUrl, events) {
    try {
      const stripe = require('stripe')(secretKey);
      
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: events
      });
      
      return {
        success: true,
        webhook_id: webhook.id,
        secret: webhook.secret,
        url: webhook.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async validateKeys(publishableKey, secretKey) {
    // Basic validation
    if (!publishableKey || !publishableKey.startsWith('pk_')) {
      return {
        valid: false,
        error: 'Invalid publishable key format (should start with pk_)'
      };
    }
    
    if (!secretKey || !secretKey.startsWith('sk_')) {
      return {
        valid: false,
        error: 'Invalid secret key format (should start with sk_)'
      };
    }
    
    return { valid: true };
  }
}

module.exports = StripeConfig;
