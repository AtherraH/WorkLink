const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { rateWorker, getWorkerRatings } = require('../controllers/ratingController');

router.post('/:jobId', auth, rateWorker);
router.get('/worker/:workerId', getWorkerRatings);

module.exports = router;