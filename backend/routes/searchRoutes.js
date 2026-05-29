const express = require('express');
const { searchMusic } = require('../controllers/search-controller');
const authMiddleware = require('../middlewares/auth-middleware');

const router = express.Router();

// GET /api/search?q=query
router.get('/', authMiddleware, searchMusic);

module.exports = router;
