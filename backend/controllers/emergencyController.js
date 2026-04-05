const pool = require('../config/db');

// GET /api/emergency/check/:jobId
const checkNoShow = async (req, res) => {
  const { jobId } = req.params;

  try {
    // First fetch job data directly (always works, even if assigned_workers is empty)
    const jobRow = await pool.query(
      `SELECT id, status, urgency, scheduled_time, arrival_deadline, wait_until FROM jobs WHERE id = $1`,
      [jobId]
    );
    if (jobRow.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }
    const jobData = jobRow.rows[0];

    // Then try to get worker arrival entry_time
    const result = await pool.query(
      `SELECT
        aw.entry_time,
        j.status AS job_status,
        j.urgency,
        j.scheduled_time,
        j.arrival_deadline,
        j.wait_until
       FROM assigned_workers aw
       JOIN jobs j ON j.id = aw.job_id
       WHERE aw.job_id = $1
       LIMIT 1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      // No assigned_workers row — check deadline from job directly
      const deadline = jobData.arrival_deadline ? new Date(jobData.arrival_deadline) : null;
      const now = new Date();
      if (deadline && now > deadline) {
        const minutesElapsed = Math.max(0, Math.floor((now - deadline) / 60000) + 30);
        return res.status(200).json({
          is_late: true,
          message: `Worker has not arrived. Deadline was ${deadline.toLocaleTimeString()}.`,
          minutes_elapsed: minutesElapsed,
          minutes_left: 0,
          urgency: jobData.urgency,
          arrival_deadline: deadline.toISOString(),
        });
      }
      return res.status(200).json({
        is_late: false,
        message: 'No worker assigned yet.',
        minutes_elapsed: 0,
        minutes_left: deadline ? Math.max(0, Math.floor((deadline - now) / 60000)) : 30,
        arrival_deadline: deadline?.toISOString() || null,
      });
    }

    const assignment = result.rows[0];

    if (assignment.entry_time) {
      return res.status(200).json({
        is_late: false,
        worker_arrived: true,
        message: 'Worker has already arrived and verified OTP.',
        entry_time: assignment.entry_time,
        minutes_elapsed: 0,
        minutes_left: 30,
      });
    }

    // arrival_deadline is set by DB trigger at job INSERT:
    //   urgent    → created_at + 30 minutes
    //   scheduled → scheduled_time + 30 minutes
    const deadlineRaw = assignment.arrival_deadline;
    if (!deadlineRaw) {
      return res.status(200).json({
        is_late: false,
        message: 'No deadline set.',
        minutes_elapsed: 0,
        minutes_left: 30,
        urgency: assignment.urgency,
      });
    }

    const deadline = new Date(deadlineRaw);
    const now = new Date();
    // The 30-min window always starts 30 minutes before the deadline
    const windowStart = new Date(deadline.getTime() - 30 * 60 * 1000);
    const minutesElapsed = Math.max(0, Math.min(30, Math.floor((now - windowStart) / 60000)));
    const minutesLeft   = Math.max(0, Math.floor((deadline - now) / 60000));
    const isLate = now > deadline;

    // If customer chose "Wait", check if the 10-min wait window has expired → auto-cancel
    const waitUntilRaw = assignment.wait_until;
    if (waitUntilRaw && isLate) {
      const waitUntil = new Date(waitUntilRaw);
      if (now > waitUntil) {
        // Auto-cancel the job
        try {
          await pool.query(
            `UPDATE jobs SET status = 'cancelled', wait_until = NULL WHERE id = $1`,
            [jobId]
          );
        } catch(e) {}
        return res.status(200).json({
          is_late: true,
          auto_cancelled: true,
          message: 'Worker did not arrive within the extra 10 minutes. Job has been cancelled.',
          minutes_elapsed: minutesElapsed,
          minutes_left: 0,
          urgency: assignment.urgency,
          arrival_deadline: deadline.toISOString(),
        });
      }
      // Still inside the wait window
      const waitMinsLeft = Math.max(0, Math.floor((waitUntil - now) / 60000));
      return res.status(200).json({
        is_late: true,
        is_waiting: true,
        wait_mins_left: waitMinsLeft,
        wait_until: waitUntil.toISOString(),
        message: `Waiting ${waitMinsLeft} more minutes for worker to arrive.`,
        minutes_elapsed: minutesElapsed,
        minutes_left: 0,
        urgency: assignment.urgency,
        arrival_deadline: deadline.toISOString(),
      });
    }

    if (isLate) {
      return res.status(200).json({
        is_late: true,
        message: `Worker has not arrived. Deadline was ${deadline.toLocaleTimeString()}.`,
        minutes_elapsed: minutesElapsed,
        minutes_left: 0,
        urgency: assignment.urgency,
        arrival_deadline: deadline.toISOString(),
      });
    }

    return res.status(200).json({
      is_late: false,
      message: `Worker has ${minutesLeft} minutes left to arrive.`,
      minutes_elapsed: minutesElapsed,
      minutes_left: minutesLeft,
      urgency: assignment.urgency,
      arrival_deadline: deadline.toISOString(),
    });

  } catch (err) {
    console.error('Check no-show error:', err.message);
    res.status(500).json({ message: 'Server error checking worker status.' });
  }
};


// POST /api/emergency/trigger/:jobId
const triggerEmergency = async (req, res) => {
  const { jobId } = req.params;

  try {
    // Get job info — use LEFT JOIN so it works even if assigned_workers row is missing
    const jobResult = await pool.query(
      `SELECT j.*, aw.worker_id AS assigned_worker_id
       FROM jobs j
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1
       LIMIT 1`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobResult.rows[0];
    const assignedWorkerId = job.assigned_worker_id; // may be null
    const jobLat = parseFloat(job.latitude);
    const jobLon = parseFloat(job.longitude);
    const hasJobLocation = !isNaN(jobLat) && !isNaN(jobLon);

    // Proximity sort in SQL when job location is available, otherwise by rating
    const proximityOrder = hasJobLocation
      ? `((wp.latitude - ${jobLat})^2 + (wp.longitude - ${jobLon})^2) ASC, wp.rating DESC NULLS LAST`
      : `wp.rating DESC NULLS LAST`;

    // Parameterized helper — no UUID string interpolation (SQL injection safe)
    const makeParams = (base) => assignedWorkerId ? [...base, assignedWorkerId] : base;
    const excludeWhere = (nextIdx) => assignedWorkerId ? `AND u.id != $${nextIdx}` : '';

    const workerBase = `
      SELECT u.id, u.full_name, u.phone, wp.skills, wp.rating, wp.latitude, wp.longitude
      FROM users u
      JOIN worker_profiles wp ON wp.user_id = u.id
      WHERE u.role = 'worker'
    `;

    // Attempt 1: online workers with matching skill, sorted by proximity
    let backupQuery = { rows: [] };
    try {
      backupQuery = await pool.query(
        `${workerBase}
         AND wp.is_online = true
         AND $1 = ANY(wp.skills)
         ${excludeWhere(2)}
         ORDER BY ${proximityOrder}
         LIMIT 3`,
        makeParams([job.labor_type])
      );
    } catch(e) { console.error('Backup attempt 1:', e.message); }

    // Attempt 2: any online workers, sorted by proximity
    if (backupQuery.rows.length === 0) {
      try {
        backupQuery = await pool.query(
          `${workerBase}
           AND wp.is_online = true
           ${excludeWhere(1)}
           ORDER BY ${proximityOrder}
           LIMIT 3`,
          makeParams([])
        );
      } catch(e) { console.error('Backup attempt 2:', e.message); }
    }

    // Attempt 3: any workers at all (offline too), sorted by proximity
    if (backupQuery.rows.length === 0) {
      try {
        backupQuery = await pool.query(
          `${workerBase}
           ${excludeWhere(1)}
           ORDER BY ${proximityOrder}
           LIMIT 3`,
          makeParams([])
        );
      } catch(e) { console.error('Backup attempt 3:', e.message); }
    }

    if (backupQuery.rows.length === 0) {
      return res.status(404).json({ message: 'No backup workers available right now.' });
    }

    // Save to emergency_backups (skip duplicates)
    for (const worker of backupQuery.rows) {
      try {
        await pool.query(
          `INSERT INTO emergency_backups (job_id, backup_worker_id, status)
           VALUES ($1, $2, 'notified')
           ON CONFLICT (job_id, worker_id) DO NOTHING`,
          [jobId, worker.id]
        );
      } catch(e) {
        // ON CONFLICT may not exist — use SELECT check
        const existing = await pool.query(
          'SELECT id FROM emergency_backups WHERE job_id = $1 AND backup_worker_id = $2',
          [jobId, worker.id]
        ).catch(() => ({ rows: [] }));
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO emergency_backups (job_id, backup_worker_id, status) VALUES ($1, $2, 'notified')`,
            [jobId, worker.id]
          ).catch(() => {});
        }
      }
    }

    // Normalize: ensure every worker object has worker_id field (for frontend consistency)
    const normalizedWorkers = backupQuery.rows.map(w => ({ ...w, worker_id: w.id || w.worker_id }));

    res.status(200).json({
      message: `${backupQuery.rows.length} backup workers have been notified!`,
      backup_workers: normalizedWorkers,
      customer_options: [
        '✅ Choose one of the backup workers above',
        '⏳ Wait a few minutes if map shows worker is close',
        '❌ Cancel the job entirely',
      ],
    });

  } catch (err) {
    console.error('Trigger emergency error:', err.message);
    res.status(500).json({ message: 'Server error triggering emergency.' });
  }
};

// PUT /api/emergency/:jobId/choose/:backupWorkerId
const chooseBackupWorker = async (req, res) => {
  const { jobId, backupWorkerId } = req.params;

  try {
    // Remove old worker assignment
    await pool.query('DELETE FROM assigned_workers WHERE job_id = $1', [jobId]).catch(() => {});

    // Expire old OTPs
    await pool.query(
      'UPDATE otps SET is_used = true WHERE job_id = $1 AND is_used = false', [jobId]
    ).catch(() => {});

    // Insert new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await pool.query(
      'INSERT INTO otps (job_id, otp_code, is_used) VALUES ($1, $2, false)',
      [jobId, otpCode]
    );

    // Assign backup worker — use ON CONFLICT to avoid duplicate key errors
    await pool.query(
      `INSERT INTO assigned_workers (job_id, worker_id)
       VALUES ($1, $2)
       ON CONFLICT (job_id, worker_id) DO NOTHING`,
      [jobId, backupWorkerId]
    ).catch(async () => {
      // If ON CONFLICT not supported, just insert ignoring error
      await pool.query(
        'INSERT INTO assigned_workers (job_id, worker_id) VALUES ($1, $2)',
        [jobId, backupWorkerId]
      ).catch(() => {});
    });

    // Reset deadline for backup worker:
    // scheduled jobs: keep deadline = scheduled_time (same logic as initial assignment)
    // urgent jobs: NOW + 30min (fresh window for backup)
    const jobInfo = await pool.query(
      `SELECT urgency, scheduled_time FROM jobs WHERE id = $1`, [jobId]
    );
    const jInfo = jobInfo.rows[0];
    const newDeadline = (jInfo?.urgency === 'scheduled' && jInfo?.scheduled_time)
      ? new Date(jInfo.scheduled_time).toISOString()
      : new Date(Date.now() + 30 * 60000).toISOString();

    await pool.query(
      `UPDATE jobs SET status = 'assigned', wait_until = NULL, arrival_deadline = $1 WHERE id = $2`,
      [newDeadline, jobId]
    );

    // Mark backup statuses
    await pool.query(
      `UPDATE emergency_backups SET status = 'assigned'
       WHERE job_id = $1 AND backup_worker_id = $2`,
      [jobId, backupWorkerId]
    ).catch(() => {});
    await pool.query(
      `UPDATE emergency_backups SET status = 'dismissed'
       WHERE job_id = $1 AND backup_worker_id != $2 AND status = 'notified'`,
      [jobId, backupWorkerId]
    ).catch(() => {});

    // Auto-create commitment bond for new worker
    const jobRes = await pool.query('SELECT rate FROM jobs WHERE id = $1', [jobId]).catch(() => null);
    if (jobRes?.rows.length > 0) {
      const bondAmount = parseFloat(jobRes.rows[0].rate) * 0.1;
      await pool.query(
        `INSERT INTO commitment_bonds (job_id, worker_id, bond_amount, no_show_probability)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (job_id, worker_id) DO NOTHING`,
        [jobId, backupWorkerId, bondAmount, 50]
      ).catch(() => {});
    }

    res.status(200).json({
      message: 'Backup worker assigned! New OTP sent.',
      new_otp: otpCode,
      worker_id: backupWorkerId,
    });

  } catch (err) {
    console.error('Choose backup worker error:', err.message);
    res.status(500).json({ message: 'Server error choosing backup worker.' });
  }
};

// GET /api/emergency/:jobId/backups
const getEmergencyBackups = async (req, res) => {
  const { jobId } = req.params;

  try {
    // Step 1: get job location for proximity sort
    const jobLoc = await pool.query(
      `SELECT latitude, longitude FROM jobs WHERE id = $1`, [jobId]
    ).catch(() => ({ rows: [] }));

    const jLat = parseFloat(jobLoc.rows[0]?.latitude);
    const jLon = parseFloat(jobLoc.rows[0]?.longitude);
    const hasJobLocation = !isNaN(jLat) && !isNaN(jLon);

    // Step 2: fetch all notified backup workers for this job
    // Use LEFT JOIN on worker_profiles so a missing profile row won't crash the query
    const result = await pool.query(
      `SELECT
        eb.id          AS backup_id,
        eb.status,
        eb.backup_worker_id AS worker_id,
        u.full_name,
        u.phone,
        wp.skills,
        wp.rating,
        wp.latitude,
        wp.longitude,
        wp.is_online
       FROM emergency_backups eb
       JOIN users u                ON u.id         = eb.backup_worker_id
       LEFT JOIN worker_profiles wp ON wp.user_id  = eb.backup_worker_id
       WHERE eb.job_id = $1
         AND eb.status = 'notified'`,
      [jobId]
    );

    // Step 3: sort by proximity in JS (avoids dynamic SQL and works even when coords are null)
    let workers = result.rows;
    if (hasJobLocation) {
      workers = workers.sort((a, b) => {
        const distA = (a.latitude != null && a.longitude != null)
          ? Math.pow(a.latitude - jLat, 2) + Math.pow(a.longitude - jLon, 2)
          : Infinity;
        const distB = (b.latitude != null && b.longitude != null)
          ? Math.pow(b.latitude - jLat, 2) + Math.pow(b.longitude - jLon, 2)
          : Infinity;
        if (distA !== distB) return distA - distB;
        // Secondary: higher rating wins
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    } else {
      // No job location — sort by rating descending
      workers = workers.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    res.status(200).json({ backup_workers: workers });

  } catch (err) {
    console.error('Get emergency backups error:', err.message, err.stack);
    res.status(500).json({ message: 'Server error fetching emergency backups.', detail: err.message });
  }
};

// POST /api/emergency/:jobId/wait
// Customer chooses to wait 10 more minutes — sets wait_until = NOW + 10min
const waitForWorker = async (req, res) => {
  const { jobId } = req.params;
  try {
    await pool.query(
      `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS wait_until TIMESTAMPTZ`
    ).catch(() => {});
    const waitUntil = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `UPDATE jobs SET wait_until = $1 WHERE id = $2`,
      [waitUntil.toISOString(), jobId]
    );
    res.status(200).json({
      message: 'Waiting 10 more minutes for worker to arrive.',
      wait_until: waitUntil.toISOString(),
      wait_mins_left: 10,
    });
  } catch (err) {
    console.error('Wait error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

// POST /api/emergency/:jobId/cancel
// Customer cancels the job
const cancelJobByCustomer = async (req, res) => {
  const { jobId } = req.params;
  try {
    await pool.query(
      `UPDATE jobs SET status = 'cancelled', wait_until = NULL WHERE id = $1`,
      [jobId]
    );
    res.status(200).json({ message: 'Job cancelled successfully.' });
  } catch (err) {
    console.error('Cancel error:', err.message);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  checkNoShow,
  triggerEmergency,
  chooseBackupWorker,
  getEmergencyBackups,
  waitForWorker,
  cancelJobByCustomer,
};