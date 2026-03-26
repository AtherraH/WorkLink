const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  toggleOnline,
  getWorkerPublicProfile,
  updateLocation,
  getWorkerLocation,
  getAssignedJobs,
  getWorkerJobHistory,
} = require('../controllers/workerController');

// ORDER MATTERS — specific routes before :param routes
router.get('/assigned-jobs', authenticate, getAssignedJobs);
router.get('/job-history', authenticate, getWorkerJobHistory);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/toggle-online', authenticate, toggleOnline);
router.put('/location', authenticate, updateLocation);
router.get('/location/:jobId', authenticate, getWorkerLocation);
router.get('/:userId', getWorkerPublicProfile);

module.exports = router;