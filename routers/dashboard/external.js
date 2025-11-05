const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { authenticateAdmin } = require('../../middleware/externalApiMiddleware');

// Dashboard route
router.get('/', ensureAuthenticated, authenticateAdmin, async (req, res) => {
  try {
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