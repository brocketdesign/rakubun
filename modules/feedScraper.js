const RSSParser = require('rss-parser');
const rssParser = new RSSParser();
const axios = require('axios');
const cheerio = require('cheerio');
const { ObjectId } = require('mongodb');

const scrapeArticle = async (articleUrl) => {
  try {
    const { data } = await axios.get(articleUrl);
    const $ = cheerio.load(data);
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content') || 'No description available';
    const content = $('.article_body').text();
    return { title, content, metaDescription, articleUrl };
  } catch (error) {
    console.error(`Error scraping article at ${articleUrl}: `, error);
    return null;
  }
};

const fetchAndScrapeFeed = async (feedUrl) => {
    console.log(`fetchAndScrapeFeed ${feedUrl}`)
  try {
    const feed = await rssParser.parseURL(feedUrl);
    const articlesPromises = feed.items.map(item => scrapeArticle(item.link));
    return Promise.all(articlesPromises);
  } catch (error) {
    console.error(`Error fetching/scraping feed ${feedUrl}: `, error);
    return [];
  }
};

async function getOrUpdateArticles(feedId) {
  const feed = await global.db.collection('feeds').findOne({ _id: new ObjectId(feedId) });

  if (!feed) throw new Error('Feed not found');

  // Check if the feed has been scraped lately (e.g., within the last 24 hours)
  const lastScraped = feed.lastScraped || 0;
  const oneDayAgo = Date.now() - (6 * 60 * 60 * 1000);

  if (true) {
    // Feed needs to be scraped again
    const scrapedArticles = await fetchAndScrapeFeed(feed.url);
    console.log({scrapedArticles})
    // Update the database with the new articles and the last scraped timestamp
    const updates = scrapedArticles.map(article => ({
      updateOne: {
        filter: { feedId: new ObjectId(feedId), title: article.title },
        update: { $set: article },
        upsert: true
      }
    }));

    await global.db.collection('articles').bulkWrite(updates);
    await global.db.collection('feeds').updateOne({ _id: new ObjectId(feedId) }, { $set: { lastScraped: Date.now() } });
  }
  console.log(`Feed is up to date`)
  // Return the articles from the database
  return global.db.collection('articles').find({ feedId: new ObjectId(feedId) }).sort({_id:-1}).limit(10).toArray();
}

module.exports = { getOrUpdateArticles };
