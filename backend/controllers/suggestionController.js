const pool = require('../config/db');

const suggestWorkers = async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobResult.rows[0];

    const workers = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.phone,
        wp.skills,
        wp.rating,
        wp.total_ratings,
        wp.is_online,
        wp.latitude,
        wp.longitude,
        COUNT(DISTINCT j.id) AS completed_jobs
       FROM users u
       JOIN worker_profiles wp ON wp.user_id = u.id
       LEFT JOIN assigned_workers aw ON aw.worker_id = u.id
       LEFT JOIN jobs j ON j.id = aw.job_id AND j.status = 'completed'
       WHERE u.role = 'worker'
       GROUP BY u.id, u.full_name, u.phone, wp.skills, wp.rating,
                wp.total_ratings, wp.is_online, wp.latitude, wp.longitude`
    );

    const scored = workers.rows.map((worker) => {
      let score = 0;
      let skill_matched = false;

      if (worker.skills && worker.skills.includes(job.labor_type)) {
        score += 40;
        skill_matched = true;
      }

      if (worker.rating) {
        score += (parseFloat(worker.rating) / 5) * 30;
      }

      if (worker.is_online) score += 20;

      const completedJobs = parseInt(worker.completed_jobs) || 0;
      score += Math.min(completedJobs, 10);

      if (worker.latitude && worker.longitude && job.latitude && job.longitude) {
        const R = 6371;
        const dLat = ((parseFloat(job.latitude) - parseFloat(worker.latitude)) * Math.PI) / 180;
        const dLon = ((parseFloat(job.longitude) - parseFloat(worker.longitude)) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((parseFloat(worker.latitude) * Math.PI) / 180) *
          Math.cos((parseFloat(job.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        if (distance <= 5) score += 10;
      }

      return { ...worker, score: Math.round(score), skill_matched };
    });

    scored.sort((a, b) => b.score - a.score);

    res.status(200).json({ suggested_workers: scored.slice(0, 10) });

  } catch (err) {
    console.error('Suggest workers error:', err.message);
    res.status(500).json({ message: 'Server error fetching suggestions.' });
  }
};

const suggestJobs = async (req, res) => {
  const { workerId } = req.params;

  try {
    const workerResult = await pool.query(
      'SELECT wp.skills, wp.latitude, wp.longitude FROM worker_profiles wp WHERE wp.user_id = $1',
      [workerId]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    const worker = workerResult.rows[0];

    const jobs = await pool.query(
      `SELECT j.*, u.full_name AS customer_name, u.phone AS customer_phone
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       WHERE j.status = 'open'`
    );

    const scored = jobs.rows.map((job) => {
      let score = 0;
      let skill_matched = false;

      if (worker.skills && worker.skills.includes(job.labor_type)) {
        score += 40;
        skill_matched = true;
      }

      if (job.urgency === 'urgent') score += 20;

      const rate = parseFloat(job.rate) || 0;
      if (rate >= 1000) score += 20;
      else if (rate >= 500) score += 10;
      else score += 5;

      if (worker.latitude && worker.longitude && job.latitude && job.longitude) {
        const R = 6371;
        const dLat = ((parseFloat(job.latitude) - parseFloat(worker.latitude)) * Math.PI) / 180;
        const dLon = ((parseFloat(job.longitude) - parseFloat(worker.longitude)) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((parseFloat(worker.latitude) * Math.PI) / 180) *
          Math.cos((parseFloat(job.latitude) * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        if (distance <= 5) score += 20;
      }

      return { ...job, score: Math.round(score), skill_matched };
    });

    scored.sort((a, b) => b.score - a.score);

    res.status(200).json({ suggested_jobs: scored.slice(0, 10) });

  } catch (err) {
    console.error('Suggest jobs error:', err.message);
    res.status(500).json({ message: 'Server error fetching job suggestions.' });
  }
};

const suggestCustomers = async (req, res) => {
  const { workerId } = req.params;

  try {
    const workerResult = await pool.query(
      'SELECT skills FROM worker_profiles WHERE user_id = $1',
      [workerId]
    );

    if (workerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Worker profile not found.' });
    }

    const workerSkills = workerResult.rows[0].skills || [];

    const customers = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.phone,
        u.email,
        COUNT(j.id) AS total_jobs_posted,
        COUNT(CASE WHEN j.status = 'completed' THEN 1 END) AS completed_jobs,
        MAX(j.created_at) AS last_posted_at,
        ARRAY_AGG(DISTINCT j.labor_type) AS job_types,
        AVG(j.rate) AS avg_rate
       FROM users u
       LEFT JOIN jobs j ON j.customer_id = u.id
       WHERE u.role = 'customer'
       GROUP BY u.id, u.full_name, u.phone, u.email`
    );

    const scored = customers.rows.map((customer) => {
      let score = 0;
      let reasons = [];

      const jobTypes = customer.job_types || [];
      const hasMatchingJobs = jobTypes.some((type) => workerSkills.includes(type));
      if (hasMatchingJobs) {
        score += 40;
        reasons.push('Posts jobs matching your skills');
      }

      const totalJobs = parseInt(customer.total_jobs_posted) || 0;
      if (totalJobs >= 5) {
        score += 20;
        reasons.push('Frequent job poster');
      } else if (totalJobs >= 2) {
        score += 10;
        reasons.push('Regular job poster');
      }

      const completedJobs = parseInt(customer.completed_jobs) || 0;
      if (totalJobs > 0 && completedJobs / totalJobs >= 0.8) {
        score += 20;
        reasons.push('High job completion rate');
      }

      if (customer.last_posted_at) {
        const daysSinceLastPost =
          (new Date() - new Date(customer.last_posted_at)) / 1000 / 60 / 60 / 24;
        if (daysSinceLastPost <= 7) {
          score += 10;
          reasons.push('Recently active');
        }
      }

      const avgRate = parseFloat(customer.avg_rate) || 0;
      if (avgRate >= 500) {
        score += 10;
        reasons.push('Pays well');
      }

      return {
        ...customer,
        score: Math.round(score),
        reasons,
        avg_rate: avgRate.toFixed(2),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.filter((c) => c.score > 0);

    res.status(200).json({ suggested_customers: filtered.slice(0, 10) });

  } catch (err) {
    console.error('Suggest customers error:', err.message);
    res.status(500).json({ message: 'Server error fetching customer suggestions.' });
  }
};

module.exports = { suggestWorkers, suggestJobs, suggestCustomers };