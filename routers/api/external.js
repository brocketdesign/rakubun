const express = require('express');
const router = express.Router();
const ExternalSite = require('../../models/ExternalSite');
const ExternalUser = require('../../models/ExternalUser');
const CreditPackage = require('../../models/CreditPackage');
const CreditTransaction = require('../../models/CreditTransaction');
const GenerationLog = require('../../models/GenerationLog');
const OpenAIConfig = require('../../models/OpenAIConfig');
const ProviderConfig = require('../../models/ProviderConfig');
const { authenticatePlugin, rateLimit } = require('../../middleware/externalApiMiddleware');

// Apply rate limiting to all external API routes
router.use(rateLimit(100, 1)); // 100 requests per minute

/**
 * Health Check
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * Authentication Diagnostic
 * GET /api/v1/auth/debug
 * Public endpoint to check if headers are being sent correctly
 */
router.get('/auth/debug', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const instanceId = req.headers['x-instance-id'];
    const userAgent = req.headers['user-agent'];

    // Check what headers are present
    const debug = {
      timestamp: new Date().toISOString(),
      headers_received: {
        authorization: authHeader ? {
          present: true,
          starts_with_bearer: authHeader.startsWith('Bearer '),
          token_length: authHeader.substring(7).length,
          token_preview: authHeader.substring(7, 20) + '...'
        } : { present: false },
        'x-instance-id': instanceId ? {
          present: true,
          value: instanceId
        } : { present: false },
        'user-agent': userAgent ? {
          present: true,
          value: userAgent
        } : { present: false }
      },
      all_headers: req.headers
    };

    // Try to verify if token exists (optional logging)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log(`[Debug] Authorization header present, token: ${token.substring(0, 20)}...`);
    }

    res.json({
      success: true,
      debug,
      note: 'This endpoint shows what headers your client is sending. Use this to debug authentication issues.'
    });

  } catch (error) {
    console.error('Auth debug error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Plugin Registration
 * POST /api/v1/plugins/register
 */
router.post('/plugins/register', async (req, res) => {
  try {
    const {
      instance_id,
      site_url,
      site_title,
      admin_email,
      wordpress_version,
      plugin_version,
      php_version,
      theme,
      timezone,
      language,
      post_count,
      page_count,
      media_count,
      article_generations,
      image_generations,
      activation_date,
      last_activity
    } = req.body;

    // Validate required fields
    if (!instance_id || !site_url || !admin_email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: instance_id, site_url, admin_email'
      });
    }

    // Check if site already exists
    const existingSite = await ExternalSite.findByInstanceId(instance_id);
    if (existingSite) {
      return res.status(409).json({
        success: false,
        error: 'Site already registered',
        api_token: existingSite.api_token,
        instance_id: existingSite.instance_id,
        webhook_secret: existingSite.webhook_secret
      });
    }

    // Create new site
    const site = await ExternalSite.create({
      instance_id,
      site_url,
      site_title,
      admin_email,
      wordpress_version,
      plugin_version,
      php_version,
      theme,
      timezone,
      language,
      post_count,
      page_count,
      media_count,
      article_generations,
      image_generations,
      activation_date: activation_date ? new Date(activation_date) : new Date(),
      last_activity: last_activity ? new Date(last_activity) : new Date()
    });

    res.json({
      success: true,
      api_token: site.api_token,
      instance_id: site.instance_id,
      webhook_secret: site.webhook_secret,
      status: 'registered',
      message: 'Plugin registered successfully'
    });

  } catch (error) {
    console.error('Plugin registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get User Credits
 * GET /api/v1/users/credits
 */
router.get('/users/credits', authenticatePlugin, async (req, res) => {
  try {
    const { user_email, user_id, site_url } = req.query;

    if (!user_email || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: user_email, user_id'
      });
    }

    console.log(`[Users/Credits] Request received:`);
    console.log(`  site_id: ${req.site._id}`);
    console.log(`  user_id: ${user_id}`);
    console.log(`  user_email: ${user_email}`);
    console.log(`  site_url: ${site_url}`);

    // Try to find existing user first
    const db = global.db;
    const usersCollection = db.collection('external_users');
    
    const existingUser = await usersCollection.findOne({
      site_id: req.site._id,
      user_id: parseInt(user_id)
    });

    console.log(`[Users/Credits] Searching for user with site_id=${req.site._id} and user_id=${user_id}`);
    if (existingUser) {
      console.log(`[Users/Credits] Found existing user:`, {
        user_id: existingUser.user_id,
        user_email: existingUser.user_email,
        article_credits: existingUser.article_credits,
        image_credits: existingUser.image_credits,
        rewrite_credits: existingUser.rewrite_credits
      });
    } else {
      console.log(`[Users/Credits] No existing user found. Checking all users for this site:`);
      const allUsers = await usersCollection.find({ site_id: req.site._id }).toArray();
      console.log(`[Users/Credits] All users for this site:`, allUsers.map(u => ({
        user_id: u.user_id,
        user_email: u.user_email,
        article_credits: u.article_credits
      })));
    }

    // Get or create user
    const user = await ExternalUser.getOrCreateUser(req.site._id, parseInt(user_id), user_email);

    console.log(`[Users/Credits] Returning user:`, {
      user_id: user.user_id,
      user_email: user.user_email,
      article_credits: user.article_credits,
      image_credits: user.image_credits,
      rewrite_credits: user.rewrite_credits
    });

    res.json({
      success: true,
      credits: {
        article_credits: user.article_credits,
        image_credits: user.image_credits,
        rewrite_credits: user.rewrite_credits
      },
      last_updated: user.updated_at
    });

  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Deduct User Credits
 * POST /api/v1/users/deduct-credits
 */
router.post('/users/deduct-credits', authenticatePlugin, async (req, res) => {
  try {
    const {
      user_email,
      user_id,
      site_url,
      credit_type,
      amount = 1
    } = req.body;

    if (!user_email || !user_id || !credit_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_email, user_id, credit_type'
      });
    }

    if (!['article', 'image', 'rewrite'].includes(credit_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit_type. Must be: article, image, or rewrite'
      });
    }

    // Get or create user
    const user = await ExternalUser.getOrCreateUser(req.site._id, parseInt(user_id), user_email);

    // Deduct credits
    const remainingCredits = await ExternalUser.deductCredits(
      req.site._id,
      parseInt(user_id),
      credit_type,
      amount
    );

    // Log transaction
    const crypto = require('crypto');
    const transactionId = 'txn_' + crypto.randomBytes(8).toString('hex');
    
    await CreditTransaction.logDeduction(
      req.site._id,
      parseInt(user_id),
      credit_type,
      amount,
      remainingCredits[`${credit_type}_credits`]
    );

    res.json({
      success: true,
      remaining_credits: remainingCredits,
      transaction_id: transactionId
    });

  } catch (error) {
    if (error.message === 'Insufficient credits') {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits'
      });
    }

    console.error('Deduct credits error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Provider Configuration
 * GET /api/v1/config/provider?provider=openai
 * Returns configuration for specified provider, or currently active if not specified
 */
router.get('/config/provider', authenticatePlugin, async (req, res) => {
  try {
    const requestedProvider = req.query.provider;
    let config;

    if (requestedProvider) {
      // Get configuration for specific provider
      config = await ProviderConfig.getConfigForSite(req.site._id, requestedProvider);
    } else {
      // Get currently active provider configuration
      config = await ProviderConfig.getConfigForSite(req.site._id);
    }
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No provider configuration found'
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
 * Get OpenAI Configuration (Deprecated)
 * GET /api/v1/config/openai
 * Maintained for backwards compatibility - redirects to provider config
 */
router.get('/config/openai', authenticatePlugin, async (req, res) => {
  try {
    const config = await ProviderConfig.getConfigForSite(req.site._id, 'openai');
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No OpenAI configuration found'
      });
    }

    res.json({
      success: true,
      api_key: config.api_key,
      model_article: config.model_article,
      model_image: config.model_image,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      note: 'This endpoint is deprecated. Use /api/v1/config/provider instead.'
    });

  } catch (error) {
    console.error('Get OpenAI config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get All Available Providers
 * GET /api/v1/config/providers
 * Returns list of all available providers and their configurations for this site
 */
router.get('/config/providers', authenticatePlugin, async (req, res) => {
  try {
    const providers = ProviderConfig.getAllProviderOptions();
    const activeSiteProviders = await ProviderConfig.getAllProvidersForSite(req.site._id);
    
    res.json({
      success: true,
      all_providers: providers,
      active_providers: activeSiteProviders,
      message: 'Returns available providers and active configurations for this site'
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
 * Update Provider Configuration
 * PUT /api/v1/config/provider
 * Updates the active provider configuration for this site
 */
router.put('/config/provider', authenticatePlugin, async (req, res) => {
  try {
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
        error: `Invalid provider: ${provider}. Must be one of: ${Object.keys(ProviderConfig.PROVIDERS).join(', ')}`
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

    // Validate configuration
    const validation = ProviderConfig.validateConfig({
      provider,
      api_key: api_key || 'placeholder',
      model_article,
      model_image,
      max_tokens,
      temperature
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Configuration validation failed',
        errors: validation.errors
      });
    }

    await ProviderConfig.updateSiteConfig(req.site._id, updateData);

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
 * Get Available Packages (Public Endpoint - No Auth Required)
 * GET /api/v1/packages
 */
router.get('/packages', async (req, res) => {
  try {
    const packages = await CreditPackage.getPackagesGrouped();

    // Check if any packages exist
    const hasPackages = packages.articles?.length > 0 || 
                       packages.images?.length > 0 || 
                       packages.rewrites?.length > 0;

    if (!hasPackages) {
      return res.status(404).json({
        success: false,
        error: 'no_packages',
        message: 'No packages available'
      });
    }

    res.json({
      success: true,
      packages
    });

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message
    });
  }
});

/**
 * Log Generation Analytics
 * POST /api/v1/analytics/generation
 */
router.post('/analytics/generation', authenticatePlugin, async (req, res) => {
  try {
    const {
      user_email,
      user_id,
      site_url,
      content_type,
      prompt,
      result_length,
      credits_used = 1,
      timestamp
    } = req.body;

    if (!user_email || !user_id || !content_type || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_email, user_id, content_type, prompt'
      });
    }

    // Log generation
    await GenerationLog.logGeneration(
      req.site._id,
      parseInt(user_id),
      content_type,
      prompt,
      result_length,
      credits_used
    );

    res.json({
      success: true,
      message: 'Generation logged successfully'
    });

  } catch (error) {
    console.error('Log generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Bulk Usage Analytics
 * POST /api/v1/analytics/usage
 */
router.post('/analytics/usage', authenticatePlugin, async (req, res) => {
  try {
    const {
      site_url,
      sync_period,
      articles = [],
      images = [],
      total_users,
      plugin_version
    } = req.body;

    // Update site information
    await ExternalSite.updateById(req.site._id, {
      plugin_version,
      last_sync: new Date()
    });

    // Log bulk generations
    const bulkOperations = [];

    // Process articles
    for (const article of articles) {
      bulkOperations.push(
        GenerationLog.logGeneration(
          req.site._id,
          article.user_id,
          'article',
          article.prompt,
          article.content_length,
          1,
          null
        )
      );
    }

    // Process images
    for (const image of images) {
      bulkOperations.push(
        GenerationLog.logGeneration(
          req.site._id,
          image.user_id,
          'image',
          image.prompt,
          0,
          1,
          null
        )
      );
    }

    await Promise.all(bulkOperations);

    res.json({
      success: true,
      message: 'Usage analytics logged successfully',
      processed: {
        articles: articles.length,
        images: images.length
      }
    });

  } catch (error) {
    console.error('Bulk usage analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Instance Details
 * GET /api/v1/instances/:instance_id
 */
router.get('/instances/:instance_id', authenticatePlugin, async (req, res) => {
  try {
    const site = await ExternalSite.findByInstanceId(req.params.instance_id);
    
    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found'
      });
    }

    // Remove sensitive information
    const { api_token, ...siteData } = site;

    res.json({
      success: true,
      instance: siteData
    });

  } catch (error) {
    console.error('Get instance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Instance Information
 * PUT /api/v1/instances/:instance_id
 */
router.put('/instances/:instance_id', authenticatePlugin, async (req, res) => {
  try {
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated via API
    delete updateData.api_token;
    delete updateData.instance_id;
    delete updateData._id;

    await ExternalSite.updateById(req.site._id, updateData);

    res.json({
      success: true,
      message: 'Instance updated successfully'
    });

  } catch (error) {
    console.error('Update instance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create Checkout Session (WordPress Plugin Payment)
 * POST /api/v1/checkout/sessions
 * Used by WordPress plugin for checkout
 */
router.post('/checkout/sessions', authenticatePlugin, async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      credit_type,
      package_id,
      amount,
      currency,
      return_url,
      cancel_url
    } = req.body;

    // Validate required fields
    if (!user_id || !user_email || !credit_type || !package_id || !amount) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Missing required fields: user_id, user_email, credit_type, package_id, amount'
      });
    }

    // Validate credit type
    if (!['article', 'image', 'rewrite'].includes(credit_type)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_credit_type',
        message: 'Invalid credit_type. Must be: article, image, or rewrite'
      });
    }

    // Get Stripe configuration from database
    const StripeConfig = require('../../models/StripeConfig');
    const stripeConfig = await StripeConfig.getConfig();
    
    if (!stripeConfig || !stripeConfig.secret_key) {
      return res.status(500).json({
        success: false,
        error: 'payment_not_configured',
        message: 'Stripe payment processing not configured in dashboard'
      });
    }

    const stripe = require('stripe')(stripeConfig.secret_key);

    // Helper function to convert amount to Stripe format
    // Stripe expects the amount in the smallest currency unit
    // JPY: no decimal places, so amount is already correct
    // USD/EUR/etc: 2 decimal places, so multiply by 100
    const convertAmountToStripe = (amount, currencyCode) => {
      const noDecimalCurrencies = ['jpy', 'krw', 'vnd', 'idr', 'php', 'thb'];
      if (noDecimalCurrencies.includes(currencyCode.toLowerCase())) {
        return Math.round(amount);
      }
      return Math.round(amount * 100);
    };

    // Build redirect URLs
    // Default to WordPress admin page for handling payment response
    // Plugin must create /wp-admin/admin.php?page=rakubun-ai-purchase page
    let successUrl, cancelUrl;
    
    if (return_url && return_url.includes('/wp-admin/')) {
      // Update old page name to new page name
      let cleanUrl = return_url.replace('rakubun-purchase', 'rakubun-ai-purchase');
      // Use provided admin URL with session_id parameter
      successUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}&status=success';
      console.log(`[Checkout] Converting old URL: ${return_url} → ${cleanUrl}`);
    } else if (return_url) {
      // Use provided frontend URL with session_id
      successUrl = return_url + (return_url.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}';
    } else {
      // Default to WordPress admin page
      successUrl = req.site.site_url + '/wp-admin/admin.php?page=rakubun-ai-purchase&session_id={CHECKOUT_SESSION_ID}&status=success';
    }
    
    if (cancel_url && cancel_url.includes('/wp-admin/')) {
      // Update old page name to new page name
      let cleanUrl = cancel_url.replace('rakubun-purchase', 'rakubun-ai-purchase');
      // Use provided admin URL with cancel status
      cancelUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 'status=cancelled';
      console.log(`[Checkout] Converting old cancel URL: ${cancel_url} → ${cleanUrl}`);
    } else if (cancel_url) {
      // Use provided frontend URL
      cancelUrl = cancel_url;
    } else {
      // Default to WordPress admin page
      cancelUrl = req.site.site_url + '/wp-admin/admin.php?page=rakubun-ai-purchase&status=cancelled';
    }

    console.log(`[Checkout] Site: ${req.site.site_url}, Success URL: ${successUrl}, Cancel URL: ${cancelUrl}`);

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (currency || stripeConfig.default_currency || 'jpy').toLowerCase(),
            product_data: {
              name: `${package_id} - ${credit_type} credits`,
              description: `Purchase ${amount} ${(currency || stripeConfig.default_currency || 'jpy').toUpperCase()} worth of ${credit_type} credits`
            },
            unit_amount: convertAmountToStripe(amount, currency || stripeConfig.default_currency || 'jpy')
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        site_id: req.site._id.toString(),
        instance_id: req.site.instance_id,
        user_id: user_id.toString(),
        user_email: user_email,
        package_id: package_id,
        credit_type: credit_type
      },
      customer_email: user_email
    });

    // Store checkout session in database for later verification
    const db = global.db;
    const checkoutCollection = db.collection('stripe_checkout_sessions');
    
    const sessionData = {
      site_id: req.site._id,
      user_id: parseInt(user_id),
      user_email: user_email,
      session_id: session.id,
      package_id: package_id,
      credit_type: credit_type,
      amount: amount,
      currency: currency || 'JPY',
      status: 'pending',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiry
    };

    console.log('[Checkout] Storing session in database:', sessionData);
    await checkoutCollection.insertOne(sessionData);
    console.log('[Checkout] Session stored successfully. ID:', session.id);

    res.json({
      success: true,
      session_id: session.id,
      url: session.url,
      amount: amount,
      currency: currency || 'JPY'
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      error: 'session_creation_failed',
      message: error.message
    });
  }
});

/**
 * Verify Checkout Session
 * POST /api/v1/checkout/verify
 * Verifies Stripe Checkout Session payment status and adds credits to user
 */
router.post('/checkout/verify', authenticatePlugin, async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Missing required field: session_id'
      });
    }

    // Get Stripe configuration from database
    const StripeConfig = require('../../models/StripeConfig');
    const stripeConfig = await StripeConfig.getConfig();
    
    if (!stripeConfig || !stripeConfig.secret_key) {
      return res.status(500).json({
        success: false,
        error: 'payment_not_configured',
        message: 'Stripe payment processing not configured in dashboard'
      });
    }

    const stripe = require('stripe')(stripeConfig.secret_key);

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'session_not_found',
        message: 'Checkout session not found in Stripe'
      });
    }

    // Check if payment is completed
    if (session.payment_status !== 'paid') {
      return res.status(402).json({
        success: false,
        error: 'payment_not_completed',
        message: 'Payment not completed',
        payment_status: session.payment_status
      });
    }

    // Get session details from database
    const db = global.db;
    const checkoutCollection = db.collection('stripe_checkout_sessions');
    
    console.log(`[Checkout Verify] Looking for session: ${session_id}, site_id: ${req.site._id}`);
    
    const sessionRecord = await checkoutCollection.findOne({
      session_id: session_id,
      site_id: req.site._id
    });

    if (!sessionRecord) {
      console.log(`[Checkout Verify] Session not found in database. Checking if it exists at all...`);
      // Check if session exists but belongs to different site (for debugging)
      const anySession = await checkoutCollection.findOne({ session_id: session_id });
      if (anySession) {
        console.log(`[Checkout Verify] Session exists but belongs to different site:`, anySession.site_id);
      } else {
        console.log(`[Checkout Verify] Session does not exist in database at all`);
      }
      return res.status(400).json({
        success: false,
        error: 'session_record_not_found',
        message: 'Session record not found in database'
      });
    }

    // Check if already processed to prevent duplicates
    if (sessionRecord.status === 'completed') {
      return res.json({
        success: true,
        message: 'Session already processed',
        status: 'already_completed',
        credits_added: sessionRecord.credits_added || 0,
        credit_type: sessionRecord.credit_type
      });
    }

    // Get or create user
    const user = await ExternalUser.getOrCreateUser(
      req.site._id,
      sessionRecord.user_id,
      sessionRecord.user_email
    );

    // Get package info
    const pkg = await CreditPackage.findByPackageId(sessionRecord.package_id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        error: 'package_not_found',
        message: 'Package not found'
      });
    }

    // Add credits to user
    const creditsAdded = pkg.credits;
    const creditType = sessionRecord.credit_type;

    try {
      console.log(`[Checkout Verify] Updating credits for user ${sessionRecord.user_id}, type: ${creditType}, amount: ${creditsAdded}`);
      
      await ExternalUser.updateCredits(
        req.site._id,
        sessionRecord.user_id,
        creditType,
        creditsAdded
      );

      console.log(`[Checkout Verify] Credits updated successfully`);
    } catch (creditsError) {
      console.error(`[Checkout Verify] Error updating credits:`, creditsError.message);
      console.error(`[Checkout Verify] Error details:`, creditsError);
      throw creditsError;
    }

    // Get updated user to return remaining credits
    let updatedUser;
    try {
      console.log(`[Checkout Verify] Fetching updated user data`);
      updatedUser = await ExternalUser.getOrCreateUser(
        req.site._id,
        sessionRecord.user_id,
        sessionRecord.user_email
      );
      console.log(`[Checkout Verify] Updated user fetched:`, {
        user_id: updatedUser.user_id,
        article_credits: updatedUser.article_credits,
        image_credits: updatedUser.image_credits,
        rewrite_credits: updatedUser.rewrite_credits
      });
    } catch (userError) {
      console.error(`[Checkout Verify] Error fetching updated user:`, userError.message);
      throw userError;
    }

    // Log transaction
    const crypto = require('crypto');
    const transactionId = 'txn_' + crypto.randomBytes(8).toString('hex');

    try {
      console.log(`[Checkout Verify] Logging transaction: ${transactionId}`);
      await CreditTransaction.logPurchase(
        req.site._id,
        sessionRecord.user_id,
        creditType,
        creditsAdded,
        updatedUser[`${creditType}_credits`],
        session_id,
        'stripe_checkout'
      );
      console.log(`[Checkout Verify] Transaction logged successfully`);
    } catch (logError) {
      console.error(`[Checkout Verify] Error logging transaction:`, logError.message);
      throw logError;
    }

    // Update checkout session status in database
    await checkoutCollection.updateOne(
      { session_id: session_id },
      {
        $set: {
          status: 'completed',
          completed_at: new Date(),
          credits_added: creditsAdded,
          transaction_id: transactionId
        }
      }
    );

    // Log success
    console.log(`Checkout verified and credits added: ${session_id}, user: ${sessionRecord.user_id}, credits: ${creditsAdded}`);

    res.json({
      success: true,
      message: 'Credits added successfully',
      credits_added: creditsAdded,
      remaining_credits: updatedUser[`${creditType}_credits`],
      credit_type: creditType,
      transaction_id: transactionId
    });

  } catch (error) {
    console.error('Verify checkout session error:', error);
    res.status(500).json({
      success: false,
      error: 'verification_failed',
      message: error.message
    });
  }
});

/**
 * Create Payment Intent
 * POST /api/v1/payments/create-intent
 */
router.post('/payments/create-intent', authenticatePlugin, async (req, res) => {
  try {
    const {
      user_id,
      user_email,
      credit_type,
      package_id,
      amount,
      currency
    } = req.body;

    // Validate required fields
    if (!user_id || !user_email || !credit_type || !package_id || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, user_email, credit_type, package_id, amount'
      });
    }

    // Validate credit type
    if (!['article', 'image', 'rewrite'].includes(credit_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credit_type. Must be: article, image, or rewrite'
      });
    }

    // Get Stripe configuration from database
    const StripeConfig = require('../../models/StripeConfig');
    const stripeConfig = await StripeConfig.getConfig();
    
    if (!stripeConfig || !stripeConfig.secret_key) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing not configured'
      });
    }

    const stripe = require('stripe')(stripeConfig.secret_key);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: convertAmountToStripe(amount, currency || stripeConfig.default_currency || 'jpy'),
      currency: (currency || stripeConfig.default_currency || 'jpy').toLowerCase(),
      metadata: {
        site_id: req.site._id.toString(),
        instance_id: req.site.instance_id,
        user_id: user_id.toString(),
        user_email: user_email,
        package_id: package_id,
        credit_type: credit_type
      },
      description: `Purchase ${package_id} - ${credit_type} credits`
    });

    // Store payment intent in database for later verification
    const db = global.db;
    const paymentsCollection = db.collection('stripe_payment_intents');
    
    await paymentsCollection.insertOne({
      site_id: req.site._id,
      user_id: parseInt(user_id),
      user_email: user_email,
      payment_intent_id: paymentIntent.id,
      package_id: package_id,
      credit_type: credit_type,
      amount: amount,
      currency: currency || 'JPY',
      status: 'created',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiry
    });

    res.json({
      success: true,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: amount,
      currency: currency || 'JPY'
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
});

/**
 * Confirm Payment
 * POST /api/v1/payments/confirm
 */
router.post('/payments/confirm', authenticatePlugin, async (req, res) => {
  try {
    const {
      payment_intent_id,
      user_id,
      user_email,
      credit_type
    } = req.body;

    // Validate required fields
    if (!payment_intent_id || !user_id || !user_email || !credit_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: payment_intent_id, user_id, user_email, credit_type'
      });
    }

    // Get Stripe configuration from database
    const StripeConfig = require('../../models/StripeConfig');
    const stripeConfig = await StripeConfig.getConfig();
    
    if (!stripeConfig || !stripeConfig.secret_key) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing not configured'
      });
    }

    const stripe = require('stripe')(stripeConfig.secret_key);

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (!paymentIntent) {
      return res.status(404).json({
        success: false,
        error: 'Payment intent not found'
      });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({
        success: false,
        error: 'Payment not confirmed',
        payment_status: paymentIntent.status
      });
    }

    // Get payment intent details from database
    const db = global.db;
    const paymentsCollection = db.collection('stripe_payment_intents');
    
    const paymentRecord = await paymentsCollection.findOne({
      payment_intent_id: payment_intent_id,
      site_id: req.site._id
    });

    if (!paymentRecord) {
      return res.status(400).json({
        success: false,
        error: 'Payment record not found'
      });
    }

    // Get or create user
    const user = await ExternalUser.getOrCreateUser(
      req.site._id,
      parseInt(user_id),
      user_email
    );

    // Get package info
    const CreditPackage = require('../../models/CreditPackage');
    const pkg = await CreditPackage.findByPackageId(paymentRecord.package_id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Add credits to user
    const creditsAdded = pkg.credits;
    await ExternalUser.updateCredits(
      req.site._id,
      parseInt(user_id),
      credit_type,
      creditsAdded
    );

    // Get updated credits
    const updatedUser = await ExternalUser.getOrCreateUser(
      req.site._id,
      parseInt(user_id),
      user_email
    );

    // Log transaction
    const crypto = require('crypto');
    const transactionId = 'txn_' + crypto.randomBytes(8).toString('hex');

    await CreditTransaction.logPurchase(
      req.site._id,
      parseInt(user_id),
      credit_type,
      creditsAdded,
      updatedUser[`${credit_type}_credits`],
      payment_intent_id
    );

    // Update payment record
    await paymentsCollection.updateOne(
      { payment_intent_id: payment_intent_id },
      {
        $set: {
          status: 'confirmed',
          transaction_id: transactionId,
          confirmed_at: new Date()
        }
      }
    );

    res.json({
      success: true,
      credits_added: creditsAdded,
      transaction_id: transactionId,
      remaining_credits: {
        article_credits: updatedUser.article_credits,
        image_credits: updatedUser.image_credits,
        rewrite_credits: updatedUser.rewrite_credits
      }
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
      message: error.message
    });
  }
});

/**
 * Article Configuration
 * GET /api/v1/config/article?provider=openai
 * Returns article models and config for specified provider, or currently active if not specified
 */
router.get('/config/article', authenticatePlugin, async (req, res) => {
  try {
    const requestedProvider = req.query.provider;
    let config;
    let provider;

    if (requestedProvider) {
      // Get configuration for specific provider
      config = await ProviderConfig.getConfigForSite(req.site._id, requestedProvider);
      provider = requestedProvider;
    } else {
      // Get currently active provider configuration
      config = await ProviderConfig.getConfigForSite(req.site._id);
      provider = config?.provider || 'openai'; // Default to openai if no config
    }

    // Get available models for this provider (even if no API key configured yet)
    const providerInfo = ProviderConfig.getProviderInfo(provider);
    const availableModels = providerInfo?.models?.article || [];

    // Get system prompt or use default
    const systemPrompt = config?.system_prompt || 
      'You are a professional content writer specialized in SEO-optimized articles. Create engaging, well-structured content that ranks well in search engines.';

    res.json({
      success: true,
      provider: provider,
      provider_name: providerInfo?.name,
      config: {
        api_key: config?.api_key || '',
        model: config?.model_article || providerInfo?.default_models?.article,
        temperature: config?.temperature || 0.7,
        max_tokens: config?.max_tokens || 2000,
        system_prompt: systemPrompt,
        base_url: providerInfo?.base_url
      },
      models: availableModels
    });

  } catch (error) {
    console.error('Get article config error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message
    });
  }
});

/**
 * Image Configuration
 * GET /api/v1/config/image?provider=openai
 * Returns image models and config for specified provider, or currently active if not specified
 */
router.get('/config/image', authenticatePlugin, async (req, res) => {
  try {
    const requestedProvider = req.query.provider;
    let config;
    let provider;

    if (requestedProvider) {
      // Get configuration for specific provider
      config = await ProviderConfig.getConfigForSite(req.site._id, requestedProvider);
      provider = requestedProvider;
    } else {
      // Get currently active provider configuration
      config = await ProviderConfig.getConfigForSite(req.site._id);
      provider = config?.provider || 'openai'; // Default to openai if no config
    }

    // Get available models for this provider (even if no API key configured yet)
    const providerInfo = ProviderConfig.getProviderInfo(provider);
    const availableModels = providerInfo?.models?.image || [];

    // Available image sizes (provider-dependent, shown as reference)
    const availableSizes = [
      '1024x1024',
      '1024x1792',
      '1792x1024'
    ];

    res.json({
      success: true,
      provider: provider,
      provider_name: providerInfo?.name,
      config: {
        api_key: config?.api_key || '',
        model: config?.model_image || providerInfo?.default_models?.image,
        quality: config?.image_quality || 'hd',
        base_url: providerInfo?.base_url
      },
      models: availableModels,
      sizes: availableSizes
    });

  } catch (error) {
    console.error('Get image config error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message
    });
  }
});

/**
 * Rewrite Configuration
 * GET /api/v1/config/rewrite
 */
router.get('/config/rewrite', authenticatePlugin, async (req, res) => {
  try {
    // Get configuration for the external site
    const config = await ProviderConfig.getConfigForSite(req.site._id);

    if (!config || !config.api_key) {
      return res.status(404).json({
        success: false,
        error: 'no_provider_key',
        message: 'Provider API key not configured for content rewriting'
      });
    }

    // Get available models for this provider
    const providerInfo = ProviderConfig.getProviderInfo(config.provider);
    const availableModels = providerInfo?.models?.article || [];

    // Available rewrite strategies
    const strategies = [
      'improve_seo',
      'simplify',
      'expand',
      'formal_to_casual'
    ];

    res.json({
      success: true,
      provider: config.provider,
      provider_name: providerInfo?.name,
      config: {
        api_key: config.api_key,
        model: config.model_article || providerInfo?.default_models?.article,
        temperature: config.temperature || 0.6,
        strategies: strategies,
        base_url: providerInfo?.base_url
      },
      models: availableModels
    });

  } catch (error) {
    console.error('Get rewrite config error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message
    });
  }
});

/**
 * Stripe Configuration
 * GET /api/v1/config/stripe
 */
router.get('/config/stripe', authenticatePlugin, async (req, res) => {
  try {
    // Get Stripe configuration
    const StripeConfig = require('../../models/StripeConfig');
    const stripeConfig = await StripeConfig.getConfig();

    if (!stripeConfig || !stripeConfig.publishable_key) {
      return res.status(404).json({
        success: false,
        error: 'no_stripe_key',
        message: 'Stripe public key not configured'
      });
    }

    res.json({
      success: true,
      public_key: stripeConfig.publishable_key,
      currency: stripeConfig.default_currency || 'jpy',
      test_mode: stripeConfig.mode === 'test',
      webhooks_enabled: true
    });

  } catch (error) {
    console.error('Get stripe config error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: error.message
    });
  }
});

/**
 * Test Article Generation
 * POST /api/v1/config/test/article
 */
router.post('/config/test/article', authenticatePlugin, async (req, res) => {
  try {
    const { provider } = req.query;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'missing_provider',
        message: 'Provider parameter is required'
      });
    }

    const ProviderConfig = require('./ProviderConfig');
    const providerInfo = ProviderConfig.getProviderInfo(provider);

    if (!providerInfo) {
      return res.status(400).json({
        success: false,
        error: 'invalid_provider',
        message: `Provider '${provider}' not found`
      });
    }

    const config = site.providers[provider];
    if (!config || !config.api_key) {
      return res.status(400).json({
        success: false,
        error: 'missing_config',
        message: `${providerInfo.name} is not configured`
      });
    }

    // Create AI instance for the provider
    let aiInstance;
    if (provider === 'openai') {
      const OpenAI = require('./class-rakubun-ai-openai');
      aiInstance = new OpenAI(config.api_key, config.model_article, config.temperature, config.base_url);
    } else if (provider === 'novita') {
      const Novita = require('./class-rakubun-ai-novita');
      aiInstance = new Novita(config.api_key, config.model_article, config.temperature, config.base_url);
    }

    // Test article generation
    const testPrompt = 'Write a brief test article about AI in 2-3 sentences.';
    const result = await aiInstance.generateArticle(testPrompt);

    res.json({
      success: true,
      provider: provider,
      provider_name: providerInfo.name,
      model: config.model_article,
      test_prompt: testPrompt,
      result: result,
      message: `Article generation test successful for ${providerInfo.name}`
    });

  } catch (error) {
    console.error('Test article generation error:', error);
    res.status(500).json({
      success: false,
      error: 'generation_failed',
      message: error.message
    });
  }
});

/**
 * Test Image Generation
 * POST /api/v1/config/test/image
 */
router.post('/config/test/image', authenticatePlugin, async (req, res) => {
  try {
    const { provider } = req.query;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'missing_provider',
        message: 'Provider parameter is required'
      });
    }

    const ProviderConfig = require('./ProviderConfig');
    const providerInfo = ProviderConfig.getProviderInfo(provider);

    if (!providerInfo) {
      return res.status(400).json({
        success: false,
        error: 'invalid_provider',
        message: `Provider '${provider}' not found`
      });
    }

    const config = site.providers[provider];
    if (!config || !config.api_key) {
      return res.status(400).json({
        success: false,
        error: 'missing_config',
        message: `${providerInfo.name} is not configured`
      });
    }

    // Create AI instance for the provider
    let aiInstance;
    if (provider === 'openai') {
      const OpenAI = require('./class-rakubun-ai-openai');
      aiInstance = new OpenAI(config.api_key, config.model_image, config.temperature, config.base_url);
    } else if (provider === 'novita') {
      const Novita = require('./class-rakubun-ai-novita');
      aiInstance = new Novita(config.api_key, config.model_image, config.temperature, config.base_url);
    }

    // Test image generation
    const testPrompt = 'A professional AI technology background image';
    const result = await aiInstance.generateImage(testPrompt);

    res.json({
      success: true,
      provider: provider,
      provider_name: providerInfo.name,
      model: config.model_image,
      test_prompt: testPrompt,
      result: result,
      message: `Image generation test successful for ${providerInfo.name}`
    });

  } catch (error) {
    console.error('Test image generation error:', error);
    res.status(500).json({
      success: false,
      error: 'generation_failed',
      message: error.message
    });
  }
});

module.exports = router;