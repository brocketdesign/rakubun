const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { findMatchingTrendsForBlog } = require('../../modules/trendMatcher'); // Added for trend matching
const TrendAnalysisResult = require('../../models/TrendAnalysisResult'); // Import the model for cached results

// GET /api/trendautoblog/settings/:blogId - Get trend and model settings for a specific blog
router.get('/settings/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        const blogId = req.params.blogId;
        if (!ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: '無効なブログIDです。' }); // Invalid Blog ID
        }

        const blog = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) });

        if (!blog) {
            return res.status(404).json({ success: false, message: 'ブログが見つかりません。' }); // Blog not found
        }

        // Return existing settings or defaults
        const settings = {
            trendKeywords: blog.trendKeywords || [],
            trendModelSettings: blog.trendModelSettings || {
                language: 'japanese',
                tone: 'Informative',
                template: ''
            }
        };
        res.json(settings);
    } catch (error) {
        console.error('Error fetching trend autoblog settings:', error);
        res.status(500).json({ success: false, message: '設定の読み込み中にエラーが発生しました。' }); // Error loading settings
    }
});

// POST /api/trendautoblog/settings/trends - Save trend keywords for a blog
router.post('/settings/trends', ensureAuthenticated, async (req, res) => {
    try {
        const { blogId, keywords } = req.body;
        if (!ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: '無効なブログIDです。' });
        }
        if (!keywords || typeof keywords !== 'string') {
            return res.status(400).json({ success: false, message: 'キーワードは必須です。' }); // Keywords are required
        }

        const trendKeywords = keywords.split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);

        const result = await global.db.collection('blogInfos').updateOne(
            { _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) },
            { $set: { trendKeywords: trendKeywords, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'ブログが見つからないか、権限がありません。' }); // Blog not found or no permission
        }

        res.json({ success: true, message: 'トレンドキーワードを保存しました。' }); // Trend keywords saved
    } catch (error) {
        console.error('Error saving trend keywords:', error);
        res.status(500).json({ success: false, message: 'キーワードの保存中にエラーが発生しました。' }); // Error saving keywords
    }
});

// POST /api/trendautoblog/settings/model - Save AI model settings for a blog
router.post('/settings/model', ensureAuthenticated, async (req, res) => {
    try {
        const { blogId, language, tone, template } = req.body;
        if (!ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: '無効なブログIDです。' });
        }

        // Validate inputs (basic validation)
        if (!language || !tone) {
            return res.status(400).json({ success: false, message: '言語とトーンは必須です。' }); // Language and tone are required
        }

        const modelSettings = {
            language,
            tone,
            template: template || '', // Default to empty string if not provided
            model: 'gpt-4o' // Hardcoded for now as per requirement
        };

        const result = await global.db.collection('blogInfos').updateOne(
            { _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) },
            { $set: { trendModelSettings: modelSettings, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'ブログが見つからないか、権限がありません。' });
        }

        res.json({ success: true, message: 'AIモデル設定を保存しました。' }); // AI model settings saved
    } catch (error) {
        console.error('Error saving AI model settings:', error);
        res.status(500).json({ success: false, message: 'AIモデル設定の保存中にエラーが発生しました。' }); // Error saving AI model settings
    }
});

// GET /api/trendautoblog/match-trends/:blogId - New endpoint to get matching trends for a blog
router.get('/match-trends/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        const blogId = req.params.blogId;
        const userId = req.user._id.toString(); // Get userId for WebSocket
        const forceReanalysis = req.query.forceReanalysis === 'true';

        console.log(`[/api/trendautoblog/match-trends] Received request for blogId: ${blogId}, userId: ${userId}, forceReanalysis: ${forceReanalysis}`);

        if (!ObjectId.isValid(blogId)) {
            console.error(`[/api/trendautoblog/match-trends] Invalid blogId: ${blogId}`);
            return res.status(400).json({ success: false, message: '無効なブログIDです。' });
        }

        const blog = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) });
        if (!blog) {
            console.error(`[/api/trendautoblog/match-trends] Blog not found or access denied for blogId: ${blogId}`);
            return res.status(404).json({ success: false, message: 'ブログが見つからないか、アクセス権がありません。' });
        }
        console.log(`[/api/trendautoblog/match-trends] Blog found: ${blog.blogName}. Invoking findMatchingTrendsForBlog.`);

        findMatchingTrendsForBlog(blogId, userId, forceReanalysis)
            .then(result => {
                console.log(`[/api/trendautoblog/match-trends] findMatchingTrendsForBlog completed for blog ${blogId}. Success: ${result.success}, Message: ${result.message}`);
            })
            .catch(error => {
                console.error(`[/api/trendautoblog/match-trends] Error after findMatchingTrendsForBlog promise for blog ${blogId}:`, error);
            });

        const message = forceReanalysis 
            ? 'トレンド分析を強制的に再実行しています。結果はリアルタイムで表示されます。' 
            : 'トレンド分析が開始されました。結果はリアルタイムで表示されます。キャッシュされた結果がある場合は再利用されます。';
        
        res.json({ success: true, message });

    } catch (error) {
        console.error(`[/api/trendautoblog/match-trends] Error in endpoint for blogId ${blogId}:`, error);
        res.status(500).json({ success: false, message: 'トレンドのマッチング中にサーバーエラーが発生しました。' });
    }
});

// GET /api/trendautoblog/cached-analysis/:blogId - Get cached analysis results for a blog
router.get('/cached-analysis/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        const blogId = req.params.blogId;
        
        if (!ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: '無効なブログIDです。' });
        }
        
        // Ensure the blog belongs to the user
        const blog = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) });
        if (!blog) {
            return res.status(404).json({ success: false, message: 'ブログが見つからないか、アクセス権がありません。' });
        }
        
        // Get cached analysis results for this blog
        const cachedResults = await TrendAnalysisResult.find({ 
            blogId: new ObjectId(blogId) 
        }).sort({ analyzedAt: -1 }).limit(100).lean();
        
        res.json({
            success: true,
            blog: {
                id: blogId,
                name: blog.blogName,
                keywords: blog.trendKeywords || []
            },
            cachedResults,
            count: cachedResults.length
        });
    } catch (error) {
        console.error('Error fetching cached analysis results:', error);
        res.status(500).json({ success: false, message: 'キャッシュされた分析結果の取得中にエラーが発生しました。' });
    }
});

// DELETE /api/trendautoblog/cached-analysis/:blogId - Clear cached analysis results for a blog
router.delete('/cached-analysis/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        const blogId = req.params.blogId;
        
        if (!ObjectId.isValid(blogId)) {
            return res.status(400).json({ success: false, message: '無効なブログIDです。' });
        }
        
        // Ensure the blog belongs to the user
        const blog = await global.db.collection('blogInfos').findOne({ _id: new ObjectId(blogId), userId: new ObjectId(req.user._id) });
        if (!blog) {
            return res.status(404).json({ success: false, message: 'ブログが見つからないか、アクセス権がありません。' });
        }
        
        // Delete all cached analysis results for this blog
        const result = await TrendAnalysisResult.deleteMany({ blogId: new ObjectId(blogId) });
        
        res.json({
            success: true,
            message: `${result.deletedCount}件のキャッシュされた分析結果が削除されました。`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error clearing cached analysis results:', error);
        res.status(500).json({ success: false, message: 'キャッシュされた分析結果の削除中にエラーが発生しました。' });
    }
});

module.exports = router;
