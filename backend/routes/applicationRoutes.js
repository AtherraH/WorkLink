const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getApplications,
  applyForJob,
  selectWorker,
  getAssignedWorker,
  getCustomerAddress,
  getMyApplications,
} = require('../controllers/applicationController');

router.get('/my-applications', auth, getMyApplications);
router.get('/:jobId/applicants', auth, getApplications);
router.post('/:jobId/apply', auth, applyForJob);
router.post('/:jobId/select/:workerId', auth, selectWorker);
router.get('/:jobId/assigned-worker', auth, getAssignedWorker);
router.get('/:jobId/customer-address', auth, getCustomerAddress);

module.exports = router;