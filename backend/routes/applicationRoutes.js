const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getApplications,
  applyForJob,
  selectWorker,
  getMyApplications,
} = require('../controllers/applicationController');

router.get('/my-applications', auth, getMyApplications);
router.get('/:jobId/applicants', auth, getApplications);
router.post('/:jobId/apply', auth, applyForJob);
router.post('/:jobId/select/:workerId', auth, selectWorker);

module.exports = router;