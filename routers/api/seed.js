const express = require('express');
const router = express.Router();
const CreditPackage = require('../../models/CreditPackage');
const OpenAIConfig = require('../../models/OpenAIConfig');
const { authenticateAdmin } = require('../../middleware/externalApiMiddleware');
const ensureAuthenticated = require('../../middleware/authMiddleware');

// Apply authentication
router.use(ensureAuthenticated);
router.use(authenticateAdmin);

/**
 * Seed Default Data
 * POST /api/v1/admin/seed
 */
router.post('/', async (req, res) => {
  try {
    const { packages = true, config = true } = req.body;
    const results = {};

    if (packages) {
      await CreditPackage.seedDefaultPackages();
      results.packages = 'Default packages seeded successfully';
    }

    if (config) {
      await OpenAIConfig.seedDefaultConfig();
      results.config = 'Default OpenAI configuration seeded successfully';
    }

    res.json({
      success: true,
      message: 'Data seeded successfully',
      results
    });

  } catch (error) {
    console.error('Seed data error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;