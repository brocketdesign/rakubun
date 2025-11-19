const { ObjectId } = require('mongodb');
const crypto = require('crypto');

/**
 * Base ProviderConfig Class
 * Provides common functionality for all AI provider configurations
 */
class ProviderConfig {
  constructor(configData) {
    this.site_id = configData.site_id || null; // null for global config
    this.provider = configData.provider; // 'openai', 'novita', etc.
    this.api_key_encrypted = configData.api_key_encrypted;
    this.model_article = configData.model_article;
    this.model_image = configData.model_image;
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

  /**
   * Provider definitions with their supported models
   */
  static get PROVIDERS() {
    return {
      openai: {
        name: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        description: 'State-of-the-art AI models including GPT-4 and DALL-E 3',
        models: {
          article: [
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
          ],
          image: [
            { value: 'dall-e-3', label: 'DALL-E 3' },
            { value: 'dall-e-2', label: 'DALL-E 2' }
          ]
        },
        default_models: {
          article: 'gpt-4',
          image: 'dall-e-3'
        },
        supports_images: true,
        supports_chat: true
      },
      novita: {
        name: 'Novita AI',
        base_url: 'https://api.novita.ai/openai/v1',
        description: 'Cost-effective alternative with diverse model options including DeepSeek',
        models: {
          article: [
            { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
            { value: 'deepseek/deepseek-v2.5', label: 'DeepSeek V2.5' },
            { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
            { value: 'meta-llama/llama-2-7b-chat', label: 'Llama 2 7B Chat' },
            { value: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B' }
          ],
          image: [
            { value: 'dall-e-3', label: 'DALL-E 3' }
          ]
        },
        default_models: {
          article: 'deepseek/deepseek-r1',
          image: 'dall-e-3'
        },
        supports_images: true,
        supports_chat: true
      }
    };
  }

  /**
   * Create a new provider configuration
   */
  static async create(configData) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    // Encrypt API key if provided
    if (configData.api_key) {
      configData.api_key_encrypted = this.encryptApiKey(configData.api_key);
      delete configData.api_key;
    }
    
    const config = new ProviderConfig(configData);
    const result = await collection.insertOne(config);
    return { ...config, _id: result.insertedId };
  }

  /**
   * Find global configuration for a provider
   */
  static async findGlobalConfig(provider = null) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    const query = { 
      site_id: null, 
      is_active: true 
    };
    
    if (provider) {
      query.provider = provider;
    }
    
    return await collection.findOne(query);
  }

  /**
   * Find site-specific configuration for a provider
   */
  static async findBySiteId(siteId, provider = null) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    const query = { 
      site_id: new ObjectId(siteId), 
      is_active: true 
    };
    
    if (provider) {
      query.provider = provider;
    }
    
    return await collection.findOne(query);
  }

  /**
   * Get configuration for a site and provider
   * Falls back to global config if site-specific doesn't exist
   */
  static async getConfigForSite(siteId = null, provider = null) {
    let config = null;
    
    if (siteId) {
      config = await this.findBySiteId(siteId, provider);
    }
    
    if (!config) {
      config = await this.findGlobalConfig(provider);
    }
    
    if (config && config.api_key_encrypted) {
      config.api_key = this.decryptApiKey(config.api_key_encrypted);
      delete config.api_key_encrypted;
    }
    
    return config;
  }

  /**
   * Get all active providers for a site
   */
  static async getAllProvidersForSite(siteId = null) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    const query = { is_active: true };
    if (siteId) {
      query.site_id = new ObjectId(siteId);
    } else {
      query.site_id = null;
    }
    
    const configs = await collection.find(query).toArray();
    
    return configs.map(config => {
      const { api_key_encrypted, ...configWithoutKey } = config;
      configWithoutKey.has_api_key = !!api_key_encrypted;
      return configWithoutKey;
    });
  }

  /**
   * Update global configuration
   */
  static async updateGlobalConfig(provider, updateData) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    if (updateData.api_key) {
      updateData.api_key_encrypted = this.encryptApiKey(updateData.api_key);
      delete updateData.api_key;
    }
    
    updateData.updated_at = new Date();
    updateData.provider = provider;
    
    const result = await collection.updateOne(
      { site_id: null, provider, is_active: true },
      { $set: updateData },
      { upsert: true }
    );
    
    return result;
  }

  /**
   * Update site-specific configuration
   */
  static async updateSiteConfig(siteId, provider, updateData) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    if (updateData.api_key) {
      updateData.api_key_encrypted = this.encryptApiKey(updateData.api_key);
      delete updateData.api_key;
    }
    
    updateData.updated_at = new Date();
    updateData.provider = provider;
    
    const result = await collection.updateOne(
      { site_id: new ObjectId(siteId), provider, is_active: true },
      { $set: updateData },
      { upsert: true }
    );
    
    return result;
  }

  /**
   * Delete a provider configuration
   */
  static async deleteConfig(siteId, provider) {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    const query = { provider, is_active: true };
    if (siteId) {
      query.site_id = new ObjectId(siteId);
    } else {
      query.site_id = null;
    }
    
    return await collection.updateOne(
      query,
      { $set: { is_active: false, updated_at: new Date() } }
    );
  }

  /**
   * Get all configurations with site information
   */
  static async getAllConfigs() {
    const db = global.db;
    const collection = db.collection('provider_config');
    
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
    
    return configs.map(config => {
      const { api_key_encrypted, ...configWithoutKey } = config;
      configWithoutKey.has_api_key = !!api_key_encrypted;
      return configWithoutKey;
    });
  }

  /**
   * Get provider information
   */
  static getProviderInfo(provider) {
    return this.PROVIDERS[provider] || null;
  }

  /**
   * Get all provider options for UI
   */
  static getAllProviderOptions() {
    return Object.entries(this.PROVIDERS).map(([key, value]) => ({
      value: key,
      label: value.name,
      description: value.description,
      supports_images: value.supports_images,
      supports_chat: value.supports_chat
    }));
  }

  /**
   * Get model options for a provider and type
   */
  static getModelOptions(provider, type = 'article') {
    const providerInfo = this.PROVIDERS[provider];
    if (!providerInfo) {
      return [];
    }
    
    return providerInfo.models[type] || [];
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(provider, type = 'article') {
    const providerInfo = this.PROVIDERS[provider];
    if (!providerInfo) {
      return null;
    }
    
    return providerInfo.default_models[type] || null;
  }

  /**
   * Seed default configurations for all providers
   */
  static async seedDefaultConfigs() {
    const db = global.db;
    const collection = db.collection('provider_config');
    
    for (const [key, providerInfo] of Object.entries(this.PROVIDERS)) {
      const existingConfig = await collection.findOne({ 
        site_id: null, 
        provider: key 
      });
      
      if (!existingConfig) {
        const defaultConfig = {
          site_id: null,
          provider: key,
          api_key_encrypted: this.encryptApiKey(process.env[`${key.toUpperCase()}_API_KEY`] || ''),
          model_article: providerInfo.default_models.article,
          model_image: providerInfo.default_models.image,
          max_tokens: 2000,
          temperature: 0.7,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        await collection.insertOne(new ProviderConfig(defaultConfig));
        console.log(`Seeded default config for provider: ${key}`);
      }
    }
  }
}

module.exports = ProviderConfig;
