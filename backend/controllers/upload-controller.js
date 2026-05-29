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

module.exports = { uploadAudio }