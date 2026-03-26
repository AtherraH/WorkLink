const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createBond,
  getBond,
  forfeitBond,
  releaseBond,
} = require('../controllers/bondController');

// Create bond when worker is assigned
router.post('/create', auth, createBond);

// Get bond details for a job
router.get('/:jobId', auth, getBond);

// Forfeit bond on no-show or cancellation
router.put('/:jobId/forfeit', auth, forfeitBond);

// Release bond on job completion
router.put('/:jobId/release', auth, releaseBond);

module.exports = router;