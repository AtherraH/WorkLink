const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  suggestWorkers,
  suggestJobs,
  suggestCustomers,
} = require('../controllers/suggestionController');

router.get('/workers/:jobId', auth, suggestWorkers);
router.get('/jobs/:workerId', auth, suggestJobs);
router.get('/customers/:workerId', auth, suggestCustomers);

module.exports = router;