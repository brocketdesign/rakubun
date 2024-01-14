const express = require('express');
const router = express.Router();

const fs = require('fs');
const OpenAI = require('mongodb');
const { premiumPlan} = require('../../modules/products')
const ensureAuthenticated = require('../../middleware/authMiddleware');
const ensureMembership = require('../../middleware/ensureMembership');
const {sendEmail} = require('../../services/email')
const path = require('path');
const { ObjectId } = require('mongodb');

// Route for handling '/dashboard/'
router.get('/', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    res.render('dashboard/top', {
      user: req.user,
      title: "RAKUBUN - Dashboard",
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Route for handling '/dashboard/'
router.get('/app/:appname', ensureAuthenticated,ensureMembership, async (req, res) => {  
  const appname = req.params.appname
  res.render('dashboard/app/'+appname,{user:req.user,title:"RAKUBUN - Dashboard"});
});

module.exports = router;
