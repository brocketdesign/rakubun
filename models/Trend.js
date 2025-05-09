const mongoose = require('mongoose');

const trendSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    tweetCount: {
        type: String, // Store as string as it often contains text like "件のツイート"
        trim: true
    },
    source: {
        type: String,
        required: true,
        default: 'twittrend.jp'
    },
    region: {
        type: String,
        default: 'Japan'
    },
    scrapedAt: {
        type: Date,
        default: Date.now
    },
    trendTime: { // To distinguish between "current", "1 hour ago" etc. if needed
        type: String,
        default: 'current'
    }
});

// Compound index to avoid duplicate entries for the same trend name from the same scrape time (or source/region/trendTime)
trendSchema.index({ name: 1, source: 1, region: 1, trendTime: 1, scrapedAt: -1 }); // Unique for a given scrape batch

const Trend = mongoose.model('Trend', trendSchema);

module.exports = Trend;
