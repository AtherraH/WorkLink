const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

// =====================
// MULTER SETUP FOR COMPLETION PHOTOS
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `completion-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// =====================
// COMPLETE JOB (Worker uploads completion photo)
// POST /api/completion/:jobId
// =====================
const completeJob = async (req, res) => {
  const workerId = req.user.id;
  const { jobId } = req.params;

  try {
    // Verify worker is assigned to this job
    // Try direct match first, then fallback via applications table
    let assignedCheck = await pool.query(
      `SELECT aw.*, j.title AS job_title, j.labor_type
       FROM assigned_workers aw
       JOIN jobs j ON j.id = aw.job_id
       WHERE aw.job_id = $1 AND aw.worker_id = $2`,
      [jobId, workerId]
    );

    // Fallback: check if worker applied and was accepted (handles mismatched ID edge cases)
    if (assignedCheck.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT aw.*, j.title AS job_title, j.labor_type
         FROM assigned_workers aw
         JOIN jobs j ON j.id = aw.job_id
         JOIN applications app ON app.job_id = aw.job_id AND app.worker_id = $2 AND app.status = 'accepted'
         WHERE aw.job_id = $1`,
        [jobId, workerId]
      );
      if (fallback.rows.length > 0) {
        // Fix the mismatch — update assigned_workers to use correct worker_id
        await pool.query(
          `UPDATE assigned_workers SET worker_id = $1 WHERE job_id = $2`,
          [workerId, jobId]
        );
        assignedCheck = await pool.query(
          `SELECT aw.*, j.title AS job_title, j.labor_type
           FROM assigned_workers aw
           JOIN jobs j ON j.id = aw.job_id
           WHERE aw.job_id = $1 AND aw.worker_id = $2`,
          [jobId, workerId]
        );
      }
    }

    if (assignedCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this job.' });
    }

    const assignment = assignedCheck.rows[0];

    // Make sure job isn't already completed
    if (assignment.exit_time) {
      return res.status(400).json({ message: 'Job already marked as completed.' });
    }

    // If entry_time missing (OTP not verified yet), auto-set it now
    if (!assignment.entry_time) {
      await pool.query(
        `UPDATE assigned_workers SET entry_time = NOW() WHERE job_id = $1 AND worker_id = $2`,
        [jobId, workerId]
      );
      // Also ensure job is in_progress
      await pool.query(
        `UPDATE jobs SET status = 'in_progress' WHERE id = $1 AND status = 'assigned'`,
        [jobId]
      );
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a completion photo.' });
    }

    const completionPhotoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const exitTime = new Date();

    // Record exit time and completion photo
    await pool.query(
      `UPDATE assigned_workers
       SET exit_time = $1, completion_photo_url = $2
       WHERE job_id = $3 AND worker_id = $4`,
      [exitTime, completionPhotoUrl, jobId, workerId]
    );

    // Update job status to completed
    await pool.query(
      `UPDATE jobs SET status = 'completed' WHERE id = $1`,
      [jobId]
    );

    // Release commitment bond automatically
    await pool.query(
      `UPDATE commitment_bonds
       SET status = 'released'
       WHERE job_id = $1 AND status = 'active'`,
      [jobId]
    );

    // Get worker profile id
    const profileResult = await pool.query(
      'SELECT id FROM worker_profiles WHERE user_id = $1',
      [workerId]
    );

    if (profileResult.rows.length > 0) {
      const workerProfileId = profileResult.rows[0].id;

      // Auto-add completion photo to worker's public portfolio
      await pool.query(
        `INSERT INTO portfolio (worker_id, photo_url, job_title)
         VALUES ($1, $2, $3)`,
        [workerProfileId, completionPhotoUrl, assignment.job_title]
      );
    }

    res.status(200).json({
      message: 'Job completed successfully! Photo added to your portfolio.',
      exit_time: exitTime,
      completion_photo_url: completionPhotoUrl,
      job_id: jobId,
    });

  } catch (err) {
    console.error('Complete job error:', err.message);
    res.status(500).json({ message: 'Server error completing job.' });
  }
};

// =====================
// GET JOB COMPLETION DETAILS
// GET /api/completion/:jobId
// =====================
const getCompletionDetails = async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        aw.entry_time,
        aw.exit_time,
        aw.completion_photo_url,
        j.title AS job_title,
        j.status AS job_status,
        u.full_name AS worker_name,
        EXTRACT(EPOCH FROM (aw.exit_time - aw.entry_time))/3600 AS hours_worked
       FROM assigned_workers aw
       JOIN jobs j ON j.id = aw.job_id
       JOIN users u ON u.id = aw.worker_id
       WHERE aw.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job completion details not found.' });
    }

    res.status(200).json({
      completion: result.rows[0],
    });

  } catch (err) {
    console.error('Get completion error:', err.message);
    res.status(500).json({ message: 'Server error fetching completion details.' });
  }
};

module.exports = { upload, completeJob, getCompletionDetails };