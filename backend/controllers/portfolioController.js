const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

// =====================
// MULTER SETUP
// Controls how photos are saved
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to uploads folder
  },
  filename: (req, file, cb) => {
    // Create unique filename: userId-timestamp.extension
    const uniqueName = `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

// =====================
// UPLOAD PORTFOLIO PHOTO
// POST /api/portfolio/upload
// =====================
const uploadPortfolioPhoto = async (req, res) => {
  const workerId = req.user.id;
  const { job_title } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an image file.' });
  }

  try {
    // Get worker profile id
    const profileResult = await pool.query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [workerId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    const workerProfileId = profileResult.rows[0].id;

    // Build the photo URL that can be accessed from frontend
    const photo_url = `http://localhost:5000/uploads/${req.file.filename}`;

    // Save to portfolio table
    const result = await pool.query(
      `INSERT INTO portfolio (worker_id, photo_url, job_title)
       VALUES ($1, $2, $3)
       RETURNING id, photo_url, job_title, created_at`,
      [workerProfileId, photo_url, job_title || 'Completed Work']
    );

    res.status(201).json({
      message: 'Portfolio photo uploaded successfully!',
      portfolio_item: result.rows[0],
    });

  } catch (err) {
    console.error('Portfolio upload error:', err.message);
    res.status(500).json({ message: 'Server error uploading portfolio photo.' });
  }
};

// =====================
// GET WORKER PORTFOLIO
// GET /api/portfolio/:userId
// =====================
const getPortfolio = async (req, res) => {
  const { userId } = req.params;

  try {
    // Get worker profile id from user id
    const profileResult = await pool.query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    const workerProfileId = profileResult.rows[0].id;

    // Get all portfolio photos
    const portfolio = await pool.query(
      `SELECT id, photo_url, job_title, created_at
       FROM portfolio
       WHERE worker_id = $1
       ORDER BY created_at DESC`,
      [workerProfileId]
    );

    res.status(200).json({
      portfolio: portfolio.rows,
    });

  } catch (err) {
    console.error('Get portfolio error:', err.message);
    res.status(500).json({ message: 'Server error fetching portfolio.' });
  }
};

// =====================
// DELETE PORTFOLIO PHOTO
// DELETE /api/portfolio/:photoId
// =====================
const deletePortfolioPhoto = async (req, res) => {
  const workerId = req.user.id;
  const { photoId } = req.params;

  try {
    // Make sure this photo belongs to this worker
    const profileResult = await pool.query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [workerId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    const workerProfileId = profileResult.rows[0].id;

    const result = await pool.query(
      `DELETE FROM portfolio
       WHERE id = $1 AND worker_id = $2
       RETURNING id`,
      [photoId, workerProfileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Photo not found or not yours to delete.' });
    }

    res.status(200).json({ message: 'Portfolio photo deleted successfully.' });

  } catch (err) {
    console.error('Delete portfolio error:', err.message);
    res.status(500).json({ message: 'Server error deleting portfolio photo.' });
  }
};

module.exports = {
  upload,
  uploadPortfolioPhoto,
  getPortfolio,
  deletePortfolioPhoto,
};