const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { authenticateWebAdmin } = require('../../middleware/externalApiMiddleware');

// Dashboard route
router.get('/', ensureAuthenticated, authenticateWebAdmin, async (req, res) => {
  try {
    console.log('[External Dashboard] Rendering external dashboard for user:', req.user.email);
    res.render('dashboard/external/index', {
      user: req.user,
      title: "RAKUBUN - External Dashboard",
      layout: 'dashboard/base'
    });
  } catch (error) {
    console.error('Error loading external dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle route without trailing slash
router.get('', ensureAuthenticated, authenticateWebAdmin, async (req, res) => {
  try {
    console.log('[External Dashboard] Rendering external dashboard for user (no trailing slash):', req.user.email);
    res.render('dashboard/external/index', {
      user: req.user,
      title: "RAKUBUN - External Dashboard",
      layout: 'dashboard/base'
    });
  } catch (error) {
    console.error('Error loading external dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;