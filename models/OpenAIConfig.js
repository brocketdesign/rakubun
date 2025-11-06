const { ObjectId } = require('mongodb');
const crypto = require('crypto');

class OpenAIConfig {
  constructor(configData) {
    this.site_id = configData.site_id || null; // null for global config
    this.api_key_encrypted = configData.api_key_encrypted;
    this.model_article = configData.model_article || 'gpt-4';
    this.model_image = configData.model_image || 'dall-e-3';
    this.max_tokens = configData.max_tokens || 2000;
    this.temperature = configData.temperature || 0.7;
    this.is_active = configData.is_active !== undefined ? configData.is_active : true;
    this.created_at = configData.created_at || new Date();
    this.updated_at = configData.updated_at || new Date();
  }

  static getEncryptionKey() {
    return process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this';
  }

  static encryptApiKey(apiKey) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  static decryptApiKey(encryptedApiKey) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.getEncryptionKey(), 'salt', 32);
      
      const parts = encryptedApiKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting API key:', error);
      return null;
    }
  }

  static async create(configData) {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    // Encrypt API key if provided
    if (configData.api_key) {
      configData.api_key_encrypted = this.encryptApiKey(configData.api_key);
      delete configData.api_key;
    }
    
    const config = new OpenAIConfig(configData);
    const result = await collection.insertOne(config);
    return { ...config, _id: result.insertedId };
  }

  static async findGlobalConfig() {
    const db = global.db;
    const collection = db.collection('openai_config');
    return await collection.findOne({ 
      site_id: null, 
      is_active: true 
    });
  }

  static async findBySiteId(siteId) {
    const db = global.db;
    const collection = db.collection('openai_config');
    return await collection.findOne({ 
      site_id: new ObjectId(siteId), 
      is_active: true 
    });
  }

  static async getConfigForSite(siteId = null) {
    // First try to get site-specific config
    let config = null;
    if (siteId) {
      config = await this.findBySiteId(siteId);
    }
    
    // If no site-specific config, get global config
    if (!config) {
      config = await this.findGlobalConfig();
    }
    
    if (config && config.api_key_encrypted) {
      // Decrypt API key for use
      config.api_key = this.decryptApiKey(config.api_key_encrypted);
      delete config.api_key_encrypted; // Don't expose encrypted key
    }
    
    return config;
  }

  static async updateGlobalConfig(updateData) {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    // Encrypt API key if provided
    if (updateData.api_key) {
      updateData.api_key_encrypted = this.encryptApiKey(updateData.api_key);
      delete updateData.api_key;
    }
    
    updateData.updated_at = new Date();
    
    const result = await collection.updateOne(
      { site_id: null, is_active: true },
      { $set: updateData },
      { upsert: true }
    );
    
    return result;
  }

  static async updateSiteConfig(siteId, updateData) {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    // Encrypt API key if provided
    if (updateData.api_key) {
      updateData.api_key_encrypted = this.encryptApiKey(updateData.api_key);
      delete updateData.api_key;
    }
    
    updateData.updated_at = new Date();
    
    const result = await collection.updateOne(
      { site_id: new ObjectId(siteId), is_active: true },
      { $set: updateData },
      { upsert: true }
    );
    
    return result;
  }

  static async deleteSiteConfig(siteId) {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    return await collection.updateOne(
      { site_id: new ObjectId(siteId) },
      { $set: { is_active: false, updated_at: new Date() } }
    );
  }

  static async getAllConfigs() {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    const configs = await collection.aggregate([
      {
        $match: { is_active: true }
      },
      {
        $lookup: {
          from: 'external_sites',
          localField: 'site_id',
          foreignField: '_id',
          as: 'site'
        }
      },
      {
        $unwind: { path: '$site', preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { created_at: -1 }
      }
    ]).toArray();
    
    // Don't expose encrypted API keys in list view
    return configs.map(config => {
      const { api_key_encrypted, ...configWithoutKey } = config;
      configWithoutKey.has_api_key = !!api_key_encrypted;
      return configWithoutKey;
    });
  }

  static async seedDefaultConfig() {
    const db = global.db;
    const collection = db.collection('openai_config');
    
    // Check if global config already exists
    const existingConfig = await collection.findOne({ site_id: null });
    if (existingConfig) {
      return; // Config already exists
    }

    // Create default global config
    const defaultConfig = {
      site_id: null,
      api_key_encrypted: this.encryptApiKey(process.env.OPENAI_API_KEY || ''),
      model_article: 'gpt-4',
      model_image: 'dall-e-3',
      max_tokens: 2000,
      temperature: 0.7,
      is_active: true
    };

    await collection.insertOne(new OpenAIConfig(defaultConfig));
  }
}

module.exports = OpenAIConfig;