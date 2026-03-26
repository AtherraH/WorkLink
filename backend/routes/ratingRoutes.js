const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rateWorker, getWorkerRatings } = require('../controllers/ratingController');

// Customer rates worker after job completion
router.post('/:jobId', auth, rateWorker);

// Get all ratings for a worker
router.get('/worker/:workerId', auth, getWorkerRatings);

module.exports = router;