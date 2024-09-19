// template.js
const express = require('express');
const router = express.Router();

const ensureAuthenticated = require('../../middleware/authMiddleware');
const ensureMembership = require('../../middleware/ensureMembership');
const { ObjectId } = require('mongodb');

// Route to list all templates (public and user's private templates)
router.get('/templates', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const userId = new ObjectId(req.user._id);

    // Fetch public templates
    const publicTemplates = await global.db
      .collection('templates')
      .find({ isPublic: true })
      .toArray();

    // Fetch user's private templates
    const privateTemplates = await global.db
      .collection('templates')
      .find({ ownerId: userId })
      .toArray();

    res.render('dashboard/templates/list', {
      user: req.user,
      publicTemplates,
      privateTemplates,
      title: 'RAKUBUN - Templates',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to display the form for adding a new template
router.get('/templates/add', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    res.render('dashboard/templates/add', {
      user: req.user,
      title: 'RAKUBUN - Add Template',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle the submission of a new template
router.post('/templates/add', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const userId = new ObjectId(req.user._id);
    const { name, description, systemMessage, generatePrompt, isPublic } = req.body;

    // Create a new template object
    const newTemplate = {
      name,
      description,
      systemMessage,
      generatePrompt,
      isPublic: isPublic === 'on', // Checkbox returns 'on' if checked
      ownerId: userId,
      createdAt: new Date(),
    };

    await global.db.collection('templates').insertOne(newTemplate);

    res.redirect('/dashboard/templates');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to display the form for editing an existing template
router.get('/templates/edit/:templateId', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = new ObjectId(req.params.templateId);
    const userId = new ObjectId(req.user._id);

    // Fetch the template to ensure it exists and the user has permission
    const template = await global.db.collection('templates').findOne({
      _id: templateId,
      ownerId: userId,
    });

    if (!template) {
      return res.status(404).send('Template not found or you do not have permission to edit it.');
    }

    res.render('dashboard/templates/edit', {
      user: req.user,
      template,
      title: 'RAKUBUN - Edit Template',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle the submission of an edited template
router.post('/templates/edit/:templateId', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = new ObjectId(req.params.templateId);
    const userId = new ObjectId(req.user._id);

    const { name, description, systemMessage, generatePrompt, isPublic } = req.body;

    // Update the template
    const result = await global.db.collection('templates').updateOne(
      {
        _id: templateId,
        ownerId: userId, // Ensure the user owns the template
      },
      {
        $set: {
          name,
          description,
          systemMessage,
          generatePrompt,
          isPublic: isPublic === 'on',
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send('Template not found or you do not have permission to edit it.');
    }

    res.redirect('/dashboard/templates');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle the deletion of a template
router.post('/templates/delete/:templateId', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = new ObjectId(req.params.templateId);
    const userId = new ObjectId(req.user._id);

    // Delete the template
    const result = await global.db.collection('templates').deleteOne({
      _id: templateId,
      ownerId: userId, // Ensure the user owns the template
    });

    if (result.deletedCount === 0) {
      return res.status(404).send('Template not found or you do not have permission to delete it.');
    }

    res.redirect('/dashboard/templates');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
