const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  upload, postJob, getJobs, getJobById,
  getMyJobs, deleteJob, updateJob,
} = require('../controllers/jobController');

router.post('/', auth, upload.single('photo'), postJob);
router.get('/', getJobs);
router.get('/customer/my-jobs', auth, getMyJobs);
router.get('/:jobId', getJobById);
router.delete('/:jobId', auth, deleteJob);
router.put('/:jobId', auth, updateJob);

module.exports = router;