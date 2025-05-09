const Trend = require('../models/Trend');
const BlogInfo = require('../models/BlogInfo');
const TrendAnalysisResult = require('../models/TrendAnalysisResult'); // Add the new model
const { moduleCompletion } = require('./openai');
const { z } = require('zod');
const mongoose = require('mongoose');
const { sendNotificationToUser } = require('./websocket');

// Zod schema for the structured output from OpenAI
const TrendRelevanceSchema = z.object({
    is_relevant: z.boolean().describe("Whether the trend is relevant to the blog's keywords."),
    relevance_score: z.number().describe("A score from 0 (not relevant) to 1 (highly relevant). OpenAI will provide a number, further validation can be done after."),
    reasoning: z.string().describe("A brief explanation for the relevance assessment."),
    suggested_angle: z.string().optional().describe("A suggested angle or title for a blog post based on this trend and keywords.")
});

/**
 * Logs all blog IDs in the BlogInfo collection for debugging.
 */
async function logAllBlogIds() {
    try {
        console.log(`[trendMatcher.js] Mongoose connection state: ${mongoose.connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
        console.log(`[trendMatcher.js] Mongoose connected to DB: ${mongoose.connection.name}`);
        console.log(`[trendMatcher.js] Attempting to read from collection via Mongoose model: ${BlogInfo.collection.name}`);
        const blogsFromMongoose = await BlogInfo.find({}, { _id: 1, blogName: 1 }).lean();
        if (!blogsFromMongoose || blogsFromMongoose.length === 0) {
            console.log(`[trendMatcher.js] No blogs found in BlogInfo collection (checked via Mongoose model: ${BlogInfo.collection.name}).`);
        } else {
            console.log(`[trendMatcher.js] All Blog IDs (from Mongoose model):`);
            blogsFromMongoose.forEach(blog => {
                console.log(`[trendMatcher.js]   ID: ${blog._id} | Name: ${blog.blogName}`);
            });
        }
    } catch (error) {
        console.error('[trendMatcher.js] Error fetching blog IDs via Mongoose model:', error);
    }

    // Attempt to fetch using global.db if available (for comparison)
    if (global.db) {
        try {
            console.log('[trendMatcher.js] Attempting to read from collection via global.db: blogInfos');
            const blogsFromGlobalDb = await global.db.collection('blogInfos').find({}, { projection: { _id: 1, blogName: 1 } }).toArray();
            if (!blogsFromGlobalDb || blogsFromGlobalDb.length === 0) {
                console.log('[trendMatcher.js] No blogs found in blogInfos collection (checked via global.db).');
            } else {
                console.log(`[trendMatcher.js] All Blog IDs (from global.db.collection('blogInfos')):`);
                blogsFromGlobalDb.forEach(blog => {
                    console.log(`[trendMatcher.js]   ID: ${blog._id} | Name: ${blog.blogName}`);
                });
            }
        } catch (error) {
            console.error('[trendMatcher.js] Error fetching blog IDs via global.db:', error);
        }
    } else {
        console.log('[trendMatcher.js] global.db is not available in this context for comparison.');
    }
}

/**
 * Finds matching trends for a given blog based on its keywords using OpenAI.
 * @param {string} blogId - The ID of the blog.
 * @param {string} userId - The ID of the user requesting the analysis (for WebSocket notifications).
 * @param {boolean} forceReanalysis - If true, force new analysis even if cached results exist.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of relevant trends with scores.
 */
async function findMatchingTrendsForBlog(blogId, userId, forceReanalysis = false) {
    console.log(`[trendMatcher.js] Finding matching trends for blog ID: ${blogId} by user ${userId}. Force reanalysis: ${forceReanalysis}`);
    try {
        // Validate the blog ID format
        if (!blogId || typeof blogId !== 'string' || !mongoose.Types.ObjectId.isValid(blogId)) {
            console.error(`[trendMatcher.js] Invalid blog ID format: ${blogId}`);
            return { success: false, message: 'Invalid blog ID format.', matches: [] };
        }

        // Try to find the blog by ID
        const blog = await BlogInfo.findById(blogId).lean();
        
        if (!blog) {
            console.error(`[trendMatcher.js] Blog with ID ${blogId} not found.`);
            // Send error notification if needed
            return { success: false, message: 'Blog not found.', matches: [] };
        }

        const blogKeywords = blog.trendKeywords;
        if (!blogKeywords || blogKeywords.length === 0) {
            console.log(`[trendMatcher.js] No trend keywords set for blog ${blogId}.`);
            sendNotificationToUser(userId, 'trend_analysis_complete', { blogId: blogId, count: 0, allMatches: [], message: 'No trend keywords set for this blog.' });
            return { success: true, message: 'No trend keywords set for this blog.', matches: [] };
        }

        // 2. Fetch latest trends
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTrends = await Trend.aggregate([
            { $match: { scrapedAt: { $gte: twentyFourHoursAgo }, source: 'twittrend.jp' } },
            { $sort: { scrapedAt: -1, name: 1 } },
            {
                $group: {
                    _id: "$name",
                    latestScrape: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$latestScrape" } },
            { $limit: 20 }
        ]);

        if (!recentTrends || recentTrends.length === 0) {
            console.log('[trendMatcher.js] No recent trends found in the database.');
            sendNotificationToUser(userId, 'trend_analysis_complete', { blogId: blogId, count: 0, allMatches: [], message: 'No recent trends found to analyze.' });
            return { success: true, message: 'No recent trends found to analyze.', matches: [] };
        }

        console.log(`[trendMatcher.js] Fetched ${recentTrends.length} recent trends to analyze against keywords: ${blogKeywords.join(', ')} for blog ${blogId}`);

        // This will store our final relevant trends
        const relevantTrends = [];
        
        // Create a map of trend names for O(1) lookups
        const trendMap = new Map(recentTrends.map(trend => [trend.name, trend]));
        
        // Array to keep track of which trends need to be freshly analyzed
        const trendsToAnalyze = [];
        
        // Check for cached analysis results
        const trendNamesToCheck = recentTrends.map(trend => trend.name);
        
        if (!forceReanalysis) {
            console.log(`[trendMatcher.js] Checking for cached analysis results for blogId: ${blogId}, trendNames: [${trendNamesToCheck.join(', ')}] with keywords: [${blogKeywords.join(', ')}]`);
            // Query for existing analysis results that match our current trends and blog
            const cachedResults = await TrendAnalysisResult.find({
                blogId: new mongoose.Types.ObjectId(blogId),
                trendName: { $in: trendNamesToCheck },
                // Only use cached results if they were analyzed with the same keywords
                keywordsUsed: { $all: blogKeywords, $size: blogKeywords.length }
            }).lean();
            
            console.log(`[trendMatcher.js] Found ${cachedResults.length} cached analysis results for blog ${blogId}`);
            
            // Process cached results
            for (const cachedResult of cachedResults) {
                const trend = trendMap.get(cachedResult.trendName);
                
                if (!trend) {
                    console.log(`[trendMatcher.js] Cached result for trend "${cachedResult.trendName}" skipped as it's no longer in recent trends.`);
                    continue; 
                }
                
                console.log(`[trendMatcher.js] Using cached result for trend: "${cachedResult.trendName}", Relevant: ${cachedResult.isRelevant}`);
                // If the cached result indicates relevance, add to our results
                if (cachedResult.isRelevant) {
                    relevantTrends.push({
                        trendName: cachedResult.trendName,
                        tweetCount: trend.tweetCount,
                        scrapedAt: trend.scrapedAt,
                        source: trend.source,
                        relevance: {
                            is_relevant: cachedResult.isRelevant,
                            relevance_score: cachedResult.relevanceScore,
                            reasoning: cachedResult.reasoning,
                            suggested_angle: cachedResult.suggestedAngle
                        },
                        fromCache: true
                    });
                }
                
                // Send websocket notification for the cached result
                sendNotificationToUser(userId, 'trend_analysis_result', {
                    blogId: blogId,
                    trendName: cachedResult.trendName,
                    analysis: {
                        is_relevant: cachedResult.isRelevant,
                        relevance_score: cachedResult.relevanceScore,
                        reasoning: cachedResult.reasoning,
                        suggested_angle: cachedResult.suggestedAngle
                    },
                    isRelevant: cachedResult.isRelevant,
                    tweetCount: trend.tweetCount,
                    scrapedAt: trend.scrapedAt,
                    fromCache: true
                });
                
                // Remove this trend from the map so we don't analyze it again
                trendMap.delete(cachedResult.trendName);
            }
        } else {
            console.log(`[trendMatcher.js] Force reanalysis is true. Skipping cache check for blogId: ${blogId}.`);
        }
        
        // Any remaining trends in the map need to be analyzed
        trendsToAnalyze.push(...Array.from(trendMap.values()));
        console.log(`[trendMatcher.js] Analyzing ${trendsToAnalyze.length} new trends for blog ${blogId}`);

        // 3. Use OpenAI to evaluate relevance for each remaining trend
        for (const trend of trendsToAnalyze) {
            // Notify start of analysis for this trend
            sendNotificationToUser(userId, 'trend_analysis_start', { blogId: blogId, trendName: trend.name });

            const promptMessages = [
                {
                    role: "system",
                    content: `You are an expert content strategist. Your task is to determine if a given Japanese trend is relevant for a blog with specific keywords. Provide your answer in a structured JSON format matching the schema I provide.`
                },
                {
                    role: "user",
                    content: `Blog Keywords: ["${blogKeywords.join('", "')}"]\n\nTrend from twittrend.jp: "${trend.name}" (Tweet count: ${trend.tweetCount || 'N/A'})\n\nIs this trend relevant for a blog post targeting the keywords above? Consider the potential overlap, audience interest, and if a meaningful article can be created. If relevant, suggest a possible angle or title for the blog post in Japanese.`
                }
            ];

            let analysis = null;
            let isTrendRelevant = false;
            try {
                console.log(`[trendMatcher.js] Analyzing trend: "${trend.name}" for blog ${blogId} with OpenAI.`);
                analysis = await moduleCompletion(
                    { messages: promptMessages, model: 'gpt-4o' },
                    TrendRelevanceSchema
                );

                if (analysis && analysis.is_relevant && analysis.relevance_score > 0.3) {
                    isTrendRelevant = true;
                    relevantTrends.push({
                        trendName: trend.name,
                        tweetCount: trend.tweetCount,
                        scrapedAt: trend.scrapedAt,
                        source: trend.source,
                        relevance: {
                            is_relevant: analysis.is_relevant,
                            relevance_score: analysis.relevance_score,
                            reasoning: analysis.reasoning,
                            suggested_angle: analysis.suggested_angle
                        },
                        fromCache: false
                    });
                } else if (analysis) {
                    console.log(`Trend "${trend.name}" is NOT relevant or low score. Score: ${analysis?.relevance_score}. Reason: ${analysis?.reasoning}`);
                } else {
                    console.log(`No valid analysis returned for trend "${trend.name}".`);
                }

                // Save the analysis result to the database regardless of relevance
                if (analysis) {
                    const analysisResult = new TrendAnalysisResult({
                        blogId: new mongoose.Types.ObjectId(blogId),
                        userId: new mongoose.Types.ObjectId(userId),
                        trendName: trend.name,
                        trendId: trend._id,
                        isRelevant: isTrendRelevant,
                        relevanceScore: analysis.relevance_score,
                        reasoning: analysis.reasoning,
                        suggestedAngle: analysis.suggested_angle,
                        tweetCount: trend.tweetCount,
                        scrapedAt: trend.scrapedAt,
                        keywordsUsed: blogKeywords,
                        source: trend.source,
                        region: trend.region
                    });
                    
                    await analysisResult.save();
                    console.log(`[trendMatcher.js] Successfully saved TrendAnalysisResult for blog ${blogId}, trend "${trend.name}", result ID: ${analysisResult._id}, relevant: ${isTrendRelevant}`);
                }
            } catch (error) {
                console.error(`Error analyzing trend "${trend.name}" with OpenAI:`, error);
                analysis = { reasoning: `OpenAI analysis failed: ${error.message}` };
            }
            
            // Notify result of analysis for this trend
            sendNotificationToUser(userId, 'trend_analysis_result', {
                blogId: blogId,
                trendName: trend.name,
                analysis: analysis,
                isRelevant: isTrendRelevant,
                tweetCount: trend.tweetCount,
                scrapedAt: trend.scrapedAt
            });
        }

        // Sort by relevance score
        relevantTrends.sort((a, b) => b.relevance.relevance_score - a.relevance.relevance_score);

        console.log(`Found ${relevantTrends.length} relevant trends for blog ${blogId}.`);
        // Notify completion of all analyses for this blog
        sendNotificationToUser(userId, 'trend_analysis_complete', {
            blogId: blogId,
            count: relevantTrends.length,
            allMatches: relevantTrends,
            message: 'Successfully analyzed trends.'
        });
        return { success: true, matches: relevantTrends, message: 'Successfully analyzed trends.' };

    } catch (error) {
        console.error('Error in findMatchingTrendsForBlog:', error);
        // Notify about the general error if possible
        if (userId && blogId) {
            sendNotificationToUser(userId, 'trend_analysis_error', { blogId: blogId, message: `Error finding matching trends: ${error.message}` });
        }
        return { success: false, message: `Error finding matching trends: ${error.message}`, matches: [] };
    }
}

module.exports = { findMatchingTrendsForBlog, TrendRelevanceSchema, logAllBlogIds };
