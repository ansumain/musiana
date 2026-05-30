const uploadToCloud = require('../helpers/uploader')
const Music = require('../models/Music')

const uploadAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an audio file'
            })
        }

        if (!req.body.title) {
            return res.status(400).json({
                success: false,
                message: 'Please provide the title of the audio file'
            })
        }

        const { url, public_id, duration } = await uploadToCloud(req.file.path)

        const durationInSec = Math.ceil(duration)
        const minutes = Math.floor(durationInSec / 60)
        const seconds = (durationInSec - minutes * 60).toString().padStart(2, '0')

        const time = `${minutes}:${seconds}`

        const newMusic = await Music.create({
            title: req.body.title, url, public_id, duration: time
        })

        return res.status(200).json({
            success: true,
            message: 'Audio uploaded successfully',
            data: newMusic
        })
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload audio',
            error: error.message
        })
    }
}

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs');
const https = require('https');
const ffmpegStatic = require('ffmpeg-static');
const cloudinary = require('../config/cloudinary');

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const trimAudio = async (req, res) => {
  const { id } = req.params;
  const { startTime } = req.body; // in seconds, e.g. 10 or 15.5

  if (startTime === undefined || isNaN(startTime) || startTime < 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid startTime in seconds'
    });
  }

  const tempInput = path.join(__dirname, `../uploads/trim_in_${Date.now()}.mp3`);
  const tempOutput = path.join(__dirname, `../uploads/trim_out_${Date.now()}.mp3`);

  try {
    // 1. Fetch song details
    const music = await Music.findById(id);
    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Song not found'
      });
    }

    console.log(`✂️ Trimming song "${music.title}" starting at ${startTime}s...`);

    // 2. Download original audio from Cloudinary
    console.log(`📥 Downloading original track: ${music.url}`);
    await downloadFile(music.url, tempInput);

    // 3. Trim using ffmpeg-static
    console.log(`🎬 Running ffmpeg trim command...`);
    const cmd = `"${ffmpegStatic}" -y -ss ${startTime} -i "${tempInput}" -acodec copy "${tempOutput}"`;
    await execPromise(cmd);

    if (!fs.existsSync(tempOutput)) {
      throw new Error('Trimmed file was not outputted by ffmpeg');
    }

    // 4. Upload trimmed file to Cloudinary
    console.log(`📤 Uploading trimmed file to Cloudinary...`);
    const uploadResult = await cloudinary.uploader.upload(tempOutput, {
      resource_type: 'video',
      folder: 'audio_files',
      format: 'mp3'
    });

    // 5. Delete old audio from Cloudinary
    if (music.public_id) {
      try {
        console.log(`🗑 Deleting old asset from Cloudinary: ${music.public_id}`);
        await cloudinary.uploader.destroy(music.public_id, { resource_type: 'video' });
      } catch (destroyError) {
        console.warn('⚠️ Cloudinary old asset deletion failed:', destroyError.message);
      }
    }

    // 6. Convert duration in seconds to mm:ss format
    const durationInSec = Math.ceil(uploadResult.duration);
    const minutes = Math.floor(durationInSec / 60);
    const seconds = (durationInSec - minutes * 60).toString().padStart(2, '0');
    const time = `${minutes}:${seconds}`;

    // 7. Update MongoDB record
    music.url = uploadResult.secure_url;
    music.public_id = uploadResult.public_id;
    music.duration = time;
    await music.save();

    console.log(`✅ Successfully trimmed and saved "${music.title}"`);

    return res.status(200).json({
      success: true,
      message: 'Audio trimmed and overwritten successfully',
      data: music
    });

  } catch (error) {
    console.error('❌ Trimming error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trim audio',
      error: error.message
    });
  } finally {
    // Clean up temp files
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
  }
};

module.exports = { uploadAudio, trimAudio }