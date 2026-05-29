const express = require('express');
const {register, login, changePassword, forgotPassword} = require('../controllers/auth-controller')
const authMiddleware = require('../middlewares/auth-middleware');
const router = express.Router();


router.post('/register', register)
router.post('/login', login)
router.post('/change-password', authMiddleware, changePassword)
router.post('/forgot-password', forgotPassword)

module.exports = router;