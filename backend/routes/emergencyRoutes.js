const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  checkNoShow,
  triggerEmergency,
  chooseBackupWorker,
  getEmergencyBackups,
  waitForWorker,
  cancelJobByCustomer,
} = require('../controllers/emergencyController');

router.get('/check/:jobId', auth, checkNoShow);
router.post('/trigger/:jobId', auth, triggerEmergency);
router.put('/:jobId/choose/:backupWorkerId', auth, chooseBackupWorker);
router.get('/:jobId/backups', auth, getEmergencyBackups);
router.post('/:jobId/wait', auth, waitForWorker);
router.post('/:jobId/cancel', auth, cancelJobByCustomer);

module.exports = router;