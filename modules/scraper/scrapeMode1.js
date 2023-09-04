const { ObjectId, GoogleApis } = require('mongodb');

const searchYoutube = async (query, url, mode, page) => {
  const { google } = require('googleapis');

  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.FIREBASE_API_KEY
  });

  const response = await youtube.search.list({
    part: 'snippet',
    q: query,
    maxResults: 30,
    type: 'video'  // This filters out everything except videos
  });

  const result = response.data.items.map(item => {
    const { title, thumbnails, description } = item.snippet;
    const videoId = item.id.videoId;
    const link = `https://www.youtube.com/watch?v=${videoId}`;
    const thumb = item.snippet.thumbnails;
    const imageUrl = thumb.high ? thumb.high.url : thumb.default.url;
    const alt = title;
    const currentPage = url;

    return { video_id: videoId, imageUrl, title, alt, link, currentPage, query, mode };
  });

  return result;
}


async function scrapeMode1(url, mode, page) {
  query = url 
  try {
    return await searchYoutube(query, url, mode, page);
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}

module.exports = scrapeMode1;
