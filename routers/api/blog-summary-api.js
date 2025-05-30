const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const ensureAuthenticated = require('../../middleware/authMiddleware');
const { fetchBlogPosts, fetchSingleBlogPost, updatePostContent, getWordPressLanguage, getLanguageSpecificPrompt } = require('../../modules/post');
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
            cronFrequency: settings ? settings.cronFrequency : 'daily',
            order: settings ? settings.order : 'asc'
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
        const { position, cronEnabled, cronFrequency, order } = req.body;
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
                    order: order || 'asc',
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

        // ブログ設定を取得（順序設定を含む）
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId });
        
        const order = settings ? settings.order || 'asc' : 'asc';

        // WordPressから記事を取得（設定された順序で）
        const posts = await fetchBlogPosts(blog, 20, order);

        // 要約済みかどうかチェック（postIdを文字列として比較）
        const postsWithSummaryStatus = await Promise.all(posts.map(async (post) => {
            const summaryRecord = await global.db.collection('blogSummaryRecords')
                .findOne({ 
                    blogId: blogId, 
                    postId: post.id.toString() // 文字列として検索
                });

            console.log(`[API] 記事${post.id}の要約チェック: ${summaryRecord ? '要約済み' : '未処理'}`);

            return {
                ...post,
                hasSummary: !!summaryRecord
            };
        }));

        console.log(`[API] ${postsWithSummaryStatus.length}件の記事を取得 (順序: ${order})`);
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

        // 非同期で個別記事の要約処理を実行（postDataは渡さない）
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
            message: '処理を開始しています...'
        });

        // 記事一覧を取得（古い順）
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 5,
            message: '記事一覧の取得を準備中...'
        });

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 10,
            message: '記事一覧を取得中...'
        });

        const posts = await fetchBlogPosts(blog, 50, 'asc'); // 最古50件を古い順で取得
        console.log(`[処理] ${posts.length}件の記事を取得`);

        if (posts.length === 0) {
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 100,
                message: '処理完了: 記事が見つかりませんでした'
            });
            
            sendNotificationToUser(userIdString, 'blog-summary-error', {
                blogId,
                error: '処理可能な記事が見つかりません'
            });
            return;
        }

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 15,
            message: `${posts.length}件の記事を取得しました`
        });

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 20,
            message: `${posts.length}件の記事を取得しました。未処理記事を検索中...`
        });

        // 未処理の記事を検索（古い順）
        let targetPost = null;
        let checkedCount = 0;
        for (const post of posts) {
            checkedCount++;
            const existingSummary = await global.db.collection('blogSummaryRecords')
                .findOne({ blogId: blogId, postId: post.id.toString() });

            if (!existingSummary) {
                targetPost = post;
                break;
            }

            // 進捗を更新（20-40%の範囲で）
            const checkProgress = 20 + (checkedCount / posts.length) * 20;
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: Math.round(checkProgress),
                message: `記事をチェック中... (${checkedCount}/${posts.length})`
            });
        }

        if (!targetPost) {
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 100,
                message: '処理完了: 全ての記事が既に処理済みです'
            });
            
            sendNotificationToUser(userIdString, 'blog-summary-complete', {
                blogId,
                result: { processedCount: 0, totalCount: posts.length, message: '全ての記事が処理済みです' }
            });
            return;
        }

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 40,
            message: `処理対象記事を発見: 「${targetPost.title}」`
        });

        // システムプロンプトを取得
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 45,
            message: 'システムプロンプトの取得準備中...'
        });
        
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 50,
            message: 'システムプロンプトを取得中...'
        });

        const promptRecord = await global.db.collection('blogSummaryPrompts')
            .findOne({ userId: userId });
        
        const systemPrompt = promptRecord ? promptRecord.prompt : `記事を簡潔で分かりやすく要約してください。主要なポイントを3-5つの箇条書きで示し、読者にとって有益な情報を抽出してください。`;

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 55,
            message: 'システムプロンプトを取得しました。ブログ設定を取得中...'
        });

        // ブログ設定を取得
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId }) || { position: 'top' };

        // プログレス通知
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 60,
            message: `記事「${targetPost.title}」のAI要約を生成中...`
        });

        try {
            // 記事の要約を生成
            await processPostSummary(blogId, targetPost.id.toString(), blog, userId, userIdString, targetPost, systemPrompt, settings.position);

            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 85,
                message: '要約処理が完了しました。実行記録を準備中...'
            });

            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 90,
                message: '実行記録を保存中...'
            });

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

            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 100,
                message: '処理が完了しました'
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
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 100,
            message: `エラーが発生しました: ${error.message}`
        });
        
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
        
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 5,
            message: '個別記事の要約処理を開始しています...'
        });

        // ブログ設定を取得（position設定も含む）
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId });
        
        // positionパラメータが渡されていない場合は設定から取得
        if (position === 'top' && settings && settings.position) {
            position = settings.position;
            console.log(`[処理] 設定から挿入位置を取得: ${position}`);
        }

        // 記事データが提供されていない場合は直接WordPressから取得
        if (!postData) {
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 10,
                message: '記事データを取得中...'
            });

            try {
                // WordPress APIから直接記事を取得
                postData = await fetchSingleBlogPost(blog, postId);
                console.log(`[処理] WordPress APIから記事を取得成功: ${postId}`);
                
                sendNotificationToUser(userIdString, 'blog-summary-progress', {
                    blogId,
                    progress: 15,
                    message: '記事データを取得しました'
                });
            } catch (error) {
                console.log(`[処理] WordPress APIからの記事取得失敗: ${postId}`, error);
                sendNotificationToUser(userIdString, 'blog-summary-progress', {
                    blogId,
                    progress: 100,
                    message: `エラー: 記事の取得に失敗しました`
                });
            }
        }

        // システムプロンプトが提供されていない場合は言語に応じたプロンプトを取得
        if (!systemPrompt) {
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 20,
                message: 'システムプロンプトを設定中...'
            });

            const promptRecord = await global.db.collection('blogSummaryPrompts')
                .findOne({ userId: userId });
            
            if (promptRecord) {
                systemPrompt = promptRecord.prompt;
                sendNotificationToUser(userIdString, 'blog-summary-progress', {
                    blogId,
                    progress: 25,
                    message: 'カスタムプロンプトを使用します'
                });
            } else {
                // WordPress言語を取得
                sendNotificationToUser(userIdString, 'blog-summary-progress', {
                    blogId,
                    progress: 22,
                    message: 'WordPress言語を検出中...'
                });
                
                const wpLanguage = await getWordPressLanguage(blog);
                console.log(`[処理] 検出された言語: ${wpLanguage}`);
                
                // 言語固有のプロンプトを取得
                const languagePrompt = getLanguageSpecificPrompt(wpLanguage);
                systemPrompt = languagePrompt.replace('{{TITLE}}', postData.title).replace('{{CONTENT}}', '{{CONTENT}}');
                
                sendNotificationToUser(userIdString, 'blog-summary-progress', {
                    blogId,
                    progress: 25,
                    message: `言語(${wpLanguage})に適したプロンプトを使用します`
                });
            }
        }

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 30,
            message: '記事内容を解析中...'
        });

        // HTMLタグを除去してテキストコンテンツを抽出
        const cleanContent = postData.content
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .trim();

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 40,
            message: '記事内容の解析完了。要約プロンプトを準備中...'
        });

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

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 45,
            message: 'AIへのリクエストを準備中...'
        });

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 50,
            message: 'AI要約を生成中... (これには少し時間がかかる場合があります)'
        });

        console.log(`[処理] AI要約生成開始: ${postId}`);

        // AI要約生成
        const summary = await generateCompletion(finalPrompt, 500);

        console.log(`[処理] AI要約生成完了: ${postId}`);
        console.log(`[要約] ${summary}`);

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 65,
            message: 'AI要約が生成されました。記事に挿入準備中...'
        });

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 70,
            message: '要約をWordPress記事に挿入中...'
        });

        // 要約をWordPress記事に挿入
        const summaryHtml = `<div class="ai-summary" style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h4 style="margin-bottom: 10px; font-size: 1.1em;">記事要約</h4>
            <div style="line-height: 1.6;">${summary.replace(/\n/g, '<br>')}</div>
        </div>`;

        console.log(`[処理] 要約HTML生成: ${summaryHtml.substring(0, 100)}...`);
        console.log(`[処理] 挿入位置: ${position}`);

        // 現在の記事内容を取得
        const currentContent = postData.content;
        console.log(`[処理] 現在の記事内容長: ${currentContent ? currentContent.length : 0}文字`);
        
        // 既に要約が含まれているかチェック
        if (currentContent.includes('class="ai-summary"')) {
            console.log(`[処理] 記事${postId}には既に要約が含まれています`);
            
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 80,
                message: '記事には既に要約が含まれています。記録を更新します...'
            });
            
            // 要約記録を保存（重複実行防止のため）
            await global.db.collection('blogSummaryRecords').updateOne(
                { blogId: blogId, postId: postId.toString() },
                {
                    $set: {
                        blogId: blogId,
                        postId: postId.toString(),
                        userId: userId,
                        summary: summary,
                        position: position,
                        updatedAt: new Date(),
                        postTitle: postData.title,
                        postUrl: postData.link || `${blog.blogUrl}/?p=${postId}`,
                        note: '要約は既に記事に含まれています'
                    }
                },
                { upsert: true }
            );
            
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 100,
                message: '処理が完了しました: 記事には既に要約が含まれています'
            });
            
            sendNotificationToUser(userIdString, 'blog-summary-complete', {
                blogId,
                result: {
                    processedCount: 1,
                    processedPost: postData.title,
                    note: '記事には既に要約が含まれています'
                }
            });
            
            return;
        }
        
        // 要約を適切な位置に挿入
        let updatedContent;
        if (position === 'bottom') {
            console.log(`[処理] 要約を記事の下部に挿入`);
            updatedContent = currentContent + summaryHtml;
        } else {
            console.log(`[処理] 要約を記事の上部に挿入`);
            updatedContent = summaryHtml + currentContent;
        }

        console.log(`[処理] 更新後の記事内容長: ${updatedContent ? updatedContent.length : 0}文字`);

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 75,
            message: 'WordPress記事を更新中...'
        });

        try {
            // WordPress記事を更新
            console.log(`[処理] WordPress記事更新開始: ${postId}`);
            const updateResult = await updatePostContent(blog, postId, updatedContent);
            console.log(`[処理] WordPress記事更新完了: ${postId}`, updateResult);
            
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 85,
                message: 'WordPress記事の更新が完了しました'
            });
            
        } catch (updateError) {
            console.error(`[処理] WordPress記事更新エラー: ${postId}`, updateError);
            sendNotificationToUser(userIdString, 'blog-summary-progress', {
                blogId,
                progress: 100,
                message: `エラー: 記事の更新に失敗しました`
            });
        }

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 90,
            message: '要約記録を保存中...'
        });

        // 要約記録を保存（必ずpostIdを文字列として保存）
        const summaryRecord = {
            blogId: blogId,
            postId: postId.toString(), // 文字列として保存
            userId: userId,
            summary: summary,
            position: position,
            createdAt: new Date(),
            postTitle: postData.title,
            postUrl: postData.link || `${blog.blogUrl}/?p=${postId}`
        };

        console.log(`[処理] 要約記録保存: blogId=${blogId}, postId=${postId.toString()}`);
        
        const insertResult = await global.db.collection('blogSummaryRecords').insertOne(summaryRecord);
        console.log(`[処理] 要約記録保存完了:`, insertResult.insertedId);

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 95,
            message: '要約記録の保存が完了しました'
        });

        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 100,
            message: '記事「' + postData.title + '」の要約処理が完了しました'
        });

        sendNotificationToUser(userIdString, 'blog-summary-complete', {
            blogId,
            result: { 
                processedCount: 1, 
                processedPost: postData.title,
                success: true
            }
        });

        console.log(`[処理] 個別記事要約完了: ${postId}`);

    } catch (error) {
        console.error(`[処理] 個別記事要約エラー: ${postId}`, error);
        
        // エラー通知
        sendNotificationToUser(userIdString, 'blog-summary-progress', {
            blogId,
            progress: 100,
            message: `エラー: ${error.message}`
        });
        
        sendNotificationToUser(userIdString, 'blog-summary-error', {
            blogId,
            error: `記事${postId}の要約処理エラー: ${error.message}`
        });
        
        throw error;
    }
}

module.exports = router;
