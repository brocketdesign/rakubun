const express = require('express');
const router = express.Router();
const ExternalSite = require('../../models/ExternalSite');
const ExternalUser = require('../../models/ExternalUser');
const CreditPackage = require('../../models/CreditPackage');
const CreditTransaction = require('../../models/CreditTransaction');
const GenerationLog = require('../../models/GenerationLog');
const OpenAIConfig = require('../../models/OpenAIConfig');
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

    const package = await CreditPackage.create(packageData);

    res.json({
      success: true,
      package
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

module.exports = router;