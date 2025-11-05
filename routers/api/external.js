const express = require('express');
const router = express.Router();
const ExternalSite = require('../../models/ExternalSite');
const ExternalUser = require('../../models/ExternalUser');
const CreditPackage = require('../../models/CreditPackage');
const CreditTransaction = require('../../models/CreditTransaction');
const GenerationLog = require('../../models/GenerationLog');
const OpenAIConfig = require('../../models/OpenAIConfig');
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

    // Get or create user
    const user = await ExternalUser.getOrCreateUser(req.site._id, parseInt(user_id), user_email);

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
 * Get OpenAI Configuration
 * GET /api/v1/config/openai
 */
router.get('/config/openai', authenticatePlugin, async (req, res) => {
  try {
    const config = await OpenAIConfig.getConfigForSite(req.site._id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No OpenAI configuration found'
      });
    }

    res.json({
      api_key: config.api_key,
      model_article: config.model_article,
      model_image: config.model_image,
      max_tokens: config.max_tokens,
      temperature: config.temperature
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
 * Get Available Packages
 * GET /api/v1/packages
 */
router.get('/packages', authenticatePlugin, async (req, res) => {
  try {
    const packages = await CreditPackage.getPackagesGrouped();

    res.json({
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

    // Get Stripe key from environment
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing not configured'
      });
    }

    const stripe = require('stripe')(stripeKey);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: (currency || 'jpy').toLowerCase(),
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

    // Get Stripe key from environment
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(500).json({
        success: false,
        error: 'Payment processing not configured'
      });
    }

    const stripe = require('stripe')(stripeKey);

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

module.exports = router;