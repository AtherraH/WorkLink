const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only.' });
  }
  next();
};

const {
  getStats, getUsers, getJobs, getPayments,
  banUser, unbanUser, warnUser,
  getDisputes, createDispute, resolveDispute,
  getAdminActions,
} = require('../controllers/adminController');

router.get('/stats', auth, isAdmin, getStats);
router.get('/users', auth, isAdmin, getUsers);
router.get('/jobs', auth, isAdmin, getJobs);
router.get('/payments', auth, isAdmin, getPayments);
router.put('/users/:userId/ban', auth, isAdmin, banUser);
router.put('/users/:userId/unban', auth, isAdmin, unbanUser);
router.put('/users/:userId/warn', auth, isAdmin, warnUser);
router.get('/disputes', auth, isAdmin, getDisputes);
router.post('/disputes', auth, createDispute);
router.put('/disputes/:disputeId/resolve', auth, isAdmin, resolveDispute);
router.get('/actions', auth, isAdmin, getAdminActions);

module.exports = router;