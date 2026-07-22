const mongoose = require('mongoose');

const SongRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    default: '',
    trim: true
  },
  note: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'added', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SongRequest', SongRequestSchema);
