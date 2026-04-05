const pool = require('../config/db');

// =====================
// INITIATE PAYMENT RECORD
// POST /api/payments/initiate
// =====================
const initiatePayment = async (req, res) => {
  const customerId = req.user.id;
  const { job_id, amount } = req.body;

  if (!job_id || !amount) {
    return res.status(400).json({ message: 'Job ID and amount are required.' });
  }

  try {
    // Verify job belongs to customer and is completed
    const jobCheck = await pool.query(
      `SELECT j.*, aw.worker_id
       FROM jobs j
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1 AND j.customer_id = $2 AND j.status = 'completed'`,
      [job_id, customerId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found or not completed yet.' });
    }

    const job = jobCheck.rows[0];

    // Check if payment record already exists
    const existing = await pool.query(
      'SELECT id FROM payments WHERE job_id = $1',
      [job_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Payment record already exists for this job.' });
    }

    // Create payment record
    const result = await pool.query(
      `INSERT INTO payments (job_id, customer_id, worker_id, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [job_id, customerId, job.worker_id, amount]
    );

    res.status(201).json({
      message: 'Payment record created. Click Payment Sent when you send the money.',
      payment: result.rows[0],
    });

  } catch (err) {
    console.error('Initiate payment error:', err.message);
    res.status(500).json({ message: 'Server error initiating payment.' });
  }
};

// =====================
// CUSTOMER CLICKS PAYMENT SENT
// PUT /api/payments/:jobId/sent
// =====================
const markPaymentSent = async (req, res) => {
  const customerId = req.user.id;
  const { jobId } = req.params;

  try {
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

// =====================
// WORKER CLICKS PAYMENT RECEIVED
// PUT /api/payments/:jobId/received
// =====================
const markPaymentReceived = async (req, res) => {
  const workerId = req.user.id;
  const { jobId } = req.params;

  try {
    // Try direct worker_id match first
    let result = await pool.query(
      `UPDATE payments
       SET payment_received = true, received_at = NOW()
       WHERE job_id = $1 AND worker_id = $2 AND payment_sent = true
       RETURNING *`,
      [jobId, workerId]
    );

    // Fallback: if worker_id mismatch, verify via assigned_workers then update
    if (result.rows.length === 0) {
      const assignCheck = await pool.query(
        `SELECT p.id FROM payments p
         JOIN assigned_workers aw ON aw.job_id = p.job_id
         WHERE p.job_id = $1 AND aw.worker_id = $2 AND p.payment_sent = true`,
        [jobId, workerId]
      );
      if (assignCheck.rows.length > 0) {
        // Fix worker_id and mark received
        result = await pool.query(
          `UPDATE payments
           SET payment_received = true, received_at = NOW(), worker_id = $2
           WHERE job_id = $1 AND payment_sent = true
           RETURNING *`,
          [jobId, workerId]
        );
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment not found or not yet sent by customer.' });
    }

    res.status(200).json({
      message: 'Payment received confirmed! Please wait for customer rating.',
      payment: result.rows[0],
    });

  } catch (err) {
    console.error('Mark payment received error:', err.message);
    res.status(500).json({ message: 'Server error marking payment received.' });
  }
};

// =====================
// GET PAYMENT STATUS
// GET /api/payments/:jobId
// =====================
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
      return res.status(404).json({ message: 'No payment record found for this job.' });
    }

    res.status(200).json({
      payment: result.rows[0],
    });

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