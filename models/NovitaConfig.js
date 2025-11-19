const ProviderConfig = require('./ProviderConfig');

/**
 * NovitaConfig Class
 * Extends ProviderConfig for Novita AI provider
 * Provides Novita-specific functionality and defaults
 */
class NovitaConfig extends ProviderConfig {
  constructor(configData) {
    // Set default provider if not specified
    if (!configData.provider) {
      configData.provider = 'novita';
    }
    
    // Set Novita-specific defaults
    if (!configData.model_article) {
      configData.model_article = 'deepseek/deepseek-r1';
    }
    
    if (!configData.model_image) {
      configData.model_image = 'dall-e-3';
    }
    
    super(configData);
  }

  /**
   * Create a new Novita configuration
   */
  static async create(configData) {
    configData.provider = 'novita';
    return await ProviderConfig.create(configData);
  }

  /**
   * Get global Novita configuration
   */
  static async findGlobalConfig() {
    return await ProviderConfig.findGlobalConfig('novita');
  }

  /**
   * Get site-specific Novita configuration
   */
  static async findBySiteId(siteId) {
    return await ProviderConfig.findBySiteId(siteId, 'novita');
  }

  /**
   * Get configuration for site (with fallback to global)
   */
  static async getConfigForSite(siteId = null) {
    return await ProviderConfig.getConfigForSite(siteId, 'novita');
  }

  /**
   * Update global Novita configuration
   */
  static async updateGlobalConfig(updateData) {
    return await ProviderConfig.updateGlobalConfig('novita', updateData);
  }

  /**
   * Update site-specific Novita configuration
   */
  static async updateSiteConfig(siteId, updateData) {
    return await ProviderConfig.updateSiteConfig(siteId, 'novita', updateData);
  }

  /**
   * Get Novita provider information
   */
  static getProviderInfo() {
    return ProviderConfig.getProviderInfo('novita');
  }

  /**
   * Get available article models for Novita
   */
  static getArticleModels() {
    return ProviderConfig.getModelOptions('novita', 'article');
  }

  /**
   * Get available image models for Novita
   */
  static getImageModels() {
    return ProviderConfig.getModelOptions('novita', 'image');
  }

  /**
   * Get default article model for Novita
   */
  static getDefaultArticleModel() {
    return ProviderConfig.getDefaultModel('novita', 'article');
  }

  /**
   * Get default image model for Novita
   */
  static getDefaultImageModel() {
    return ProviderConfig.getDefaultModel('novita', 'image');
  }

  /**
   * Validate Novita configuration
   */
  static validateConfig(config) {
    const errors = [];
    
    if (!config.api_key || config.api_key.trim() === '') {
      errors.push('API key is required');
    }
    
    if (!config.model_article || config.model_article.trim() === '') {
      errors.push('Article model is required');
    }
    
    if (!config.model_image || config.model_image.trim() === '') {
      errors.push('Image model is required');
    }
    
    if (config.max_tokens && (config.max_tokens < 100 || config.max_tokens > 8000)) {
      errors.push('Max tokens must be between 100 and 8000');
    }
    
    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = NovitaConfig;
