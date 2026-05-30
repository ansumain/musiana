const Music = require('../models/Music')

const fetchAllMusic = async (req, res) => {
    try {
        const allMusic = await Music.find().sort({ createdAt: -1 });
        if (!allMusic) {
            return res.status(404).json({
                success: false,
                message: 'No music found'
            })
        }

        res.status(200).json({
            success: true,
            message: 'All music fetched successfully',
            data: allMusic
        })
    } catch (error) {
        console.error('Fetch error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch music',
            error: error.message
        })
    }
}

module.exports = { fetchAllMusic }