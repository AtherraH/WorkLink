const pool = require('../config/db');

// POST /api/payments/initiate
// Creates payment record if it doesn't exist (safe to call multiple times)
const initiatePayment = async (req, res) => {
  const customerId = req.user.id;
  const { job_id, amount } = req.body;

  if (!job_id || !amount) {
    return res.status(400).json({ message: 'Job ID and amount are required.' });
  }

  try {
    // Verify job belongs to customer (remove status=completed check — job may just have finished)
    const jobCheck = await pool.query(
      `SELECT j.*, aw.worker_id
       FROM jobs j
       JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1 AND j.customer_id = $2`,
      [job_id, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or no worker assigned.' });
    }

    const job = jobCheck.rows[0];

    // Upsert — if record exists return it, otherwise create it
    const existing = await pool.query(
      'SELECT * FROM payments WHERE job_id = $1',
      [job_id]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        message: 'Payment record already exists.',
        payment: existing.rows[0],
      });
    }

    const result = await pool.query(
      `INSERT INTO payments (job_id, customer_id, worker_id, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [job_id, customerId, job.worker_id, amount]
    );

    res.status(201).json({
      message: 'Payment record created.',
      payment: result.rows[0],
    });

  } catch (err) {
    console.error('Initiate payment error:', err.message);
    res.status(500).json({ message: 'Server error initiating payment.' });
  }
};

// PUT /api/payments/:jobId/sent
// Customer marks payment as sent — auto-creates record if missing
const markPaymentSent = async (req, res) => {
  const customerId = req.user.id;
  const { jobId } = req.params;

  try {
    // Auto-create payment record if it doesn't exist
    const existing = await pool.query(
      'SELECT * FROM payments WHERE job_id = $1',
      [jobId]
    );

    if (existing.rows.length === 0) {
      // Get job info to create record
      const jobRes = await pool.query(
        `SELECT j.rate, aw.worker_id FROM jobs j
         JOIN assigned_workers aw ON aw.job_id = j.id
         WHERE j.id = $1 AND j.customer_id = $2`,
        [jobId, customerId]
      );
      if (jobRes.rows.length === 0) {
        return res.status(404).json({ message: 'Job not found.' });
      }
      const { rate, worker_id } = jobRes.rows[0];
      await pool.query(
        `INSERT INTO payments (job_id, customer_id, worker_id, amount)
         VALUES ($1, $2, $3, $4)`,
        [jobId, customerId, worker_id, rate]
      );
    }

    const result = await pool.query(
      `UPDATE payments
       SET payment_sent = true, sent_at = NOW()
       WHERE job_id = $1 AND customer_id = $2
       RETURNING *`,
      [jobId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    res.status(200).json({
      message: 'Payment marked as sent! Waiting for worker to confirm receipt.',
      payment: result.rows[0],
    });

  } catch (err) {
    console.error('Mark payment sent error:', err.message);
    res.status(500).json({ message: 'Server error marking payment sent.' });
  }
};

// PUT /api/payments/:jobId/received
// Worker confirms payment received
const markPaymentReceived = async (req, res) => {
  const workerId = req.user.id;
  const { jobId } = req.params;

  try {
    // Allow confirmation even if payment_sent is not set (in case of sync issues)
    const result = await pool.query(
      `UPDATE payments
       SET payment_received = true, received_at = NOW()
       WHERE job_id = $1 AND worker_id = $2
       RETURNING *`,
      [jobId, workerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment record not found for this job.' });
    }

    res.status(200).json({
      message: 'Payment confirmed received!',
      payment: result.rows[0],
    });

  } catch (err) {
    console.error('Mark payment received error:', err.message);
    res.status(500).json({ message: 'Server error marking payment received.' });
  }
};

// GET /api/payments/:jobId
const getPaymentStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        j.title AS job_title,
        uc.full_name AS customer_name,
        uw.full_name AS worker_name
       FROM payments p
       JOIN jobs j ON j.id = p.job_id
       JOIN users uc ON uc.id = p.customer_id
       JOIN users uw ON uw.id = p.worker_id
       WHERE p.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      // Return null payment instead of 404 — frontend handles null gracefully
      return res.status(200).json({ payment: null });
    }

    res.status(200).json({ payment: result.rows[0] });

  } catch (err) {
    console.error('Get payment status error:', err.message);
    res.status(500).json({ message: 'Server error fetching payment status.' });
  }
};

module.exports = {
  initiatePayment,
  markPaymentSent,
  markPaymentReceived,
  getPaymentStatus,
};