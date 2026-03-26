const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  upload,
  completeJob,
  getCompletionDetails,
} = require('../controllers/completionController');

// Worker uploads completion photo
router.post('/:jobId', auth, upload.single('photo'), completeJob);

// Get completion details for a job
router.get('/:jobId', auth, getCompletionDetails);

module.exports = router;