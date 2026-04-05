const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { raiseDispute, getMyDisputes, reopenDispute } = require('../controllers/disputeController');

router.get('/my-disputes', auth, getMyDisputes);
router.post('/:jobId', auth, raiseDispute);
router.put('/:disputeId/reopen', auth, reopenDispute);

module.exports = router;