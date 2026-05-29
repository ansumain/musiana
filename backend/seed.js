require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const mm = require('music-metadata');
const Music = require('./models/Music');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const AUDIO_DIR = path.join(__dirname, '../audio');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

const uploadToCloud = async (filepath) => {
  try {
    const result = await cloudinary.uploader.upload(filepath, {
      resource_type: 'video',
      folder: 'audio_files',
      format: 'mp3'
    });
    return {
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration
    };
  } catch (error) {
    throw new Error(`Cloud upload failed: ${error.message}`);
  }
};

// Upload binary buffer to Cloudinary (for cover art images)
const uploadBufferToCloud = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'audio_covers'
    }, (error, result) => {
      if (error) {
        console.error('❌ Cloudinary Buffer Upload Error:', error);
        reject(error);
      } else {
        resolve(result);
      }
    });
    uploadStream.end(buffer);
  });
};

const seed = async () => {
  await connectDB();

  try {
    if (!fs.existsSync(AUDIO_DIR)) {
      console.error(`❌ Audio directory not found at: ${AUDIO_DIR}`);
      process.exit(1);
    }

    const files = fs.readdirSync(AUDIO_DIR).filter(file => file.endsWith('.mp3'));

    if (files.length === 0) {
      console.log('⚠️ No MP3 files found in the audio folder.');
      process.exit(0);
    }

    console.log(`🎵 Found ${files.length} MP3 file(s). Starting upload process...`);

    for (const file of files) {
      const title = path.basename(file, '.mp3');
      const filepath = path.join(AUDIO_DIR, file);

      // Check if song already exists in the database
      const existing = await Music.findOne({ title });
      if (existing) {
        // Retroactive update: if existing song doesn't have an imageUrl, extract and upload it
        if (!existing.imageUrl) {
          console.log(`🔍 Checking "${title}" for missing cover art...`);
          try {
            const metadata = await mm.parseFile(filepath);
            const picture = metadata.common.picture && metadata.common.picture[0];
            if (picture) {
              console.log(`📤 Uploading cover art for "${title}"...`);
              const imgCloud = await uploadBufferToCloud(picture.data);
              existing.imageUrl = imgCloud.secure_url;
              await existing.save();
              console.log(`✅ Retroactively updated cover art for "${title}"`);
            } else {
              console.log(`ℹ️ No cover art found in file for "${title}"`);
            }
          } catch (err) {
            console.error(`❌ Failed to update cover art for "${title}":`, err.message);
          }
        } else {
          console.log(`⏩ Skipping "${title}" (already exists with cover art in DB)`);
        }
        continue;
      }

      console.log(`📤 Uploading "${title}" to Cloudinary...`);
      const cloudData = await uploadToCloud(filepath);

      // Convert duration in seconds to mm:ss format
      const durationInSec = Math.ceil(cloudData.duration);
      const minutes = Math.floor(durationInSec / 60);
      const seconds = (durationInSec - minutes * 60).toString().padStart(2, '0');
      const time = `${minutes}:${seconds}`;

      // Extract cover art if available
      let imageUrl = '';
      try {
        const metadata = await mm.parseFile(filepath);
        const picture = metadata.common.picture && metadata.common.picture[0];
        if (picture) {
          console.log(`📤 Uploading cover art for new song "${title}"...`);
          const imgCloud = await uploadBufferToCloud(picture.data);
          imageUrl = imgCloud.secure_url;
        }
      } catch (err) {
        console.error(`⚠️ Could not parse cover art for new song "${title}":`, err.message);
      }

      // Save to MongoDB
      await Music.create({
        title,
        url: cloudData.url,
        public_id: cloudData.public_id,
        duration: time,
        imageUrl
      });

      console.log(`✅ Successfully uploaded and registered "${title}" (${time})`);
    }

    console.log('🎉 Seeding complete! All files processed.');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    mongoose.connection.close();
  }
};

seed();
