const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getChatHistory, sendMessage } = require('../controllers/chatController');

// Get chat history for a job
router.get('/:jobId', auth, getChatHistory);

// Send a message
router.post('/:jobId', auth, sendMessage);

module.exports = router;