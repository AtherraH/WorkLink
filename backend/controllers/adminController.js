const pool = require('../config/db');

const getStats = async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const workers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'worker'");
    const customers = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'customer'");
    const onlineWorkers = await pool.query('SELECT COUNT(*) FROM worker_profiles WHERE is_online = true');
    const totalJobs = await pool.query('SELECT COUNT(*) FROM jobs');
    const openJobs = await pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'open'");
    const completedJobs = await pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'completed'");
    const cancelledJobs = await pool.query("SELECT COUNT(*) FROM jobs WHERE status = 'cancelled'");
    const totalPayments = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE payment_received = true');
    const forfeitedBonds = await pool.query("SELECT COUNT(*) FROM commitment_bonds WHERE status = 'forfeited'");
    const bannedUsers = await pool.query('SELECT COUNT(*) FROM users WHERE is_banned = true');

    let openDisputes = { rows: [{ count: '0' }] };
    try {
      openDisputes = await pool.query("SELECT COUNT(*) FROM disputes WHERE status = 'open'");
    } catch (e) {}

    res.status(200).json({
      stats: {
        total_users: parseInt(users.rows[0].count),
        total_workers: parseInt(workers.rows[0].count),
        total_customers: parseInt(customers.rows[0].count),
        online_workers: parseInt(onlineWorkers.rows[0].count),
        total_jobs: parseInt(totalJobs.rows[0].count),
        open_jobs: parseInt(openJobs.rows[0].count),
        completed_jobs: parseInt(completedJobs.rows[0].count),
        cancelled_jobs: parseInt(cancelledJobs.rows[0].count),
        total_payments: parseFloat(totalPayments.rows[0].total),
        forfeited_bonds: parseInt(forfeitedBonds.rows[0].count),
        banned_users: parseInt(bannedUsers.rows[0].count),
        open_disputes: parseInt(openDisputes.rows[0].count),
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id, u.full_name, u.email, u.phone, u.role,
        u.is_banned, u.ban_reason, u.warn_count, u.created_at,
        wp.rating, wp.total_ratings, wp.is_online, wp.skills
       FROM users u
       LEFT JOIN worker_profiles wp ON wp.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error('Admin get users error:', err.message);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
};

const getJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, u.full_name AS customer_name
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       ORDER BY j.created_at DESC`
    );
    res.status(200).json({ jobs: result.rows });
  } catch (err) {
    console.error('Admin get jobs error:', err.message);
    res.status(500).json({ message: 'Server error fetching jobs.' });
  }
};

const getPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, j.title AS job_title,
        uc.full_name AS customer_name,
        uw.full_name AS worker_name
       FROM payments p
       JOIN jobs j ON j.id = p.job_id
       JOIN users uc ON uc.id = p.customer_id
       JOIN users uw ON uw.id = p.worker_id
       ORDER BY p.created_at DESC`
    );
    res.status(200).json({ payments: result.rows });
  } catch (err) {
    console.error('Admin get payments error:', err.message);
    res.status(500).json({ message: 'Server error fetching payments.' });
  }
};

const banUser = async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (userCheck.rows[0].role === 'admin') {
      return res.status(400).json({ message: 'Cannot ban an admin.' });
    }

    await pool.query(
      'UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2',
      [reason || 'No reason provided', userId]
    );

    await pool.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action_type, reason)
       VALUES ($1, $2, 'ban', $3)`,
      [req.user.id, userId, reason || 'No reason provided']
    );

    res.status(200).json({ message: 'User banned successfully.' });
  } catch (err) {
    console.error('Ban user error:', err.message);
    res.status(500).json({ message: 'Server error banning user.' });
  }
};

const unbanUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await pool.query(
      'UPDATE users SET is_banned = false, ban_reason = NULL WHERE id = $1',
      [userId]
    );

    await pool.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action_type, reason)
       VALUES ($1, $2, 'unban', 'User unbanned by admin')`,
      [req.user.id, userId]
    );

    res.status(200).json({ message: 'User unbanned successfully.' });
  } catch (err) {
    console.error('Unban user error:', err.message);
    res.status(500).json({ message: 'Server error unbanning user.' });
  }
};

const warnUser = async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  try {
    await pool.query(
      'UPDATE users SET warn_count = warn_count + 1 WHERE id = $1',
      [userId]
    );

    await pool.query(
      `INSERT INTO admin_actions (admin_id, target_user_id, action_type, reason)
       VALUES ($1, $2, 'warn', $3)`,
      [req.user.id, userId, reason || 'No reason provided']
    );

    res.status(200).json({ message: 'Warning issued successfully.' });
  } catch (err) {
    console.error('Warn user error:', err.message);
    res.status(500).json({ message: 'Server error warning user.' });
  }
};

const getDisputes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        u.full_name AS reporter_name,
        u.role AS reporter_role,
        t.full_name AS reported_name,
        t.role AS reported_role,
        j.title AS job_title
       FROM disputes d
       JOIN users u ON u.id = d.reporter_id
       JOIN users t ON t.id = d.reported_id
       LEFT JOIN jobs j ON j.id = d.job_id
       ORDER BY d.created_at DESC`
    );
    res.status(200).json({ disputes: result.rows });
  } catch (err) {
    console.error('Get disputes error:', err.message);
    res.status(500).json({ message: 'Server error fetching disputes.' });
  }
};

const createDispute = async (req, res) => {
  const reporterId = req.user.id;
  const { reported_id, job_id, reason, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO disputes (reporter_id, reported_id, job_id, reason, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [reporterId, reported_id, job_id || null, reason, description]
    );
    res.status(201).json({ message: 'Dispute filed successfully!', dispute: result.rows[0] });
  } catch (err) {
    console.error('Create dispute error:', err.message);
    res.status(500).json({ message: 'Server error creating dispute.' });
  }
};

const resolveDispute = async (req, res) => {
  const { disputeId } = req.params;
  const { resolution } = req.body;
  try {
    await pool.query(
      `UPDATE disputes SET
        status = 'resolved',
        resolution = $1,
        resolved_by = $2,
        resolved_at = NOW()
       WHERE id = $3`,
      [resolution, req.user.id, disputeId]
    );

    await pool.query(
      `INSERT INTO admin_actions (admin_id, action_type, reason)
       VALUES ($1, 'resolve_dispute', $2)`,
      [req.user.id, resolution]
    );

    res.status(200).json({ message: 'Dispute resolved successfully.' });
  } catch (err) {
    console.error('Resolve dispute error:', err.message);
    res.status(500).json({ message: 'Server error resolving dispute.' });
  }
};

const getAdminActions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT aa.*,
        a.full_name AS admin_name,
        t.full_name AS target_name
       FROM admin_actions aa
       JOIN users a ON a.id = aa.admin_id
       LEFT JOIN users t ON t.id = aa.target_user_id
       ORDER BY aa.created_at DESC
       LIMIT 100`
    );
    res.status(200).json({ actions: result.rows });
  } catch (err) {
    console.error('Get admin actions error:', err.message);
    res.status(500).json({ message: 'Server error fetching actions.' });
  }
};

module.exports = {
  getStats, getUsers, getJobs, getPayments,
  banUser, unbanUser, warnUser,
  getDisputes, createDispute, resolveDispute,
  getAdminActions,
};