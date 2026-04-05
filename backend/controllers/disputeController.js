const pool = require('../config/db');

// POST /api/disputes/:jobId — raise a dispute
const raiseDispute = async (req, res) => {
  const reporterId = req.user.id;
  const { jobId } = req.params;
  const { reason, description } = req.body;

  if (!reason) return res.status(400).json({ message: 'Reason is required.' });

  try {
    // Get job + parties
    const jobRes = await pool.query(
      `SELECT j.*, u.full_name AS customer_name,
              aw.worker_id, uw.full_name AS worker_name
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       LEFT JOIN users uw ON uw.id = aw.worker_id
       WHERE j.id = $1`, [jobId]
    );
    if (jobRes.rows.length === 0) return res.status(404).json({ message: 'Job not found.' });
    const job = jobRes.rows[0];

    // Determine reported party
    const isCustomer = reporterId === job.customer_id;
    const reportedId = isCustomer ? job.worker_id : job.customer_id;
    if (!reportedId) return res.status(400).json({ message: 'No other party to dispute.' });

    // Insert dispute
    await pool.query(
      `INSERT INTO disputes (job_id, reporter_id, reported_id, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, 'open')`,
      [jobId, reporterId, reportedId, reason, description || reason]
    );

    // Notify admin via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('admin_notification', {
        type: 'dispute',
        message: `⚠️ New dispute raised for job "${job.title}"`,
        jobId,
      });
    }

    res.status(201).json({ message: 'Dispute raised. Admin has been notified.' });
  } catch (err) {
    console.error('Raise dispute error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// GET /api/disputes/my-disputes
const getMyDisputes = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT d.*, j.title AS job_title,
              ur.full_name AS reporter_name, ur.role AS reporter_role,
              up.full_name AS reported_name, up.role AS reported_role
       FROM disputes d
       LEFT JOIN jobs j ON j.id = d.job_id
       LEFT JOIN users ur ON ur.id = d.reporter_id
       LEFT JOIN users up ON up.id = d.reported_id
       WHERE d.reporter_id = $1 OR d.reported_id = $1
       ORDER BY d.created_at DESC`,
      [userId]
    );
    res.status(200).json({ disputes: result.rows });
  } catch (err) {
    console.error('Get my disputes error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// PUT /api/disputes/:disputeId/reopen  
const reopenDispute = async (req, res) => {
  const { disputeId } = req.params;
  try {
    await pool.query(
      `UPDATE disputes SET status = 'open', resolution = NULL WHERE id = $1`,
      [disputeId]
    );
    res.status(200).json({ message: 'Dispute reopened.' });
  } catch (err) {
    console.error('Reopen dispute error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { raiseDispute, getMyDisputes, reopenDispute };