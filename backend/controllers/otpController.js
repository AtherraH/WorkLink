const pool = require('../config/db');

// VERIFY OTP (Worker enters OTP on arrival)
// POST /api/otp/verify
const verifyOTP = async (req, res) => {
  const workerId = req.user.id;
  // job_id comes from URL param (:jobId/verify) OR from body (fallback)
  const job_id = req.params.jobId || req.body.job_id;
  const { otp_code } = req.body;

  if (!job_id || !otp_code) {
    return res.status(400).json({ message: 'Job ID and OTP code are required.' });
  }

  try {
    // Check deadline — worker cannot verify OTP after arrival deadline
    // (unless customer chose Wait, in which case wait_until gives extra time)
    const jobCheck = await pool.query(
      `SELECT arrival_deadline, wait_until, status FROM jobs WHERE id = $1`,
      [job_id]
    );
    if (jobCheck.rows.length > 0) {
      const jobRow = jobCheck.rows[0];
      const now = new Date();
      const deadline = jobRow.arrival_deadline ? new Date(jobRow.arrival_deadline) : null;
      const waitUntil = jobRow.wait_until ? new Date(jobRow.wait_until) : null;

      if (deadline && now > deadline) {
        // Past deadline — only allow if customer chose Wait and wait window is still open
        if (!waitUntil || now > waitUntil) {
          return res.status(400).json({
            message: 'Arrival deadline has passed. You can no longer verify OTP for this job.'
          });
        }
      }
    }

    // Find OTP
    const otpResult = await pool.query(
      `SELECT * FROM otps WHERE job_id = $1 AND otp_code = $2 AND is_used = false`,
      [job_id, otp_code]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or already used OTP.' });
    }

    const otp = otpResult.rows[0];

    // Mark OTP as used
    await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otp.id]);

    // Record entry time — try with worker_id match first, then fallback
    const entryTime = new Date();
    const updateResult = await pool.query(
      `UPDATE assigned_workers SET entry_time = $1 WHERE job_id = $2 AND worker_id = $3`,
      [entryTime, job_id, workerId]
    );

    // If no row updated, worker_id mismatch — fix it
    if (updateResult.rowCount === 0) {
      await pool.query(
        `UPDATE assigned_workers SET entry_time = $1, worker_id = $2 WHERE job_id = $3`,
        [entryTime, workerId, job_id]
      );
    }

    // Update job status to in_progress and clear wait_until
    await pool.query(
      `UPDATE jobs SET status = 'in_progress', wait_until = NULL WHERE id = $1`,
      [job_id]
    );

    res.status(200).json({
      message: 'OTP verified! Job is now in progress.',
      entry_time: entryTime,
      job_id: job_id,
    });

  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).json({ message: 'Server error verifying OTP.' });
  }
};

// GET OTP FOR A JOB (Customer or assigned worker can view OTP)
// GET /api/otp/:jobId
const getOTP = async (req, res) => {
  const userId = req.user.id;
  const { jobId } = req.params;

  try {
    // Allow access if user is the customer OR the assigned worker
    const jobCheck = await pool.query(
      `SELECT j.* FROM jobs j
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1 AND (j.customer_id = $2 OR aw.worker_id = $2)
       LIMIT 1`,
      [jobId, userId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not yours.' });
    }

    const otpResult = await pool.query(
      `SELECT otp_code, is_used, created_at FROM otps WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [jobId]
    );

    if (otpResult.rows.length === 0) {
      return res.status(404).json({ message: 'No OTP found for this job.' });
    }

    const otp = otpResult.rows[0];

    // Return in both formats so customer and worker UIs both work
    res.status(200).json({
      otp_code: otp.otp_code,
      is_used: otp.is_used,
      otp: { otp_code: otp.otp_code, is_used: otp.is_used },
      message: otp.is_used
        ? 'OTP already used. Worker has arrived.'
        : 'Share this OTP with the worker when they arrive.',
    });

  } catch (err) {
    console.error('Get OTP error:', err.message);
    res.status(500).json({ message: 'Server error fetching OTP.' });
  }
};

// REGENERATE OTP
// POST /api/otp/regenerate
const regenerateOTP = async (req, res) => {
  const customerId = req.user.id;
  const { job_id } = req.body;

  try {
    const jobCheck = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [job_id, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not yours.' });
    }

    // Mark old OTPs as used
    await pool.query(`UPDATE otps SET is_used = true WHERE job_id = $1 AND is_used = false`, [job_id]);

    // Generate new 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(`INSERT INTO otps (job_id, otp_code, is_used) VALUES ($1, $2, false)`, [job_id, otpCode]);

    res.status(200).json({ message: 'New OTP generated.', otp_code: otpCode });

  } catch (err) {
    console.error('Regenerate OTP error:', err.message);
    res.status(500).json({ message: 'Server error regenerating OTP.' });
  }
};

module.exports = { verifyOTP, getOTP, regenerateOTP };