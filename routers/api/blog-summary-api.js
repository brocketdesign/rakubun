const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { fetchBlogPosts, updatePostContent, getWordPressLanguage, getLanguageSpecificPrompt } = require('../../modules/post');
const { generateCompletion } = require('../../modules/openai');
const { sendNotificationToUser } = require('../../modules/websocket');
const { scheduleCronJob, cancelCronJob } = require('../../modules/blog-summary-utils');

// ユーザーのブログ一覧を取得
router.get('/user-blogs', ensureAuthenticated, async (req, res) => {
    try {
        console.log('[API] ユーザーブログ一覧取得開始');
        const userId = new ObjectId(req.user._id);
        
        // blogInfosコレクションからユーザーのブログを取得
        const blogs = await global.db.collection('blogInfos')
            .find({ userId: userId })
            .sort({ _id: -1 })
            .toArray();

        console.log(`[API] ${blogs.length}件のブログを取得`);

        // 各ブログの要約設定と最終実行日を取得
        const blogsWithSummaryInfo = await Promise.all(blogs.map(async (blog) => {
            try {
                // 要約設定を取得
                const summarySettings = await global.db.collection('blogSummarySettings')
                    .findOne({ blogId: blog._id.toString() }) || {};

                // 最終実行日を取得
                const lastExecution = await global.db.collection('blogSummaryExecutions')
                    .findOne(
                        { blogId: blog._id.toString() },
                        { sort: { executedAt: -1 } }
                    );

                return {
                    ...blog,
                    summarySettings: {
                        position: summarySettings.position || 'top',
                        cronEnabled: summarySettings.cronEnabled || false,
                        cronFrequency: summarySettings.cronFrequency || 'daily'
                    },
                    lastSummaryDate: lastExecution ? lastExecution.executedAt : null,
                    cronEnabled: summarySettings.cronEnabled || false,
                    cronFrequency: summarySettings.cronFrequency || 'daily'
                };
            } catch (error) {
                console.error(`[API] ブログ${blog._id}の追加情報取得エラー:`, error);
                return blog;
            }
        }));

        res.json(blogsWithSummaryInfo);
    } catch (error) {
        console.error('[API] ユーザーブログ一覧取得エラー:', error);
        res.status(500).json({ error: 'ブログ一覧の取得に失敗しました' });
    }
});

// システムプロンプト取得
router.get('/system-prompt', ensureAuthenticated, async (req, res) => {
    try {
        console.log('[API] システムプロンプト取得');
        const userId = new ObjectId(req.user._id);
        
        const systemPrompt = await global.db.collection('blogSummaryPrompts')
            .findOne({ userId: userId });

        res.json({
            prompt: systemPrompt ? systemPrompt.prompt : `以下の記事を簡潔で分かりやすく要約してください。主要なポイントを3-5つの箇条書きで示し、読者にとって有益な情報を抽出してください。

記事タイトル: {{TITLE}}

記事内容:
{{CONTENT}}

要約:`
        });
    } catch (error) {
        console.error('[API] システムプロンプト取得エラー:', error);
        res.status(500).json({ error: 'システムプロンプトの取得に失敗しました' });
    }
});

// システムプロンプト保存
router.post('/system-prompt', ensureAuthenticated, async (req, res) => {
    try {
        console.log('[API] システムプロンプト保存');
        const userId = new ObjectId(req.user._id);
        const { prompt } = req.body;

        if (!prompt || prompt.trim() === '') {
            return res.status(400).json({ error: 'プロンプトが空です' });
        }

        await global.db.collection('blogSummaryPrompts').updateOne(
            { userId: userId },
            {
                $set: {
                    userId: userId,
                    prompt: prompt.trim(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        console.log('[API] システムプロンプト保存成功');
        res.json({ success: true });
    } catch (error) {
        console.error('[API] システムプロンプト保存エラー:', error);
        res.status(500).json({ error: 'システムプロンプトの保存に失敗しました' });
    }
});

// ブログ設定取得
router.get('/settings/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] ブログ設定取得: ${req.params.blogId}`);
        const blogId = req.params.blogId;
        
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId });

        res.json({
            position: settings ? settings.position : 'top',
            cronEnabled: settings ? settings.cronEnabled : false,
            cronFrequency: settings ? settings.cronFrequency : 'daily'
        });
    } catch (error) {
        console.error('[API] ブログ設定取得エラー:', error);
        res.status(500).json({ error: 'ブログ設定の取得に失敗しました' });
    }
});

// ブログ設定保存
router.post('/settings/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] ブログ設定保存: ${req.params.blogId}`);
        const blogId = req.params.blogId;
        const { position, cronEnabled, cronFrequency } = req.body;
        const userId = new ObjectId(req.user._id);

        // ブログの所有者確認
        const blog = await global.db.collection('blogInfos')
            .findOne({ _id: new ObjectId(blogId), userId: userId });

        if (!blog) {
            return res.status(404).json({ error: 'ブログが見つかりません' });
        }

        // 設定を保存
        await global.db.collection('blogSummarySettings').updateOne(
            { blogId: blogId },
            {
                $set: {
                    blogId: blogId,
                    userId: userId,
                    position: position,
                    cronEnabled: cronEnabled,
                    cronFrequency: cronFrequency,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // Cronジョブの管理
        if (cronEnabled) {
            console.log(`[API] Cronジョブスケジュール: ${blogId}, ${cronFrequency}`);
            await scheduleCronJob(blogId, cronFrequency, blog);
        } else {
            console.log(`[API] Cronジョブキャンセル: ${blogId}`);
            await cancelCronJob(blogId);
        }

        console.log('[API] ブログ設定保存成功');
        res.json({ success: true });
    } catch (error) {
        console.error('[API] ブログ設定保存エラー:', error);
        res.status(500).json({ error: 'ブログ設定の保存に失敗しました' });
    }
});

// ブログの記事一覧取得
router.get('/posts/:blogId', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] ブログ記事一覧取得: ${req.params.blogId}`);
        const blogId = req.params.blogId;
        const userId = new ObjectId(req.user._id);

        // ブログの所有者確認
        const blog = await global.db.collection('blogInfos')
            .findOne({ _id: new ObjectId(blogId), userId: userId });

        if (!blog) {
            return res.status(404).json({ error: 'ブログが見つかりません' });
        }

        // WordPressから記事を取得（古い順）
        const posts = await fetchBlogPosts(blog, 20, 'asc'); // 最古20件を古い順で取得

        // 要約済みかどうかチェック
        const postsWithSummaryStatus = await Promise.all(posts.map(async (post) => {
            const summaryRecord = await global.db.collection('blogSummaryRecords')
                .findOne({ blogId: blogId, postId: post.id.toString() });

            return {
                ...post,
                hasSummary: !!summaryRecord
            };
        }));

        console.log(`[API] ${postsWithSummaryStatus.length}件の記事を取得`);
        res.json(postsWithSummaryStatus);
    } catch (error) {
        console.error('[API] ブログ記事一覧取得エラー:', error);
        res.status(500).json({ error: '記事一覧の取得に失敗しました' });
    }
});

// 手動要約実行（ブログ全体）
router.post('/manual-run', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] 手動要約実行開始`);
        const { blogId } = req.body;
        const userId = new ObjectId(req.user._id);

        if (!blogId) {
            return res.status(400).json({ error: 'ブログIDが必要です' });
        }

        // ブログの所有者確認
        const blog = await global.db.collection('blogInfos')
            .findOne({ _id: new ObjectId(blogId), userId: userId });

        if (!blog) {
            return res.status(404).json({ error: 'ブログが見つかりません' });
        }

        // 非同期で単一記事の要約処理を実行
        processSingleBlogSummary(blogId, blog, userId, req.user._id);

        res.json({ success: true, message: '次の記事の要約処理を開始しました' });
    } catch (error) {
        console.error('[API] 手動要約実行エラー:', error);
        res.status(500).json({ error: '要約処理の開始に失敗しました' });
    }
});

// 個別記事の手動要約
router.post('/manual-post', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] 個別記事手動要約開始`);
        const { blogId, postId } = req.body;
        const userId = new ObjectId(req.user._id);

        if (!blogId || !postId) {
            return res.status(400).json({ error: 'ブログIDと記事IDが必要です' });
        }

        // ブログの所有者確認
        const blog = await global.db.collection('blogInfos')
            .findOne({ _id: new ObjectId(blogId), userId: userId });

        if (!blog) {
            return res.status(404).json({ error: 'ブログが見つかりません' });
        }

        // 非同期で個別記事の要約処理を実行
        processPostSummary(blogId, postId, blog, userId, req.user._id);

        res.json({ success: true, message: '記事の要約処理を開始しました' });
    } catch (error) {
        console.error('[API] 個別記事手動要約エラー:', error);
        res.status(500).json({ error: '記事の要約処理開始に失敗しました' });
    }
});

// 全ブログ要約実行
router.post('/refresh-all', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`[API] 全ブログ要約実行開始`);
        const userId = new ObjectId(req.user._id);

        // ユーザーの全ブログを取得
        const blogs = await global.db.collection('blogInfos')
            .find({ userId: userId })
            .toArray();

        if (blogs.length === 0) {
            return res.status(404).json({ error: 'ブログが見つかりません' });
        }

        // 各ブログの単一記事要約処理を非同期で実行
        blogs.forEach(blog => {
            processSingleBlogSummary(blog._id.toString(), blog, userId, req.user._id);
        });

        res.json({ success: true, message: `${blogs.length}件のブログで次の記事の要約処理を開始しました` });
    } catch (error) {
        console.error('[API] 全ブログ要約実行エラー:', error);
        res.status(500).json({ error: '全ブログの要約処理開始に失敗しました' });
    }
});

// ブログ要約処理（非同期） - 単一記事版
async function processSingleBlogSummary(blogId, blog, userId, userIdString) {
    try {
        console.log(`[処理] 単一記事要約開始: ${blogId}`);
        
        // WebSocket通知: 開始
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 0,
            message: '次の記事を検索中...'
        });

        // 記事一覧を取得（古い順）
        const posts = await fetchBlogPosts(blog, 50, 'asc'); // 最古50件を古い順で取得
        console.log(`[処理] ${posts.length}件の記事を取得`);

        if (posts.length === 0) {
            sendNotificationToUser(userIdString, 'blog-summary-error', {
                blogId,
                error: '処理可能な記事が見つかりません'
            });
            return;
        }

        // 未処理の記事を検索（古い順）
        let targetPost = null;
        for (const post of posts) {
            const existingSummary = await global.db.collection('blogSummaryRecords')
                .findOne({ blogId: blogId, postId: post.id.toString() });

            if (!existingSummary) {
                targetPost = post;
                break;
            }
        }

        if (!targetPost) {
            sendNotificationToUser(userIdString, 'blog-summary-complete', {
                blogId,
                result: { processedCount: 0, totalCount: posts.length, message: '全ての記事が処理済みです' }
            });
            return;
        }

        // システムプロンプトを取得
        const promptRecord = await global.db.collection('blogSummaryPrompts')
            .findOne({ userId: userId });
        
        const systemPrompt = promptRecord ? promptRecord.prompt : `記事を簡潔で分かりやすく要約してください。主要なポイントを3-5つの箇条書きで示し、読者にとって有益な情報を抽出してください。`;

        // ブログ設定を取得
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId }) || { position: 'top' };

        // プログレス通知
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 50,
            message: `記事「${targetPost.title}」を処理中...`
        });

        try {
            // 記事の要約を生成
            await processPostSummary(blogId, targetPost.id.toString(), blog, userId, userIdString, targetPost, systemPrompt, settings.position);

            // 実行記録を保存
            await global.db.collection('blogSummaryExecutions').insertOne({
                blogId: blogId,
                userId: userId,
                executedAt: new Date(),
                processedCount: 1,
                totalCount: posts.length,
                postId: targetPost.id.toString(),
                postTitle: targetPost.title
            });

            // 完了通知
            sendNotificationToUser(userIdString, 'blog-summary-complete', {
                blogId,
                result: { 
                    processedCount: 1, 
                    totalCount: posts.length,
                    processedPost: targetPost.title
                }
            });

            console.log(`[処理] 単一記事要約完了: ${blogId}, 記事: ${targetPost.id}`);

        } catch (error) {
            console.error(`[処理] 記事${targetPost.id}の処理エラー:`, error);
            throw error;
        }

    } catch (error) {
        console.error(`[処理] 単一記事要約エラー: ${blogId}`, error);
        sendNotificationToUser(userIdString, 'blog-summary-error', {
            blogId,
            error: error.message
        });
    }
}

// 個別記事要約処理（非同期）
async function processPostSummary(blogId, postId, blog, userId, userIdString, postData = null, systemPrompt = null, position = 'top') {
    try {
        console.log(`[処理] 個別記事要約開始: ${postId}`);

        // 記事データが提供されていない場合は取得
        if (!postData) {
            const posts = await fetchBlogPosts(blog, 100, 'asc'); // 古い順で取得
            postData = posts.find(p => p.id.toString() === postId);
            
            if (!postData) {
                throw new Error('記事が見つかりません');
            }
        }

        // システムプロンプトが提供されていない場合は言語に応じたプロンプトを取得
        if (!systemPrompt) {
            const promptRecord = await global.db.collection('blogSummaryPrompts')
                .findOne({ userId: userId });
            
            if (promptRecord) {
                systemPrompt = promptRecord.prompt;
            } else {
                // WordPress言語を取得
                const wpLanguage = await getWordPressLanguage(blog);
                console.log(`[処理] 検出された言語: ${wpLanguage}`);
                
                // 言語固有のプロンプトを取得
                const languagePrompt = getLanguageSpecificPrompt(wpLanguage);
                systemPrompt = languagePrompt.replace('{{TITLE}}', postData.title).replace('{{CONTENT}}', '{{CONTENT}}');
            }
        }

        // HTMLタグを除去してテキストコンテンツを抽出
        const cleanContent = postData.content
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .trim();

        // ユーザーメッセージを構成
        const userMessage = systemPrompt.includes('{{TITLE}}') && systemPrompt.includes('{{CONTENT}}') 
            ? systemPrompt.replace('{{TITLE}}', postData.title).replace('{{CONTENT}}', cleanContent)
            : `記事タイトル: ${postData.title}

記事内容:
${cleanContent}

上記の記事を要約してください。`;

        // プロンプトを配列形式で構成
        const finalPrompt = systemPrompt.includes('{{TITLE}}') && systemPrompt.includes('{{CONTENT}}')
            ? [{ role: "user", content: userMessage }]
            : [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ];

        console.log(`[処理] AI要約生成開始: ${postId}`);

        // AI要約生成
        const summary = await generateCompletion(finalPrompt, 500);

        console.log(`[処理] AI要約生成完了: ${postId}`);
        console.log(`[要約] ${summary}`);
        // 要約をWordPress記事に挿入
        const summaryHtml = `<div class="ai-summary" style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-bottom: 10px; font-size: 1.1em;">記事要約</h4>
            <div style="line-height: 1.6;">${summary.replace(/\n/g, '<br>')}</div>
        </div>`;

        // 現在の記事内容を取得
        const currentContent = postData.content;
        
        // 要約を適切な位置に挿入
        let updatedContent;
        if (position === 'top') {
            updatedContent = summaryHtml + currentContent;
        } else {
            updatedContent = currentContent + summaryHtml;
        }

        // WordPress記事を更新
        await updatePostContent(blog, postId, updatedContent);

        // 要約記録を保存
        await global.db.collection('blogSummaryRecords').insertOne({
            blogId: blogId,
            postId: postId,
            userId: userId,
            summary: summary,
            position: position,
            createdAt: new Date()
        });

        console.log(`[処理] 個別記事要約完了: ${postId}`);

    } catch (error) {
        console.error(`[処理] 個別記事要約エラー: ${postId}`, error);
        throw error;
    }
}

module.exports = router;
