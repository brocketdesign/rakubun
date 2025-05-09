const fetch = require('node-fetch');
const cheerio = require('cheerio');
const Trend = require('../models/Trend');

async function scrapeTwittrend() {
    console.log('Starting trend scraping from twittrend.jp...');
    try {
        const response = await fetch('https://twittrend.jp/');
        if (!response.ok) {
            console.error(`Failed to fetch twittrend.jp: ${response.status} ${response.statusText}`);
            return { success: false, message: `Failed to fetch twittrend.jp: ${response.status}` };
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const trends = [];
        const scrapedAt = new Date();

        // List of time sections to scrape
        const timeSections = [
            { id: 'now', label: '現在' },
            { id: '1hour', label: '1時間前' },
            { id: '3hour', label: '3時間前' },
            { id: '6hour', label: '6時間前' }
        ];

        timeSections.forEach(section => {
            const sectionDiv = $(`div#${section.id}`);
            if (sectionDiv.length === 0) return;

            // Get time label and time string
            const trendTime = sectionDiv.find('.box-title').first().text().trim() || section.label;
            const timeString = sectionDiv.find('.box-header span').first().text().trim();

            sectionDiv.find('ul.list-unstyled > li').each((i, elem) => {
                const trendName = $(elem).find('p.trend a').text().trim();
                let tweetCount = $(elem).find('p.trend-tweet-volum').text().trim();
                tweetCount = tweetCount.replace(/件のツイート/g, '').replace(/件/g, '').replace(/　/g, '').trim();
                if (tweetCount === '') tweetCount = null;

                if (trendName) {
                    trends.push({
                        name: trendName,
                        tweetCount: tweetCount,
                        source: 'twittrend.jp',
                        region: 'Japan',
                        scrapedAt: scrapedAt,
                        trendTime: trendTime,
                        trendTimeString: timeString
                    });
                }
            });
        });

        console.log(`Found ${trends.length} trends from twittrend.jp`);

        if (trends.length > 0) {
            try {
                const operations = trends.map(trend => ({
                    updateOne: {
                        filter: {
                            name: trend.name,
                            source: trend.source,
                            region: trend.region,
                            trendTime: trend.trendTime 
                        },
                        update: { $set: trend },
                        upsert: true
                    }
                }));

                if (operations.length > 0) {
                    await Trend.bulkWrite(operations);
                    console.log(`${operations.length} trends upserted into the database.`);
                    return { success: true, count: operations.length, message: 'Trends scraped and saved successfully.' };
                } else {
                    console.log('No new trend operations to perform.');
                    return { success: true, count: 0, message: 'No new trends to save.' };
                }

            } catch (dbError) {
                console.error('Error saving trends to database:', dbError);
                return { success: false, message: `Error saving trends: ${dbError.message}` };
            }
        } else {
            console.log('No trends found on twittrend.jp page.');
            return { success: true, count: 0, message: 'No trends found on the page.' };
        }

    } catch (error) {
        console.error('Error scraping twittrend.jp:', error);
        return { success: false, message: `Scraping error: ${error.message}` };
    }
}

module.exports = { scrapeTwittrend };
