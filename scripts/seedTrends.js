require('dotenv').config({ path: require('path').join(__dirname, '../.env') }); // Go up one level for .env
const mongoose = require('mongoose');
const { scrapeTwittrend } = require('../modules/trendScraper');
const Trend = require('../models/Trend');

async function seedTrends() {
    if (!process.env.MONGODB_URL) {
        console.error('Error: MONGODB_URL not found in .env file.');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully.');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }

    console.log('\n--- Starting Trend Scraping Test ---');
    try {
        const result = await scrapeTwittrend();
        console.log('\nScraping Result:');
        if (result.success) {
            console.log(`  Success: ${result.message}`);
            console.log(`  Trends Processed: ${result.count}`);
        } else {
            console.error(`  Failure: ${result.message}`);
        }

        if (result.success && result.count > 0) {
            console.log('\n--- Verifying Saved Trends (fetching up to 5) ---');
            // Fetch a few trends to verify they were saved
            // Sorting by scrapedAt descending to get the latest ones from the batch just scraped
            const savedTrends = await Trend.find({ source: 'twittrend.jp' }).sort({ scrapedAt: -1 }).limit(5).lean();
            if (savedTrends.length > 0) {
                console.log(`Found ${savedTrends.length} trends in the database from twittrend.jp:`);
                savedTrends.forEach((trend, index) => {
                    console.log(`  ${index + 1}. Name: "${trend.name}", Tweets: ${trend.tweetCount || 'N/A'}, Scraped: ${trend.scrapedAt.toISOString()}, Time Category: ${trend.trendTime}`);
                });
            } else {
                console.log('Could not find any trends in the database from twittrend.jp from this run, or an issue occurred fetching them.');
            }
        }
    } catch (error) {
        console.error('\nAn error occurred during the trend scraping or verification process:', error);
    } finally {
        console.log('\n--- Test Complete ---');
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
}

seedTrends();
