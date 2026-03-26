const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  initiatePayment,
  markPaymentSent,
  markPaymentReceived,
  getPaymentStatus,
} = require('../controllers/paymentController');

// Initiate payment record
router.post('/initiate', auth, initiatePayment);

// Customer clicks Payment Sent
router.put('/:jobId/sent', auth, markPaymentSent);

// Worker clicks Payment Received
router.put('/:jobId/received', auth, markPaymentReceived);

// Get payment status
router.get('/:jobId', auth, getPaymentStatus);

module.exports = router;