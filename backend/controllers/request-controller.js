const SongRequest = require('../models/SongRequest');

// Create a new song request (User)
const createRequest = async (req, res) => {
  try {
    const { title, artist, note } = req.body;
    const userId = req.userInfo.userId;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Song title is required'
      });
    }

    const newRequest = await SongRequest.create({
      user: userId,
      title: title.trim(),
      artist: artist ? artist.trim() : '',
      note: note ? note.trim() : '',
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Song request submitted successfully',
      data: newRequest
    });
  } catch (error) {
    console.error('❌ Create Song Request Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

// Fetch requests submitted by logged-in user (User)
const getUserRequests = async (req, res) => {
  try {
    const userId = req.userInfo.userId;
    const requests = await SongRequest.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('❌ Get User Song Requests Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

// Fetch all song requests (Admin/Super-Admin)
const getAllRequests = async (req, res) => {
  try {
    if (req.userInfo.role !== 'admin' && req.userInfo.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    const requests = await SongRequest.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('❌ Get All Song Requests Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

// Update song request status (Admin/Super-Admin)
const updateRequestStatus = async (req, res) => {
  try {
    if (req.userInfo.role !== 'admin' && req.userInfo.role !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!['pending', 'added', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const request = await SongRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Song request not found'
      });
    }

    request.status = status;
    if (adminNote !== undefined) {
      request.adminNote = adminNote.trim();
    }
    await request.save();

    res.status(200).json({
      success: true,
      message: `Song request updated to "${status}"`,
      data: request
    });
  } catch (error) {
    console.error('❌ Update Song Request Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

// Delete a song request (User owner or Admin)
const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userInfo.userId;
    const userRole = req.userInfo.role;

    const request = await SongRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Song request not found'
      });
    }

    // Only owner user or admin/super-admin can delete
    if (request.user.toString() !== userId && userRole !== 'admin' && userRole !== 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await SongRequest.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Song request deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete Song Request Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

module.exports = {
  createRequest,
  getUserRequests,
  getAllRequests,
  updateRequestStatus,
  deleteRequest
};
