const cloudinary = require('../config/cloudinary')

const uploadToCloud = async(filepath) => {
    try{
        const result = await cloudinary.uploader.upload(filepath,{
            resource_type: 'video',
            folder: 'audio_files',
            format: 'mp3'
        });

        return {
            url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration
        }
    }catch(error){
        throw new Error(`Cloud upload failed: ${error.message}`)
    }
}

module.exports = uploadToCloud