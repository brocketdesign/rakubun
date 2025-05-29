const cron = require('node-cron');
const { ObjectId } = require('mongodb');
const { fetchBlogPosts, updatePostContent, getWordPressLanguage, getLanguageSpecificPrompt } = require('./post');
const { generateCompletion } = require('./openai');
const { sendNotificationToUser } = require('./websocket');

// アクティブなCronジョブを管理するマップ
const activeCronJobs = new Map();

/**
 * Cronジョブをスケジュールする
 * @param {string} blogId - ブログID
 * @param {string} frequency - 実行頻度 (hourly, daily, weekly)
 * @param {Object} blogData - ブログデータ
 */
async function scheduleCronJob(blogId, frequency, blogData) {
    try {
        console.log(`[Cron] ジョブスケジュール開始: ${blogId}, 頻度: ${frequency}`);
        
        // 既存のジョブがある場合はキャンセル
        if (activeCronJobs.has(blogId)) {
            console.log(`[Cron] 既存ジョブをキャンセル: ${blogId}`);
            activeCronJobs.get(blogId).destroy();
            activeCronJobs.delete(blogId);
        }

        // 頻度に応じたCron式を決定
        let cronExpression;
        switch (frequency) {
            case 'hourly':
                cronExpression = '0 * * * *'; // 毎時0分
                break;
            case 'two_daily':
                cronExpression = '0 9,21 * * *'; // 毎日午前9時と午後9時
                break;
            case 'tree_daily':
                cronExpression = '0 9,15,21 * * *'; // 毎日午前9時、午後3時、午後9時
                break;
            case 'daily':
                cronExpression = '0 9 * * *'; // 毎日午前9時
                break;
            case 'weekly':
                cronExpression = '0 9 * * 1'; // 毎週月曜日午前9時
                break;
            default:
                throw new Error(`無効な頻度指定: ${frequency}`);
        }

        // Cronジョブを作成
        const job = cron.schedule(cronExpression, async () => {
            console.log(`[Cron] 自動実行開始: ${blogId}`);
            
            try {
                // ブログの最新情報を取得
                const currentBlog = await global.db.collection('blogInfos')
                    .findOne({ _id: new ObjectId(blogId) });

                if (!currentBlog) {
                    console.error(`[Cron] ブログが見つかりません: ${blogId}`);
                    return;
                }

                // 要約処理を実行
                await executeAutomaticSummary(blogId, currentBlog);
                
            } catch (error) {
                console.error(`[Cron] 自動実行エラー: ${blogId}`, error);
                
                // エラーをWebSocketで通知
                if (blogData.userId) {
                    sendNotificationToUser(blogData.userId.toString(), 'blog-summary-error', {
                        blogId,
                        error: `自動実行エラー: ${error.message}`
                    });
                }
            }
        }, {
            scheduled: false // まだ開始しない
        });

        // ジョブを保存して開始
        activeCronJobs.set(blogId, job);
        job.start();

        console.log(`[Cron] ジョブスケジュール完了: ${blogId}`);
        
        // データベースにCronジョブ情報を保存
        await global.db.collection('blogSummaryCronJobs').updateOne(
            { blogId: blogId },
            {
                $set: {
                    blogId: blogId,
                    frequency: frequency,
                    cronExpression: cronExpression,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

    } catch (error) {
        console.error(`[Cron] ジョブスケジュールエラー: ${blogId}`, error);
        throw error;
    }
}

/**
 * Cronジョブをキャンセルする
 * @param {string} blogId - ブログID
 */
async function cancelCronJob(blogId) {
    try {
        console.log(`[Cron] ジョブキャンセル: ${blogId}`);
        
        // アクティブなジョブをキャンセル
        if (activeCronJobs.has(blogId)) {
            activeCronJobs.get(blogId).destroy();
            activeCronJobs.delete(blogId);
            console.log(`[Cron] アクティブジョブをキャンセル: ${blogId}`);
        }

        // データベースのCronジョブ情報を更新
        await global.db.collection('blogSummaryCronJobs').updateOne(
            { blogId: blogId },
            {
                $set: {
                    isActive: false,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`[Cron] ジョブキャンセル完了: ${blogId}`);
    } catch (error) {
        console.error(`[Cron] ジョブキャンセルエラー: ${blogId}`, error);
        throw error;
    }
}

/**
 * 自動要約実行
 * @param {string} blogId - ブログID
 * @param {Object} blogData - ブログデータ
 */
async function executeAutomaticSummary(blogId, blogData) {
    try {
        console.log(`[自動実行] 単一記事要約処理開始: ${blogId}`);
        
        // WebSocket通知: 開始
        sendNotificationToUser(blogData.userId.toString(), 'blog-summary-progress', {
            blogId,
            progress: 0,
            message: '自動要約を開始しています...'
        });

        // 最新の記事を取得
        const posts = await fetchBlogPosts(blogData, 50, 'asc');
        console.log(`[自動実行] ${posts.length}件の記事を取得`);

        if (posts.length === 0) {
            console.log(`[自動実行] 処理可能な記事がありません: ${blogId}`);
            return;
        }

        // システムプロンプトを取得（言語対応）
        const promptRecord = await global.db.collection('blogSummaryPrompts')
            .findOne({ userId: blogData.userId });
        
        let systemPrompt;
        if (promptRecord) {
            systemPrompt = promptRecord.prompt;
        } else {
            // WordPress言語を取得して適切なプロンプトを設定
            const wpLanguage = await getWordPressLanguage(blogData);
            console.log(`[自動実行] 検出された言語: ${wpLanguage}`);
            systemPrompt = getLanguageSpecificPrompt(wpLanguage);
        }

        // ブログ設定を取得
        const settings = await global.db.collection('blogSummarySettings')
            .findOne({ blogId: blogId }) || { position: 'top' };

        // 未処理の記事を検索（新しいものから優先）
        let targetPost = null;
        for (const post of posts) {
            try {
                // 既に要約済みかチェック
                const existingSummary = await global.db.collection('blogSummaryRecords')
                    .findOne({ blogId: blogId, postId: post.id.toString() });

                if (existingSummary) {
                    console.log(`[自動実行] 記事${post.id}は要約済みのためスキップ`);
                    continue;
                }

                // 記事が7日以内に公開されたもののみ処理対象とする
                const postDate = new Date(post.date);
                const now = new Date();
                const daysDiff = (now - postDate) / (1000 * 60 * 60 * 24);
                
                if (daysDiff > 7) {
                    console.log(`[自動実行] 記事${post.id}は7日以上前のためスキップ`);
                    continue;
                }

                targetPost = post;
                break;

            } catch (error) {
                console.error(`[自動実行] 記事${post.id}のチェックエラー:`, error);
            }
        }

        if (!targetPost) {
            console.log(`[自動実行] 処理対象の記事がありません: ${blogId}`);
            sendNotificationToUser(blogData.userId.toString(), 'blog-summary-complete', {
                blogId,
                result: { 
                    processedCount: 0, 
                    totalCount: posts.length,
                    message: '処理対象の記事がありません'
                }
            });
            return;
        }

        // プログレス通知
        sendNotificationToUser(blogData.userId.toString(), 'blog-summary-progress', {
            blogId,
            progress: 50,
            message: `記事「${targetPost.title}」を処理中...`
        });

        try {
            // 記事の要約を生成・挿入
            await processIndividualPost(blogId, targetPost, blogData, systemPrompt, settings.position);

            // 実行記録を保存
            await global.db.collection('blogSummaryExecutions').insertOne({
                blogId: blogId,
                userId: blogData.userId,
                executedAt: new Date(),
                processedCount: 1,
                totalCount: posts.length,
                isAutomatic: true,
                postId: targetPost.id.toString(),
                postTitle: targetPost.title
            });

            // 完了通知
            sendNotificationToUser(blogData.userId.toString(), 'blog-summary-complete', {
                blogId,
                result: { 
                    processedCount: 1, 
                    totalCount: posts.length,
                    processedPost: targetPost.title
                }
            });

            console.log(`[自動実行] 要約処理完了: ${blogId}, 記事: ${targetPost.id}`);

        } catch (error) {
            console.error(`[自動実行] 記事${targetPost.id}の処理エラー:`, error);
            throw error;
        }

    } catch (error) {
        console.error(`[自動実行] 要約処理エラー: ${blogId}`, error);
        
        // エラー通知
        sendNotificationToUser(blogData.userId.toString(), 'blog-summary-error', {
            blogId,
            error: `自動実行エラー: ${error.message}`
        });
    }
}

/**
 * 個別記事の要約処理
 * @param {string} blogId - ブログID
 * @param {Object} postData - 記事データ
 * @param {Object} blogData - ブログデータ
 * @param {string} systemPrompt - システムプロンプト
 * @param {string} position - 挿入位置
 */
async function processIndividualPost(blogId, postData, blogData, systemPrompt, position = 'top') {
    try {
        console.log(`[記事処理] 要約生成開始: ${postData.id}`);

        // HTMLタグを除去してテキストコンテンツを抽出
        const cleanContent = postData.content
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // 内容が短すぎる場合はスキップ
        if (cleanContent.length < 100) {
            console.log(`[記事処理] 内容が短すぎるためスキップ: ${postData.id}`);
            return;
        }

        // ユーザーメッセージを構成（言語対応）
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

        console.log(`[記事処理] AI要約生成開始: ${postData.id}`);

        // AI要約生成
        const summary = await generateCompletion(finalPrompt, 500);

        if (!summary || summary.trim() === '') {
            throw new Error('要約が生成されませんでした');
        }

        console.log(`[記事処理] AI要約生成完了: ${postData.id}`);

        // 要約をHTML形式でフォーマット
        const summaryHtml = formatSummaryHtml(summary);

        // 現在の記事内容を取得
        const currentContent = postData.content;
        
        // 既に要約が含まれているかチェック
        if (currentContent.includes('class="ai-summary"')) {
            console.log(`[記事処理] 既に要約が含まれているためスキップ: ${postData.id}`);
            return;
        }

        // 要約を適切な位置に挿入
        let updatedContent;
        if (position === 'top') {
            updatedContent = summaryHtml + '\n\n' + currentContent;
        } else {
            updatedContent = currentContent + '\n\n' + summaryHtml;
        }

        // WordPress記事を更新
        await updatePostContent(blogData, postData.id.toString(), updatedContent);

        // 要約記録を保存
        await global.db.collection('blogSummaryRecords').insertOne({
            blogId: blogId,
            postId: postData.id.toString(),
            userId: blogData.userId,
            summary: summary,
            position: position,
            createdAt: new Date(),
            postTitle: postData.title,
            postDate: new Date(postData.date)
        });

        console.log(`[記事処理] 要約処理完了: ${postData.id}`);

    } catch (error) {
        console.error(`[記事処理] 要約処理エラー: ${postData.id}`, error);
        throw error;
    }
}

/**
 * 要約をHTMLとしてフォーマット
 * @param {string} summary - 要約テキスト
 * @returns {string} フォーマットされたHTML
 */
function formatSummaryHtml(summary) {
    // 改行を<br>タグに変換
    const formattedSummary = summary
        .replace(/\n/g, '<br>')
        .replace(/•/g, '•') // 箇条書きの修正
        .replace(/　/g, ' '); // 全角スペースの修正

    return `<div class="ai-summary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; padding: 20px; margin: 25px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
    <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <h4 style="margin: 0; font-size: 1.2em; font-weight: 600;">AI記事要約</h4>
    </div>
    <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; line-height: 1.7; font-size: 1em;">
        ${formattedSummary}
    </div>
    <div style="margin-top: 15px; font-size: 0.85em; opacity: 0.8; text-align: right;">
        <em>✨ この要約はAIによって自動生成されました</em>
    </div>
</div>`;
}

/**
 * デフォルトの要約プロンプトを取得（言語対応）
 * @param {string} language - 言語コード
 * @returns {string} デフォルトプロンプト
 */
function getDefaultPrompt(language = 'en') {
    return getLanguageSpecificPrompt(language);
}

/**
 * 起動時にアクティブなCronジョブを復元
 */
async function restoreActiveCronJobs() {
    try {
        console.log('[Cron] アクティブなCronジョブを復元中...');
        
        // アクティブなCronジョブを取得
        const activeCronJobRecords = await global.db.collection('blogSummaryCronJobs')
            .find({ isActive: true })
            .toArray();

        console.log(`[Cron] ${activeCronJobRecords.length}件のアクティブなジョブを発見`);

        for (const jobRecord of activeCronJobRecords) {
            try {
                // ブログ情報を取得
                const blog = await global.db.collection('blogInfos')
                    .findOne({ _id: new ObjectId(jobRecord.blogId) });

                if (blog) {
                    await scheduleCronJob(jobRecord.blogId, jobRecord.frequency, blog);
                    console.log(`[Cron] ジョブ復元完了: ${jobRecord.blogId}`);
                } else {
                    console.log(`[Cron] ブログが見つからないためジョブを無効化: ${jobRecord.blogId}`);
                    await cancelCronJob(jobRecord.blogId);
                }
            } catch (error) {
                console.error(`[Cron] ジョブ復元エラー: ${jobRecord.blogId}`, error);
            }
        }

        console.log('[Cron] Cronジョブ復元完了');
    } catch (error) {
        console.error('[Cron] Cronジョブ復元中にエラー:', error);
    }
}

/**
 * 統計情報を取得
 * @param {string} userId - ユーザーID
 * @returns {Object} 統計情報
 */
async function getSummaryStats(userId) {
    try {
        const userObjectId = new ObjectId(userId);
        
        // 要約記録の統計
        const totalSummaries = await global.db.collection('blogSummaryRecords')
            .countDocuments({ userId: userObjectId });

        // 今日の要約数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaySummaries = await global.db.collection('blogSummaryRecords')
            .countDocuments({
                userId: userObjectId,
                createdAt: { $gte: today, $lt: tomorrow }
            });

        // アクティブなCronジョブ数
        const activeCronJobs = await global.db.collection('blogSummaryCronJobs')
            .countDocuments({ isActive: true });

        return {
            totalSummaries,
            todaySummaries,
            activeCronJobs
        };
    } catch (error) {
        console.error('[統計] 統計情報取得エラー:', error);
        return {
            totalSummaries: 0,
            todaySummaries: 0,
            activeCronJobs: 0
        };
    }
}

module.exports = {
    scheduleCronJob,
    cancelCronJob,
    executeAutomaticSummary,
    processIndividualPost,
    formatSummaryHtml,
    getDefaultPrompt,
    restoreActiveCronJobs,
    getSummaryStats
};
