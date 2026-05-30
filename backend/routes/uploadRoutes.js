const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadAudio, trimAudio } = require('../controllers/upload-controller');
const authMiddleware = require('../middlewares/auth-middleware')
const checkAdmin = require('../middlewares/admin-middleware')

// Configure multer to store files temporarily
const upload = multer({ dest: 'uploads/' });

// POST /api/upload/audio - Upload audio file
router.post('/audio', authMiddleware, checkAdmin, upload.single('audio'), uploadAudio);

// POST /api/upload/trim/:id - Trim audio file
router.post('/trim/:id', authMiddleware, checkAdmin, trimAudio);

module.exports = router;
