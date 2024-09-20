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

// テンプレートの詳細を表示するルート
router.get('/templates/view/:templateId', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = new ObjectId(req.params.templateId);
    const userId = new ObjectId(req.user._id);

    // テンプレートを取得
    const template = await global.db.collection('templates').findOne({
      _id: templateId,
      $or: [
        { isPublic: true },
        { ownerId: userId } // 自分のプライベートテンプレートを表示可能
      ]
    });

    if (!template) {
      return res.status(404).send('テンプレートが見つかりません。');
    }

    res.render('dashboard/templates/view', {
      user: req.user,
      isowner: req.user?._id?.toString() === template?.ownerId?.toString(),
      template,
      title: `RAKUBUN - ${template.name} の詳細`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('サーバーエラーが発生しました。');
  }
});
// Route to display the form for adding or editing a template
router.get('/templates/form/:templateId?', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = req.params.templateId ? new ObjectId(req.params.templateId) : null;
    let template = null;

    if (templateId) {
      const userId = new ObjectId(req.user._id);

      // Fetch the template to ensure it exists and the user has permission
      template = await global.db.collection('templates').findOne({
        _id: templateId,
        ownerId: userId,
      });

      if (!template) {
        return res.status(404).send('Template not found or you do not have permission to edit it.');
      }
    }

    res.render('dashboard/templates/form', {
      user: req.user,
      template,
      title: template ? 'RAKUBUN - Edit Template' : 'RAKUBUN - Add Template',
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle submission for both adding and editing a template
router.post('/templates/save', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const userId = new ObjectId(req.user._id);
    const {
      templateId,
      name,
      description,
      systemMessage,
      generatePrompt,
      isPublic,
      sections,
      tone,
      style,
      contentLength,
      categoryName,
      tags,
    } = req.body;

    // タグをカンマ区切りの文字列から配列に変換
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    const templateData = {
      name,
      description,
      systemMessage,
      generatePrompt,
      isPublic: isPublic === 'on' || isPublic === true,
      sections: parseInt(sections),
      tone,
      style,
      contentLength: parseInt(contentLength),
      categoryName,
      tags: tagsArray,
      ownerId: userId,
      updatedAt: new Date(),
    };

    if (templateId) {
      // 既存のテンプレートを更新
      const result = await global.db.collection('templates').updateOne(
        { _id: new ObjectId(templateId), ownerId: userId },
        { $set: templateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'テンプレートが見つからないか、編集権限がありません。' });
      }
    } else {
      // 新しいテンプレートを作成
      templateData.createdAt = new Date();
      await global.db.collection('templates').insertOne(templateData);
    }

    res.json({ success: true, message: 'テンプレートが正常に保存されました。' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
  }
});

// テンプレートリストを取得するエンドポイント
router.get('/api/templates/list', async (req, res) => {
  try {
      // テンプレートコレクションからテンプレートを取得
      const templates = await global.db.collection('templates').find({}).toArray();

      // テンプレートIDと名前のみを抽出
      const templateList = templates.map(template => ({
          _id: template._id,
          name: template.name
      }));

      res.json({ success: true, templates: templateList });
  } catch (error) {
      console.error('テンプレートリスト取得中にエラーが発生しました:', error);
      res.json({ success: false, message: 'テンプレートリストの取得に失敗しました。' });
  }
});
// API route to get template details (for use with jQuery and SweetAlert2)
router.get('/api/templates/:templateId', ensureAuthenticated, ensureMembership, async (req, res) => {
  try {
    const templateId = new ObjectId(req.params.templateId);
    const userId = new ObjectId(req.user._id);

    // Fetch the template
    const template = await global.db.collection('templates').findOne({
      _id: templateId,
      $or: [
        { isPublic: true },
        { ownerId: userId }, // User's private template
      ],
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error.' });
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
