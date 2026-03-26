const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `job-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// POST A JOB
const postJob = async (req, res) => {
  const customerId = req.user.id;
  const {
    title, labor_type, description, rate,
    location, workers_needed, urgency, scheduled_time,
    latitude, longitude,
  } = req.body;

  const photoUrl = req.file
    ? `http://localhost:5000/uploads/${req.file.filename}`
    : null;

  try {
    const result = await pool.query(
      `INSERT INTO jobs
        (customer_id, title, labor_type, description, rate, location,
         latitude, longitude, workers_needed, urgency, scheduled_time, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        customerId, title, labor_type, description, rate, location,
        latitude || null, longitude || null,
        workers_needed || 1, urgency || 'urgent',
        scheduled_time || null, photoUrl,
      ]
    );
    res.status(201).json({ message: 'Job posted successfully!', job: result.rows[0] });
  } catch (err) {
    console.error('Post job error:', err.message);
    res.status(500).json({ message: 'Server error posting job.' });
  }
};

// GET ALL OPEN JOBS
const getJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, u.full_name AS customer_name, u.phone AS customer_phone
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       WHERE j.status = 'open'
       ORDER BY j.created_at DESC`
    );
    res.status(200).json({ jobs: result.rows });
  } catch (err) {
    console.error('Get jobs error:', err.message);
    res.status(500).json({ message: 'Server error fetching jobs.' });
  }
};

// GET JOB BY ID - returns any status job
const getJobById = async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await pool.query(
      `SELECT j.*, u.full_name AS customer_name, u.phone AS customer_phone
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       WHERE j.id = $1`,
      [jobId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    res.status(200).json({ job: result.rows[0] });
  } catch (err) {
    console.error('Get job error:', err.message);
    res.status(500).json({ message: 'Server error fetching job.' });
  }
};

// GET CUSTOMER OWN JOBS - all statuses
const getMyJobs = async (req, res) => {
  const customerId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT * FROM jobs
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );
    res.status(200).json({ jobs: result.rows });
  } catch (err) {
    console.error('Get my jobs error:', err.message);
    res.status(500).json({ message: 'Server error fetching your jobs.' });
  }
};

// DELETE A JOB
const deleteJob = async (req, res) => {
  const customerId = req.user.id;
  const { jobId } = req.params;

  try {
    const jobCheck = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not yours.' });
    }

    if (jobCheck.rows[0].status !== 'open') {
      return res.status(400).json({ message: 'Only open jobs can be deleted.' });
    }

    await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
    res.status(200).json({ message: 'Job deleted successfully!' });
  } catch (err) {
    console.error('Delete job error:', err.message);
    res.status(500).json({ message: 'Server error deleting job.' });
  }
};

// UPDATE A JOB
const updateJob = async (req, res) => {
  const customerId = req.user.id;
  const { jobId } = req.params;
  const { title, description, rate, location, labor_type, urgency, workers_needed } = req.body;

  try {
    const jobCheck = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not yours.' });
    }

    if (jobCheck.rows[0].status !== 'open') {
      return res.status(400).json({ message: 'Only open jobs can be edited.' });
    }

    const result = await pool.query(
      `UPDATE jobs SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        rate = COALESCE($3, rate),
        location = COALESCE($4, location),
        labor_type = COALESCE($5, labor_type),
        urgency = COALESCE($6, urgency),
        workers_needed = COALESCE($7, workers_needed)
       WHERE id = $8 AND customer_id = $9
       RETURNING *`,
      [title, description, rate, location, labor_type, urgency, workers_needed, jobId, customerId]
    );

    res.status(200).json({ message: 'Job updated successfully!', job: result.rows[0] });
  } catch (err) {
    console.error('Update job error:', err.message);
    res.status(500).json({ message: 'Server error updating job.' });
  }
};

module.exports = { upload, postJob, getJobs, getJobById, getMyJobs, deleteJob, updateJob };