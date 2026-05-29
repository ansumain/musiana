const { activeDownloads, downloadAndUpload } = require('../helpers/downloader');
const Music = require('../models/Music');

/**
 * GET /api/search?q=song_title
 */
const searchMusic = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required'
      });
    }

    const cleanQuery = query.trim();

    // 1. Search existing music in MongoDB first (case-insensitive regex)
    const results = await Music.find({
      title: { $regex: cleanQuery, $options: 'i' }
    });

    if (results.length > 0) {
      return res.status(200).json({
        success: true,
        downloading: false,
        data: results
      });
    }

    // 2. If not found in DB, check if it is already in the download queue
    const isCurrentlyDownloading = activeDownloads.has(cleanQuery.toLowerCase());

    if (isCurrentlyDownloading) {
      return res.status(200).json({
        success: true,
        downloading: true,
        message: `"${cleanQuery}" is already being downloaded. Please wait a moment.`
      });
    }

    // 3. Trigger download process asynchronously (run in background, don't wait)
    downloadAndUpload(cleanQuery);

    return res.status(202).json({
      success: true,
      downloading: true,
      message: `Searching the cloud and downloading "${cleanQuery}"... This will take a few moments.`
    });

  } catch (error) {
    console.error('❌ Search Controller Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

module.exports = {
  searchMusic
};
