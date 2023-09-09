const { ObjectId } = require('mongodb');
const ytdl = require('ytdl-core');
const { saveData, updateSameElements } = require('../services/tools')
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

async function getHighestQualityVideoURL(video_id, user, stream = true) {
  try {
    const userId = user._id;
    
    const videoDocument = await global.db.collection('medias').findOne({_id:new ObjectId(video_id)})

    if(videoDocument.filePath){
      console.log('The element has already been downloaded', videoDocument)
      updateSameElements(videoDocument,{isdl:true,isdl_data:new Date()})
      return videoDocument.filePath.replace('public','')
    }

    return await searchVideoYoutube(videoDocument, user, stream) 
  } catch (error) {
    console.log('Error occurred while getting the video URL:', error);
    return null;
  }
}

async function searchVideoYoutube(videoDocument, user, stream) {

    if (!stream) {
        return videoDocument.link;
    }
    try {
        const info = await ytdl.getInfo(videoDocument.video_id);

        const format = ytdl.chooseFormat(info.formats, {
            filter: 'audioandvideo',
            quality: 'highestaudio'
        });

        updateSameElements(videoDocument, { streamingUrl: format.url, last_scraped: new Date() });

        //console.log('Format found!', format.url);
        return format.url;

    } catch (error) {
        // Log the error for debugging purposes
        console.error("Error fetching video details or choosing format:", error);

        // Return a default or fallback URL or handle error accordingly
        // For now, I'm returning the original videoDocument.link as a fallback
        return videoDocument.link;
    }
}


module.exports = getHighestQualityVideoURL;
