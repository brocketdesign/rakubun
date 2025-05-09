const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

/**
 * Schema for storing trend analysis results to avoid redundant processing
 */
const trendAnalysisResultSchema = new mongoose.Schema({
    blogId: {
        type: ObjectId,
        ref: 'BlogInfo',
        required: true
    },
    userId: {
        type: ObjectId,
        ref: 'User',
        required: true
    },
    trendName: {
        type: String,
        required: true
    },
    trendId: {
        type: ObjectId,
        ref: 'Trend',
        required: true
    },
    isRelevant: {
        type: Boolean,
        required: true
    },
    relevanceScore: {
        type: Number,
        min: 0,
        max: 1
    },
    reasoning: {
        type: String
    },
    suggestedAngle: {
        type: String
    },
    tweetCount: {
        type: String
    },
    scrapedAt: {
        type: Date
    },
    analyzedAt: {
        type: Date,
        default: Date.now
    },
    // To handle re-analysis after keyword updates, store current keywords used for this analysis
    keywordsUsed: [{
        type: String
    }],
    // Optional fields for optimization and filtering
    source: {
        type: String,
        default: 'twittrend.jp'
    },
    region: {
        type: String,
        default: 'Japan'
    }
});

// Create compound index on blogId and trendName for quick lookups
trendAnalysisResultSchema.index({ blogId: 1, trendName: 1 });
// Index on userId for user-specific queries
trendAnalysisResultSchema.index({ userId: 1 });
// Index on analyzedAt for cleaning up/time-based queries
trendAnalysisResultSchema.index({ analyzedAt: -1 });

const TrendAnalysisResult = mongoose.model('TrendAnalysisResult', trendAnalysisResultSchema);

module.exports = TrendAnalysisResult;