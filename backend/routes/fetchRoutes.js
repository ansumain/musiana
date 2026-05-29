const express = require('express');
const {fetchAllMusic} = require('../controllers/fetch-controller');
const authMiddleware = require('../middlewares/auth-middleware');
const router = express.Router();

router.get('/music', authMiddleware, fetchAllMusic)

module.exports = router;