const pool = require('../config/db');

const getApplications = async (req, res) => {
  const { jobId } = req.params;
  const customerId = req.user.id;
  try {
    const jobCheck = await pool.query(
      'SELECT id FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );
    if (jobCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const result = await pool.query(
      `SELECT a.id, a.worker_id, a.job_id, a.status, a.created_at,
              u.full_name, u.phone,
              wp.skills, wp.rating, wp.total_ratings
       FROM applications a
       JOIN users u ON u.id = a.worker_id
       LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_id
       WHERE a.job_id = $1
       ORDER BY a.created_at DESC`,
      [jobId]
    );
    res.status(200).json({ applicants: result.rows });
  } catch (err) {
    console.error('Get applications error:', err.message);
    res.status(500).json({ message: 'Server error fetching applications.' });
  }
};

const applyForJob = async (req, res) => {
  const workerId = req.user.id;
  const { jobId } = req.params;
  try {
    // Check if already applied
    const existing = await pool.query(
      'SELECT id FROM applications WHERE job_id = $1 AND worker_id = $2',
      [jobId, workerId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'You have already applied for this job.' });
    }

    // Check job is open
    const jobCheck = await pool.query(
      "SELECT id FROM jobs WHERE id = $1 AND status = 'open'",
      [jobId]
    );
    if (jobCheck.rows.length === 0) {
      return res.status(400).json({ message: 'This job is no longer accepting applications.' });
    }

    // Auto-create worker_profile if missing (fixes the apply error)
    await pool.query(
      `INSERT INTO worker_profiles (user_id, skills, rating, total_ratings)
       VALUES ($1, '{}', 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [workerId]
    );

    // Insert application
    await pool.query(
      'INSERT INTO applications (job_id, worker_id) VALUES ($1, $2)',
      [jobId, workerId]
    );

    res.status(201).json({ message: 'Application submitted successfully!' });
  } catch (err) {
    console.error('Apply for job error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const selectWorker = async (req, res) => {
  const customerId = req.user.id;
  const { jobId, workerId } = req.params;
  try {
    const jobCheck = await pool.query(
      'SELECT * FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    // Assign worker — delete existing row first to avoid duplicate issues
    await pool.query('DELETE FROM assigned_workers WHERE job_id = $1', [jobId]);
    try {
      await pool.query(
        `INSERT INTO assigned_workers (job_id, worker_id, assigned_at) VALUES ($1, $2, NOW())`,
        [jobId, workerId]
      );
    } catch (e) {
      await pool.query(
        `INSERT INTO assigned_workers (job_id, worker_id) VALUES ($1, $2)`,
        [jobId, workerId]
      );
    }

    // Arrival deadline:
    // - Urgent:    NOW + 30 minutes (worker must arrive within 30 min of selection)
    // - Scheduled: exactly scheduled_time (worker must arrive by the scheduled time;
    //              the 30-min countdown starts at scheduled_time - 30 min)
    const jobData = await pool.query('SELECT urgency, scheduled_time FROM jobs WHERE id = $1', [jobId]);
    const job = jobData.rows[0];
    const deadlineExpr = (job.urgency === 'scheduled' && job.scheduled_time)
      ? `'${new Date(job.scheduled_time).toISOString()}'`
      : `NOW() + INTERVAL '30 minutes'`;
    await pool.query(
      `UPDATE jobs SET status = 'assigned', arrival_deadline = ${deadlineExpr} WHERE id = $1`,
      [jobId]
    );

    // Update application statuses
    await pool.query(
      `UPDATE applications SET status = 'accepted' WHERE job_id = $1 AND worker_id = $2`,
      [jobId, workerId]
    );
    await pool.query(
      `UPDATE applications SET status = 'rejected' WHERE job_id = $1 AND worker_id != $2`,
      [jobId, workerId]
    );

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(`DELETE FROM otps WHERE job_id = $1`, [jobId]);
    await pool.query(
      `INSERT INTO otps (job_id, otp_code, is_used) VALUES ($1, $2, false)`,
      [jobId, otpCode]
    );

    // Emit socket notifications
    const io = req.app.get('io');
    if (io) {
      // Get customer name for notification message
      const custRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [customerId]).catch(() => null);
      const customerName = custRes?.rows[0]?.full_name || 'the customer';

      // Notify selected worker
      io.to(`user_${workerId}`).emit('job_notification', {
        type: 'selected',
        jobId,
        message: `🎉 Congratulations! You have been selected for the job by ${customerName}. Your status is now Assigned.`,
      });

      // Notify rejected workers
      const rejectedRes = await pool.query(
        `SELECT worker_id FROM applications WHERE job_id = $1 AND worker_id != $2 AND status = 'rejected'`,
        [jobId, workerId]
      ).catch(() => ({ rows: [] }));

      for (const row of rejectedRes.rows) {
        io.to(`user_${row.worker_id}`).emit('job_notification', {
          type: 'rejected',
          jobId,
          message: `Unfortunately, you were not selected for the job by ${customerName}. This job is now marked as Rejected in your applications.`,
        });
      }
    }

    res.status(200).json({ message: 'Worker selected successfully!', otp_code: otpCode });
  } catch (err) {
    console.error('Select worker error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getMyApplications = async (req, res) => {
  const workerId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT a.id AS application_id, a.job_id, a.status, a.created_at,
              j.title, j.labor_type, j.rate, j.location, j.status AS job_status,
              u.full_name AS customer_name
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN users u ON u.id = j.customer_id
       WHERE a.worker_id = $1
       ORDER BY a.created_at DESC`,
      [workerId]
    );
    res.status(200).json({ applications: result.rows });
  } catch (err) {
    console.error('Get my applications error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

const getAssignedWorker = async (req, res) => {
  const { jobId } = req.params;
  const customerId = req.user.id;
  try {
    // Verify job belongs to customer
    const jobCheck = await pool.query(
      'SELECT id FROM jobs WHERE id = $1 AND customer_id = $2',
      [jobId, customerId]
    );
    if (jobCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Get accepted worker for this job
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone,
              wp.skills, wp.rating, wp.total_ratings, wp.is_online
       FROM assigned_workers aw
       JOIN users u ON u.id = aw.worker_id
       LEFT JOIN worker_profiles wp ON wp.user_id = aw.worker_id
       WHERE aw.job_id = $1
       LIMIT 1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ worker: null });
    }
    res.status(200).json({ worker: result.rows[0] });
  } catch (err) {
    console.error('Get assigned worker error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// GET /api/applications/:jobId/customer-address
// Only available to the assigned worker after selection
const getCustomerAddress = async (req, res) => {
  const { jobId } = req.params;
  const workerId = req.user.id;
  try {
    // Verify this worker is assigned to the job
    const check = await pool.query(
      `SELECT u.address, u.full_name, u.phone, j.location
       FROM assigned_workers aw
       JOIN jobs j ON j.id = aw.job_id
       JOIN users u ON u.id = j.customer_id
       WHERE aw.job_id = $1 AND aw.worker_id = $2`,
      [jobId, workerId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'You are not assigned to this job.' });
    }
    const row = check.rows[0];
    res.status(200).json({
      address: row.address,
      customer_name: row.full_name,
      phone: row.phone,
      area: row.location, // job area/city
    });
  } catch (err) {
    console.error('Get customer address error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getApplications, applyForJob, selectWorker, getMyApplications, getAssignedWorker, getCustomerAddress };