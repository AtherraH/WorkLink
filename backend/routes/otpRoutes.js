const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { verifyOTP, getOTP, regenerateOTP } = require('../controllers/otpController');

// Must come BEFORE /:jobId to avoid being swallowed by the param route
router.post('/regenerate', auth, regenerateOTP);

// Customer views OTP for a job
router.get('/:jobId', auth, getOTP);

// Worker verifies OTP on arrival
router.post('/:jobId/verify', auth, verifyOTP);

module.exports = router;