const { ObjectId, GoogleApis } = require('mongodb');
const { google } = require('googleapis');

const searchYoutube = async (query, mode, page) => {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.FIREBASE_API_KEY
  });

  try {
    const searchResponse = await youtube.search.list({
      part: 'snippet',
      q: query,
      maxResults: 50,
      type: 'video',
      videoDuration: 'medium'
    });

    // Fetch video details
    const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');
    const videoDetailsResponse = await youtube.videos.list({
      id: videoIds,
      part: 'contentDetails'
    });

    // Combine the search results with the video details
    const combinedResults = searchResponse.data.items.map(searchItem => {
        const details = videoDetailsResponse.data.items.find(detailItem => detailItem.id === searchItem.id.videoId);
        return {
            ...searchItem,
            contentDetails: details.contentDetails
        };
    });

    // Filter videos that are less than 10 minutes
    const shortVideos = combinedResults.filter(video => {
      const duration = video.contentDetails.duration;
      const durationInMinutes = convertDurationToMinutes(duration);
      return durationInMinutes < 10;
    }).slice(0, 10); // Get the top 10 results

    const result = shortVideos.map(item => {
      const { title, thumbnails } = item.snippet;
      const videoId = item.id.videoId;
      const link = `https://www.youtube.com/watch?v=${videoId}`;
      const imageUrl = thumbnails.high ? thumbnails.high.url : thumbnails.default.url;

      return { video_id: videoId, imageUrl, title, alt: title, link, currentPage: query, query, mode };
    });

    return result;

} catch (error) {
    console.error('Error searching YouTube:', error);
    throw error;
}

}



async function scrapeMode1(query, mode, page) {
  try {
    return await searchYoutube(query, mode, page);
  } catch (error) {
    console.log('Error occurred while scraping and saving data:', error);
    return [];
  }
}
function convertDurationToMinutes(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  
  const totalMinutes = (hours * 60 + minutes + seconds / 60);
  return totalMinutes;
}
module.exports = scrapeMode1;
