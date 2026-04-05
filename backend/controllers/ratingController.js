const pool = require('../config/db');

const rateWorker = async (req, res) => {
  const customerId = req.user.id;
  const { jobId } = req.params;
  const { score, review } = req.body;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ message: 'Score must be between 1 and 5.' });
  }

  try {
    // Verify job is completed and belongs to customer
    const jobCheck = await pool.query(
      `SELECT j.id, j.status, j.customer_id, aw.worker_id
       FROM jobs j
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1 AND j.customer_id = $2`,
      [jobId, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or does not belong to you.' });
    }

    const job = jobCheck.rows[0];

    if (job.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review completed jobs.' });
    }

    if (!job.worker_id) {
      return res.status(400).json({ message: 'No worker assigned to this job.' });
    }

    // Check if already rated
    const existingRating = await pool.query(
      'SELECT id FROM ratings WHERE job_id = $1 AND customer_id = $2',
      [jobId, customerId]
    );
    if (existingRating.rows.length > 0) {
      return res.status(400).json({ message: 'You have already rated this job.' });
    }

    // Save rating
    await pool.query(
      `INSERT INTO ratings (job_id, customer_id, worker_id, score, review)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, customerId, job.worker_id, score, review || null]
    );

    // Update worker average rating
    const ratingStats = await pool.query(
      `SELECT AVG(score) AS avg_rating, COUNT(id) AS total_ratings
       FROM ratings WHERE worker_id = $1`,
      [job.worker_id]
    );

    const avgRating = parseFloat(ratingStats.rows[0].avg_rating).toFixed(2);
    const totalRatings = parseInt(ratingStats.rows[0].total_ratings);

    await pool.query(
      `UPDATE worker_profiles SET rating = $1, total_ratings = $2 WHERE user_id = $3`,
      [avgRating, totalRatings, job.worker_id]
    );

    res.status(201).json({
      message: 'Thank you for your review!',
      rating: { job_id: jobId, score, review: review || null, worker_new_rating: avgRating, total_ratings: totalRatings },
    });

  } catch (err) {
    console.error('Rate worker error:', err.message);
    res.status(500).json({ message: 'Server error submitting rating: ' + err.message });
  }
};

const getWorkerRatings = async (req, res) => {
  const { workerId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.score, r.review, r.created_at,
              u.full_name AS customer_name,
              j.title AS job_title
       FROM ratings r
       JOIN users u ON u.id = r.customer_id
       JOIN jobs j ON j.id = r.job_id
       WHERE r.worker_id = $1
       ORDER BY r.created_at DESC`,
      [workerId]
    );
    res.status(200).json({ ratings: result.rows });
  } catch (err) {
    console.error('Get ratings error:', err.message);
    res.status(500).json({ message: 'Server error fetching ratings.' });
  }
};

module.exports = { rateWorker, getWorkerRatings };