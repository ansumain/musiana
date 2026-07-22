const express = require('express');
const authMiddleware = require('../middlewares/auth-middleware');
const {
  createRequest,
  getUserRequests,
  getAllRequests,
  updateRequestStatus,
  deleteRequest
} = require('../controllers/request-controller');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createRequest);
router.get('/my', getUserRequests);
router.get('/', getAllRequests);
router.patch('/:id', updateRequestStatus);
router.delete('/:id', deleteRequest);

module.exports = router;
