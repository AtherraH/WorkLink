const pool = require('../config/db');

// GET OWN PROFILE
const getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT wp.*, u.full_name, u.email, u.phone, u.created_at, u.is_online
       FROM worker_profiles wp
       JOIN users u ON u.id = wp.user_id
       WHERE wp.user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO worker_profiles (user_id, skills, rating, total_ratings)
         VALUES ($1, '{}', 0, 0)`,
        [userId]
      );
      const newResult = await pool.query(
        `SELECT wp.*, u.full_name, u.email, u.phone, u.created_at, u.is_online
         FROM worker_profiles wp
         JOIN users u ON u.id = wp.user_id
         WHERE wp.user_id = $1`,
        [userId]
      );
      return res.status(200).json({ profile: newResult.rows[0] });
    }
    res.status(200).json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// UPDATE OWN PROFILE
const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { bio, skills, hourly_rate, phone, full_name } = req.body;
  try {
    // skills must be passed as a native PostgreSQL TEXT[] array, not JSON string
    const skillsArray = Array.isArray(skills) ? skills : [];

    // Try updating with bio and hourly_rate (requires migration columns to exist)
    // Fall back to skills-only update if columns are missing
    try {
      await pool.query(
        `UPDATE worker_profiles
         SET skills      = $1,
             bio         = $2,
             hourly_rate = $3
         WHERE user_id = $4`,
        [
          skillsArray,
          bio !== undefined && bio !== null ? bio : '',
          hourly_rate !== undefined && hourly_rate !== '' && hourly_rate !== null
            ? parseFloat(hourly_rate)
            : null,
          userId,
        ]
      );
    } catch (colErr) {
      // bio/hourly_rate columns may not exist yet — fall back to skills only
      console.warn('bio/hourly_rate columns missing, updating skills only:', colErr.message);
      await pool.query(
        `UPDATE worker_profiles SET skills = $1 WHERE user_id = $2`,
        [skillsArray, userId]
      );
    }

    // Update users table: full_name, phone
    if (phone || full_name) {
      await pool.query(
        `UPDATE users SET
           phone      = COALESCE($1, phone),
           full_name  = COALESCE($2, full_name)
         WHERE id = $3`,
        [phone || null, full_name || null, userId]
      );
    }
    res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// TOGGLE ONLINE STATUS
const toggleOnline = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `UPDATE users SET is_online = NOT is_online WHERE id = $1 RETURNING is_online`,
      [userId]
    );
    res.status(200).json({ is_online: result.rows[0].is_online });
  } catch (err) {
    console.error('Toggle online error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET PUBLIC WORKER PROFILE
const getWorkerPublicProfile = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT wp.*, u.full_name, u.phone, u.is_online
       FROM worker_profiles wp
       JOIN users u ON u.id = wp.user_id
       WHERE wp.user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Worker not found.' });
    }
    const worker = result.rows[0];

    // Try portfolio table first, then completion_photos, gracefully fall back to []
    let portfolio = [];
    try {
      const portfolioRes = await pool.query(
        `SELECT p.photo_url, p.description AS job_title, p.created_at, p.id
         FROM portfolio p
         WHERE p.worker_id = $1
         ORDER BY p.created_at DESC`,
        [userId]
      );
      portfolio = portfolioRes.rows;
    } catch (e1) {
      try {
        const portfolioRes = await pool.query(
          `SELECT cp.photo_url, j.title AS job_title, cp.created_at, cp.id
           FROM completion_photos cp
           JOIN jobs j ON j.id = cp.job_id
           WHERE cp.worker_id = $1
           ORDER BY cp.created_at DESC`,
          [userId]
        );
        portfolio = portfolioRes.rows;
      } catch (e2) {
        // Neither table exists — return empty portfolio
        portfolio = [];
      }
    }

    res.status(200).json({
      worker: {
        ...worker,
        skills: Array.isArray(worker.skills) ? worker.skills : [],
        portfolio,
      },
    });
  } catch (err) {
    console.error('Get public profile error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// UPDATE LOCATION
const updateLocation = async (req, res) => {
  const userId = req.user.id;
  const { latitude, longitude } = req.body;
  try {
    await pool.query(
      `UPDATE worker_profiles SET latitude = $1, longitude = $2 WHERE user_id = $3`,
      [latitude, longitude, userId]
    );
    res.status(200).json({ message: 'Location updated.' });
  } catch (err) {
    console.error('Update location error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET WORKER LOCATION FOR JOB
const getWorkerLocation = async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await pool.query(
      `SELECT wp.latitude, wp.longitude
       FROM worker_profiles wp
       JOIN assigned_workers aw ON aw.worker_id = wp.user_id
       WHERE aw.job_id = $1`,
      [jobId]
    );
    if (result.rows.length === 0 || !result.rows[0].latitude) {
      return res.status(200).json({ location: null });
    }
    res.status(200).json({ location: result.rows[0] });
  } catch (err) {
    console.error('Get location error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET ASSIGNED JOBS FOR WORKER
const getAssignedJobs = async (req, res) => {
  const workerId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT j.*, u.full_name AS customer_name, u.phone AS customer_phone,
              aw.assigned_at, aw.entry_time, aw.exit_time, aw.completion_photo_url
       FROM jobs j
       JOIN assigned_workers aw ON aw.job_id = j.id
       JOIN users u ON u.id = j.customer_id
       WHERE aw.worker_id = $1
       ORDER BY j.created_at DESC`,
      [workerId]
    );
    res.status(200).json({ jobs: result.rows });
  } catch (err) {
    console.error('Get assigned jobs error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};


const getWorkerJobHistory = async (req, res) => {
  const workerId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT j.id AS job_id, j.title, j.labor_type, j.location, j.rate,
              j.status, j.created_at,
              aw.entry_time, aw.exit_time,
              u.full_name AS customer_name,
              r.score AS customer_rating, r.review AS customer_review
       FROM jobs j
       JOIN assigned_workers aw ON aw.job_id = j.id
       JOIN users u ON u.id = j.customer_id
       LEFT JOIN ratings r ON r.job_id = j.id AND r.rated_id = aw.worker_id
       WHERE aw.worker_id = $1 AND j.status = 'completed'
       ORDER BY aw.exit_time DESC NULLS LAST`,
      [workerId]
    );

    // Try to get completion photos
    const jobIds = result.rows.map(r => r.job_id);
    let photos = {};
    if (jobIds.length > 0) {
      try {
        const photoRes = await pool.query(
          `SELECT job_id, photo_url FROM completion_photos WHERE job_id = ANY($1) ORDER BY uploaded_at DESC`,
          [jobIds]
        );
        photoRes.rows.forEach(p => { if (!photos[p.job_id]) photos[p.job_id] = p.photo_url; });
      } catch (e) {
        try {
          const awPhoto = await pool.query(
            `SELECT job_id, completion_photo_url FROM assigned_workers WHERE job_id = ANY($1)`,
            [jobIds]
          );
          awPhoto.rows.forEach(p => { photos[p.job_id] = p.completion_photo_url; });
        } catch (e2) {}
      }
    }

    const jobs = result.rows.map(row => ({ ...row, completion_photo: photos[row.job_id] || null }));
    res.status(200).json({ jobs });
  } catch (err) {
    console.error('Get job history error:', err.message);
    res.status(500).json({ message: 'Server error fetching job history.' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  toggleOnline,
  getWorkerPublicProfile,
  updateLocation,
  getWorkerLocation,
  getAssignedJobs,
  getWorkerJobHistory,
};