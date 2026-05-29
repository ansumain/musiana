const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Music = require('../models/Music');

const execPromise = util.promisify(exec);

// In-memory set to prevent multiple users from launching concurrent downloads for the same search query
const activeDownloads = new Set();

/**
 * Background worker to download audio from YouTube, upload to Cloudinary, and save to MongoDB
 * @param {string} query 
 */
const downloadAndUpload = async (query) => {
  const cleanQuery = query.trim().toLowerCase();
  
  if (activeDownloads.has(cleanQuery)) {
    console.log(`⏩ Already downloading query: "${query}"`);
    return;
  }

  activeDownloads.add(cleanQuery);
  console.log(`📥 Downloader started for query: "${query}"`);

  let tempFile = '';

  try {
    // 1. Search YouTube and extract metadata (title, video id, thumbnail URL)
    console.log(`🔍 Searching YouTube for: "${query}"`);
    const { stdout } = await execPromise(`yt-dlp --print "%(title)s###%(id)s###%(thumbnail)s" "ytsearch1:${query}"`);
    
    const parts = stdout.trim().split('###');
    if (parts.length < 3) {
      throw new Error('Failed to parse metadata from search results');
    }

    const title = parts[0].trim();
    const videoId = parts[1].trim();
    const thumbnailUrl = parts[2].trim();

    console.log(`🎵 Found on YouTube: "${title}" (ID: ${videoId})`);

    // Check if the exact title has been created while search was running
    const existing = await Music.findOne({ title });
    if (existing) {
      console.log(`⏩ Song "${title}" already exists in DB, skipping download.`);
      activeDownloads.delete(cleanQuery);
      return;
    }

    // 2. Download and transcode audio to local temporary file
    tempFile = path.join(__dirname, `../uploads/temp_${Date.now()}`);
    console.log(`📥 Downloading audio stream from YouTube...`);
    
    // Command extracts audio and transcodes to MP3 format locally
    const downloadCommand = `yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 --output "${tempFile}.%(ext)s" "https://www.youtube.com/watch?v=${videoId}" || yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 --output "${tempFile}.%(ext)s" "ytsearch1:${query}"`;
    await execPromise(downloadCommand);

    const localFile = `${tempFile}.mp3`;
    if (!fs.existsSync(localFile)) {
      throw new Error('Transcoded audio file was not found on local disk');
    }

    console.log(`📤 Uploading "${title}" to Cloudinary...`);

    // 3. Upload audio file to Cloudinary
    const audioResult = await cloudinary.uploader.upload(localFile, {
      resource_type: 'video',
      folder: 'audio_files',
      format: 'mp3'
    });

    // 4. Upload thumbnail cover image to Cloudinary
    let imageUrl = '';
    if (thumbnailUrl) {
      try {
        console.log(`📤 Uploading cover art image to Cloudinary...`);
        const imgResult = await cloudinary.uploader.upload(thumbnailUrl, {
          folder: 'audio_covers'
        });
        imageUrl = imgResult.secure_url;
      } catch (imgError) {
        console.error('⚠️ Cover art upload failed:', imgError.message);
      }
    }

    // 5. Convert duration in seconds to mm:ss format
    const durationInSec = Math.ceil(audioResult.duration);
    const minutes = Math.floor(durationInSec / 60);
    const seconds = (durationInSec - minutes * 60).toString().padStart(2, '0');
    const formattedDuration = `${minutes}:${seconds}`;

    // 6. Save document to MongoDB
    await Music.create({
      title,
      url: audioResult.secure_url,
      public_id: audioResult.public_id,
      duration: formattedDuration,
      imageUrl
    });

    console.log(`✅ Successfully auto-downloaded and registered "${title}"`);

  } catch (error) {
    console.error(`❌ Downloader failed for query "${query}":`, error.message);
  } finally {
    // Clean up temporary local files
    if (tempFile) {
      const localFile = `${tempFile}.mp3`;
      if (fs.existsSync(localFile)) {
        try {
          fs.unlinkSync(localFile);
          console.log(`🧹 Deleted temporary file: ${localFile}`);
        } catch (cleanupError) {
          console.error(`⚠️ Failed to delete temp file ${localFile}:`, cleanupError.message);
        }
      }
    }
    // Remove query from active download set
    activeDownloads.delete(cleanQuery);
  }
};

module.exports = {
  activeDownloads,
  downloadAndUpload
};
