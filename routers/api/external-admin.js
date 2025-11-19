const express = require('express');
const router = express.Router();
const ExternalSite = require('../../models/ExternalSite');
const ExternalUser = require('../../models/ExternalUser');
const CreditPackage = require('../../models/CreditPackage');
const CreditTransaction = require('../../models/CreditTransaction');
const GenerationLog = require('../../models/GenerationLog');
const OpenAIConfig = require('../../models/OpenAIConfig');
const StripeConfig = require('../../models/StripeConfig');
const { authenticateAdmin } = require('../../middleware/externalApiMiddleware');
const ensureAuthenticated = require('../../middleware/authMiddleware');

// Apply authentication to all admin routes
router.use(ensureAuthenticated);
router.use(authenticateAdmin);

/**
 * Dashboard Overview Stats
 * GET /api/v1/admin/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const db = global.db;
    
    const stats = await Promise.all([
      // Total sites
      db.collection('external_sites').countDocuments({ status: 'active' }),
      
      // Total users
      db.collection('external_users').countDocuments(),
      
      // Total generations today
      db.collection('generation_logs').countDocuments({
        created_at: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        },
        status: 'success'
      }),
      
      // Total credits used today
      db.collection('generation_logs').aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0))
            },
            status: 'success'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$credits_used' }
          }
        }
      ]).toArray(),
      
      // Recent activity
      GenerationLog.getRecentGenerations(10),
      
      // Top sites by usage
      db.collection('generation_logs').aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            },
            status: 'success'
          }
        },
        {
          $group: {
            _id: '$site_id',
            total_generations: { $sum: 1 },
            total_credits: { $sum: '$credits_used' }
          }
        },
        {
          $lookup: {
            from: 'external_sites',
            localField: '_id',
            foreignField: '_id',
            as: 'site'
          }
        },
        {
          $unwind: '$site'
        },
        {
          $sort: { total_generations: -1 }
        },
        {
          $limit: 5
        }
      ]).toArray()
    ]);

    res.json({
      success: true,
      stats: {
        total_sites: stats[0],
        total_users: stats[1],
        generations_today: stats[2],
        credits_used_today: stats[3][0]?.total || 0,
        recent_activity: stats[4],
        top_sites: stats[5]
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get All Sites
 * GET /api/v1/admin/sites
 */
router.get('/sites', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { site_title: { $regex: search, $options: 'i' } },
        { site_url: { $regex: search, $options: 'i' } },
        { admin_email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      query.status = status;
    }

    const db = global.db;
    const sites = await db.collection('external_sites')
      .find(query)
      .sort({ registered_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('external_sites').countDocuments(query);

    // Get user counts for each site
    const siteIds = sites.map(site => site._id);
    const userCounts = await db.collection('external_users').aggregate([
      { $match: { site_id: { $in: siteIds } } },
      { $group: { _id: '$site_id', count: { $sum: 1 } } }
    ]).toArray();

    const userCountMap = {};
    userCounts.forEach(uc => {
      userCountMap[uc._id.toString()] = uc.count;
    });

    // Add user counts to sites
    const sitesWithCounts = sites.map(site => ({
      ...site,
      user_count: userCountMap[site._id.toString()] || 0
    }));

    res.json({
      success: true,
      sites: sitesWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Site Details
 * GET /api/v1/admin/sites/:id
 */
router.get('/sites/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const siteId = new ObjectId(req.params.id);

    const site = await ExternalSite.findById(req.params.id);
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    // Get users for this site
    const users = await ExternalUser.findBySiteId(siteId);

    // Get recent generations
    const recentGenerations = await GenerationLog.findBySiteId(siteId, 20);

    // Get site stats
    const stats = await GenerationLog.getGenerationStats(siteId);

    res.json({
      success: true,
      site,
      users,
      recent_generations: recentGenerations,
      stats
    });

  } catch (error) {
    console.error('Get site details error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Site
 * PUT /api/v1/admin/sites/:id
 */
router.put('/sites/:id', async (req, res) => {
  try {
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.api_token;
    delete updateData.instance_id;

    await ExternalSite.updateById(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Site updated successfully'
    });

  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete/Deactivate Site
 * DELETE /api/v1/admin/sites/:id
 */
router.delete('/sites/:id', async (req, res) => {
  try {
    await ExternalSite.deleteById(req.params.id);

    res.json({
      success: true,
      message: 'Site deactivated successfully'
    });

  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get All Users
 * GET /api/v1/admin/users
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', site_id = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.user_email = { $regex: search, $options: 'i' };
    }
    if (site_id) {
      const { ObjectId } = require('mongodb');
      query.site_id = new ObjectId(site_id);
    }

    const db = global.db;
    const users = await db.collection('external_users').aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'external_sites',
          localField: 'site_id',
          foreignField: '_id',
          as: 'site'
        }
      },
      {
        $unwind: '$site'
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: parseInt(limit)
      }
    ]).toArray();

    const total = await db.collection('external_users').countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update User Credits
 * PUT /api/v1/admin/users/:site_id/:user_id/credits
 */
router.put('/users/:site_id/:user_id/credits', async (req, res) => {
  try {
    const { site_id, user_id } = req.params;
    const { credit_type, amount, operation } = req.body; // operation: 'add' or 'set'

    if (!['article', 'image', 'rewrite'].includes(credit_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit_type'
      });
    }

    if (!['add', 'set'].includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid operation. Must be "add" or "set"'
      });
    }

    const user = await ExternalUser.findBySiteAndUserId(site_id, parseInt(user_id));
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let newBalance;
    if (operation === 'add') {
      await ExternalUser.addCredits(site_id, parseInt(user_id), credit_type, amount);
      newBalance = user[`${credit_type}_credits`] + amount;
    } else {
      const updateData = {};
      updateData[`${credit_type}_credits`] = amount;
      await ExternalUser.updateCredits(site_id, parseInt(user_id), credit_type, amount);
      newBalance = amount;
    }

    // Log transaction
    await CreditTransaction.logBonus(
      site_id,
      parseInt(user_id),
      credit_type,
      operation === 'add' ? amount : amount - user[`${credit_type}_credits`],
      newBalance,
      `Admin ${operation}: ${amount} credits`
    );

    res.json({
      success: true,
      message: 'Credits updated successfully',
      new_balance: newBalance
    });

  } catch (error) {
    console.error('Update user credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Credit Packages
 * GET /api/v1/admin/packages
 */
router.get('/packages', async (req, res) => {
  try {
    const packages = await CreditPackage.findAll();

    res.json({
      success: true,
      packages
    });

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Single Package by ID
 * GET /api/v1/admin/packages/:id
 */
router.get('/packages/:id', async (req, res) => {
  try {
    const pkg = await CreditPackage.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    res.json({
      success: true,
      package: pkg
    });

  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create Package
 * POST /api/v1/admin/packages
 */
router.post('/packages', async (req, res) => {
  try {
    const packageData = req.body;

    if (!packageData.package_id || !packageData.name || !packageData.credit_type || !packageData.credits || !packageData.price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const packageObj = await CreditPackage.create(packageData);

    res.json({
      success: true,
      package: packageObj
    });

  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Package
 * PUT /api/v1/admin/packages/:id
 */
router.put('/packages/:id', async (req, res) => {
  try {
    const updateData = req.body;
    delete updateData._id;

    await CreditPackage.updateById(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Package updated successfully'
    });

  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete Package
 * DELETE /api/v1/admin/packages/:id
 */
router.delete('/packages/:id', async (req, res) => {
  try {
    await CreditPackage.deleteById(req.params.id);

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get OpenAI Configurations
 * GET /api/v1/admin/config/openai
 */
router.get('/config/openai', async (req, res) => {
  try {
    const configs = await OpenAIConfig.getAllConfigs();

    res.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('Get OpenAI configs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Global OpenAI Configuration
 * PUT /api/v1/admin/config/openai/global
 */
router.put('/config/openai/global', async (req, res) => {
  try {
    const updateData = req.body;
    
    await OpenAIConfig.updateGlobalConfig(updateData);

    res.json({
      success: true,
      message: 'Global OpenAI configuration updated successfully'
    });

  } catch (error) {
    console.error('Update global OpenAI config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Stripe Configuration
 * GET /api/v1/admin/config/stripe
 */
router.get('/config/stripe', async (req, res) => {
  try {
    const config = await StripeConfig.getConfig();
    
    if (!config) {
      return res.json({
        success: true,
        config: {
          publishable_key: '',
          secret_key: '',
          webhook_secret: '',
          default_currency: 'jpy',
          mode: 'test',
          fee_percentage: 0
        }
      });
    }

    // Don't return full secret keys for security (show masked)
    res.json({
      success: true,
      config: {
        publishable_key: config.publishable_key ? config.publishable_key.substring(0, 20) + '...' : '',
        publishable_key_full: config.publishable_key || '',
        secret_key: config.secret_key ? '••••••••' + config.secret_key.slice(-4) : '',
        webhook_secret: config.webhook_secret ? '••••••••' + config.webhook_secret.slice(-4) : '',
        default_currency: config.default_currency,
        mode: config.mode,
        fee_percentage: config.fee_percentage,
        updated_at: config.updated_at
      }
    });

  } catch (error) {
    console.error('Get Stripe config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Stripe Configuration
 * PUT /api/v1/admin/config/stripe
 */
router.put('/config/stripe', async (req, res) => {
  try {
    const { publishable_key, secret_key, webhook_secret, default_currency, mode, fee_percentage } = req.body;

    // Validate required fields
    if (!publishable_key || !secret_key || !webhook_secret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: publishable_key, secret_key, webhook_secret'
      });
    }

    // Validate key formats
    const validation = await StripeConfig.validateKeys(publishable_key, secret_key);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Update configuration
    const configData = {
      publishable_key,
      secret_key,
      webhook_secret,
      default_currency: default_currency || 'jpy',
      mode: mode || 'test',
      fee_percentage: fee_percentage || 0,
      updated_by: req.user.email
    };

    const updatedConfig = await StripeConfig.updateConfig(configData);

    res.json({
      success: true,
      message: 'Stripe configuration updated successfully',
      config: {
        publishable_key: updatedConfig.publishable_key.substring(0, 20) + '...',
        default_currency: updatedConfig.default_currency,
        mode: updatedConfig.mode,
        fee_percentage: updatedConfig.fee_percentage
      }
    });

  } catch (error) {
    console.error('Update Stripe config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Test Stripe Connection
 * POST /api/v1/admin/config/stripe/test
 */
router.post('/config/stripe/test', async (req, res) => {
  try {
    const config = await StripeConfig.getConfig();

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Stripe configuration not found'
      });
    }

    const result = await StripeConfig.verifyConnection(
      config.publishable_key,
      config.secret_key
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Stripe connection successful',
        account: {
          id: result.account_id,
          email: result.account_email,
          country: result.country
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Test Stripe connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Stripe Webhooks
 * GET /api/v1/admin/config/stripe/webhooks
 */
router.get('/config/stripe/webhooks', async (req, res) => {
  try {
    const config = await StripeConfig.getConfig();

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Stripe configuration not found'
      });
    }

    const result = await StripeConfig.getWebhooks(config.secret_key);

    res.json(result);

  } catch (error) {
    console.error('Get webhooks error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create Stripe Webhook
 * POST /api/v1/admin/config/stripe/webhooks
 */
router.post('/config/stripe/webhooks', async (req, res) => {
  try {
    const { webhook_url, events } = req.body;

    if (!webhook_url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: webhook_url, events (array)'
      });
    }

    const config = await StripeConfig.getConfig();
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Stripe configuration not found'
      });
    }

    const result = await StripeConfig.createWebhook(
      config.secret_key,
      webhook_url,
      events
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook created successfully',
        webhook: {
          id: result.webhook_id,
          secret: result.secret,
          url: result.url
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Create webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Provider Configuration (Admin)
 * GET /api/v1/admin/config/provider?provider=openai
 * Returns configuration for specified provider, or currently active if not specified
 */
router.get('/config/provider', async (req, res) => {
  try {
    const ProviderConfig = require('../../models/ProviderConfig');
    const requestedProvider = req.query.provider;
    let config;

    if (requestedProvider) {
      config = await ProviderConfig.getConfigForSite(null, requestedProvider);
    } else {
      config = await ProviderConfig.getConfigForSite(null);
    }
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Provider configuration not found'
      });
    }

    const providerInfo = ProviderConfig.getProviderInfo(config.provider);
    
    res.json({
      success: true,
      provider: config.provider,
      provider_name: providerInfo?.name || 'Unknown',
      api_key: config.api_key,
      model_article: config.model_article,
      model_image: config.model_image,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      base_url: providerInfo?.base_url
    });

  } catch (error) {
    console.error('Get provider config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Provider Configuration (Admin)
 * PUT /api/v1/admin/config/provider
 * Updates the active provider configuration globally
 */
router.put('/config/provider', async (req, res) => {
  try {
    const ProviderConfig = require('../../models/ProviderConfig');
    const {
      provider,
      api_key,
      model_article,
      model_image,
      max_tokens,
      temperature
    } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
    }

    if (!ProviderConfig.getProviderInfo(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider'
      });
    }

    const updateData = {
      provider,
      ...(api_key && { api_key }),
      ...(model_article && { model_article }),
      ...(model_image && { model_image }),
      ...(max_tokens && { max_tokens }),
      ...(temperature !== undefined && { temperature })
    };

    // Basic validation
    const providerInfo = ProviderConfig.getProviderInfo(provider);
    if (!providerInfo) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider'
      });
    }

    if (api_key && api_key.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'API key is invalid or too short'
      });
    }

    // Update global config (no site_id for admin update)
    await ProviderConfig.updateGlobalConfig(provider, updateData);

    res.json({
      success: true,
      message: 'Provider configuration updated successfully',
      provider: provider,
      provider_name: ProviderConfig.getProviderInfo(provider).name
    });

  } catch (error) {
    console.error('Update provider config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get All Available Providers (Admin)
 * GET /api/v1/admin/config/providers
 * Returns list of all available providers and their configurations
 */
router.get('/config/providers', async (req, res) => {
  try {
    const ProviderConfig = require('../../models/ProviderConfig');
    const providers = ProviderConfig.getAllProviderOptions();
    const activeConfig = await ProviderConfig.findGlobalConfig();
    
    res.json({
      success: true,
      all_providers: providers,
      active_providers: providers.filter(p => p.provider === activeConfig?.provider),
      current_provider: activeConfig?.provider || 'openai',
      message: 'Returns available providers and active configuration'
    });

  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Test Article Generation (Admin)
 * POST /api/v1/admin/config/test/article
 */
router.post('/config/test/article', async (req, res) => {
  try {
    const ProviderConfig = require('../../models/ProviderConfig');
    const requestedProvider = req.query.provider;
    
    // Get configuration
    let config;
    if (requestedProvider) {
      config = await ProviderConfig.getConfigForSite(null, requestedProvider);
    } else {
      config = await ProviderConfig.getConfigForSite(null);
    }

    if (!config || !config.api_key) {
      return res.status(400).json({
        success: false,
        error: 'Provider configuration not found or API key not set'
      });
    }

    // Get provider info
    const providerInfo = ProviderConfig.getProviderInfo(config.provider);
    const openaiModule = require('../../modules/openai');

    // Test article generation using generateCompletion
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Write a short test article about AI in 50 words.' }
    ];
    
    const result = await openaiModule.generateCompletion(messages, config.max_tokens);

    if (result) {
      res.json({
        success: true,
        message: 'Article generation test successful',
        model: config.model_article,
        provider: config.provider,
        test_result: result.substring(0, 200) + '...'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Article generation test failed'
      });
    }

  } catch (error) {
    console.error('Test article generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Article generation test failed: ' + error.message
    });
  }
});

/**
 * Test Image Generation (Admin)
 * POST /api/v1/admin/config/test/image
 */
router.post('/config/test/image', async (req, res) => {
  try {
    const ProviderConfig = require('../../models/ProviderConfig');
    const requestedProvider = req.query.provider;
    
    // Get configuration
    let config;
    if (requestedProvider) {
      config = await ProviderConfig.getConfigForSite(null, requestedProvider);
    } else {
      config = await ProviderConfig.getConfigForSite(null);
    }

    if (!config || !config.api_key) {
      return res.status(400).json({
        success: false,
        error: 'Provider configuration not found or API key not set'
      });
    }

    // Get provider info
    const providerInfo = ProviderConfig.getProviderInfo(config.provider);
    
    // Check if sdapi module exists
    let sdapiModule;
    try {
      sdapiModule = require('../../modules/sdapi');
    } catch (moduleError) {
      return res.status(500).json({
        success: false,
        error: 'Image generation module not available'
      });
    }

    // Test image generation
    const result = await sdapiModule.generateImage(
      'Test image generation',
      config
    );

    if (result && result.success) {
      res.json({
        success: true,
        message: 'Image generation test successful',
        model: config.model_image,
        provider: config.provider,
        url: result.url || 'Image generated'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result?.error || 'Image generation test failed'
      });
    }

  } catch (error) {
    console.error('Test image generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Image generation test failed: ' + error.message
    });
  }
});

module.exports = router;