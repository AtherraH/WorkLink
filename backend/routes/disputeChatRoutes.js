const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendDisputeMessage, getDisputeMessages } = require('../controllers/disputeChatController');

router.get('/:disputeId', auth, getDisputeMessages);
router.post('/:disputeId', auth, sendDisputeMessage);

module.exports = router;