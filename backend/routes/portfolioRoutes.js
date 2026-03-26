const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  upload,
  uploadPortfolioPhoto,
  getPortfolio,
  deletePortfolioPhoto,
} = require('../controllers/portfolioController');

// Public - view any worker's portfolio
router.get('/:userId', getPortfolio);

// Protected - upload and delete (workers only)
router.post('/upload', auth, upload.single('photo'), uploadPortfolioPhoto);
router.delete('/:photoId', auth, deletePortfolioPhoto);

module.exports = router;