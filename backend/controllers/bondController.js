const pool = require('../config/db');

// =====================
// CALCULATE NO-SHOW PROBABILITY
// =====================
const calculateNoShowProbability = async (workerId) => {
  const historyResult = await pool.query(
    `SELECT
      COUNT(CASE WHEN ja.status = 'accepted' THEN 1 END) AS total_accepted,
      COUNT(CASE WHEN j.status = 'completed' THEN 1 END) AS total_completed,
      COUNT(CASE WHEN j.status = 'cancelled' THEN 1 END) AS total_cancelled,
      MAX(wp.rating) AS rating,
      MAX(wp.total_ratings) AS total_ratings
     FROM job_applications ja
     JOIN jobs j ON j.id = ja.job_id
     JOIN worker_profiles wp ON wp.user_id = ja.worker_id
     WHERE ja.worker_id = $1`,
    [workerId]
  );

  const history = historyResult.rows[0];
  const totalAccepted = parseInt(history.total_accepted) || 0;
  const totalCompleted = parseInt(history.total_completed) || 0;
  const totalCancelled = parseInt(history.total_cancelled) || 0;
  const rating = parseFloat(history.rating) || 0;
  const totalRatings = parseInt(history.total_ratings) || 0;

  // New worker with no history — medium risk
  if (totalAccepted === 0) {
    return 50.00;
  }

  let riskScore = 0;

  // Cancellation risk (+30 per cancellation)
  riskScore += totalCancelled * 30;

  // Completion reduces risk (-5 per completion)
  riskScore -= totalCompleted * 5;

  // Low rating increases risk
  if (rating < 3 && totalRatings > 0) {
    riskScore += 20;
  }

  // Cap between 0 and 100
  riskScore = Math.max(0, Math.min(100, riskScore));

  return parseFloat(riskScore.toFixed(2));
};

// =====================
// CALCULATE BOND AMOUNT BASED ON RISK
// =====================
const calculateBondAmount = (noShowProbability, jobRate) => {
  if (noShowProbability >= 70) return parseFloat(jobRate) * 0.3;
  if (noShowProbability >= 40) return parseFloat(jobRate) * 0.2;
  if (noShowProbability >= 20) return parseFloat(jobRate) * 0.1;
  return parseFloat(jobRate) * 0.05;
};

// =====================
// CREATE BOND
// POST /api/bonds/create
// =====================
const createBond = async (req, res) => {
  const { job_id, worker_id } = req.body;

  try {
    const jobResult = await pool.query(
      'SELECT * FROM jobs WHERE id = $1',
      [job_id]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobResult.rows[0];

    const noShowProbability = await calculateNoShowProbability(worker_id);
    const bondAmount = calculateBondAmount(noShowProbability, job.rate);

    const existingBond = await pool.query(
      'SELECT id FROM commitment_bonds WHERE job_id = $1 AND worker_id = $2',
      [job_id, worker_id]
    );

    if (existingBond.rows.length > 0) {
      return res.status(400).json({ message: 'Bond already exists for this job.' });
    }

    const result = await pool.query(
      `INSERT INTO commitment_bonds 
        (job_id, worker_id, bond_amount, no_show_probability)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [job_id, worker_id, bondAmount, noShowProbability]
    );

    res.status(201).json({
      message: 'Commitment bond created successfully.',
      bond: result.rows[0],
      risk_level: noShowProbability >= 70 ? 'HIGH' :
                  noShowProbability >= 40 ? 'MEDIUM' :
                  noShowProbability >= 20 ? 'LOW' : 'VERY LOW',
    });

  } catch (err) {
    console.error('Create bond error:', err.message);
    res.status(500).json({ message: 'Server error creating bond.' });
  }
};

// =====================
// GET BOND FOR A JOB
// GET /api/bonds/:jobId
// =====================
const getBond = async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        cb.*,
        u.full_name AS worker_name,
        j.title AS job_title,
        j.rate AS job_rate
       FROM commitment_bonds cb
       JOIN users u ON u.id = cb.worker_id
       JOIN jobs j ON j.id = cb.job_id
       WHERE cb.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No bond found for this job.' });
    }

    res.status(200).json({
      bond: result.rows[0],
    });

  } catch (err) {
    console.error('Get bond error:', err.message);
    res.status(500).json({ message: 'Server error fetching bond.' });
  }
};

// =====================
// FORFEIT BOND
// PUT /api/bonds/:jobId/forfeit
// =====================
const forfeitBond = async (req, res) => {
  const { jobId } = req.params;
  const customerId = req.user.id;

  try {
    const jobCheck = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not yours.' });
    }

    const result = await pool.query(
      `UPDATE commitment_bonds
       SET status = 'forfeited'
       WHERE job_id = $1 AND status = 'active'
       RETURNING *`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No active bond found for this job.' });
    }

    await pool.query(
      `UPDATE jobs SET status = 'cancelled' WHERE id = $1`,
      [jobId]
    );

    res.status(200).json({
      message: `Bond of ₹${result.rows[0].bond_amount} forfeited due to worker no-show or cancellation.`,
      bond: result.rows[0],
    });

  } catch (err) {
    console.error('Forfeit bond error:', err.message);
    res.status(500).json({ message: 'Server error forfeiting bond.' });
  }
};

// =====================
// RELEASE BOND
// PUT /api/bonds/:jobId/release
// =====================
const releaseBond = async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await pool.query(
      `UPDATE commitment_bonds
       SET status = 'released'
       WHERE job_id = $1 AND status = 'active'
       RETURNING *`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No active bond found for this job.' });
    }

    res.status(200).json({
      message: 'Bond released successfully. Job completed!',
      bond: result.rows[0],
    });

  } catch (err) {
    console.error('Release bond error:', err.message);
    res.status(500).json({ message: 'Server error releasing bond.' });
  }
};

module.exports = {
  createBond,
  getBond,
  forfeitBond,
  releaseBond,
};