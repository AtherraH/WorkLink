const pool = require('../config/db');

// =====================
// GET CHAT HISTORY
// GET /api/chat/:jobId
// =====================
const getChatHistory = async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user is part of this job
    const jobCheck = await pool.query(
      `SELECT j.*, aw.worker_id 
       FROM jobs j
       LEFT JOIN assigned_workers aw ON aw.job_id = j.id
       WHERE j.id = $1 AND (j.customer_id = $2 OR aw.worker_id = $2)`,
      [jobId, userId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not part of this job.' });
    }

    // Get all messages for this job
    const messages = await pool.query(
      `SELECT 
        cm.id,
        cm.message,
        cm.sent_at,
        cm.sender_id,
        u.full_name AS sender_name
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE cm.job_id = $1
       ORDER BY cm.sent_at ASC`,
      [jobId]
    );

    res.status(200).json({
      messages: messages.rows,
    });

  } catch (err) {
    console.error('Get chat history error:', err.message);
    res.status(500).json({ message: 'Server error fetching chat history.' });
  }
};

// =====================
// SEND MESSAGE (REST fallback)
// POST /api/chat/:jobId
// =====================
const sendMessage = async (req, res) => {
  const { jobId } = req.params;
  const senderId = req.user.id;
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (job_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [jobId, senderId, message]
    );

    res.status(201).json({
      message: 'Message sent.',
      chat: result.rows[0],
    });

  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ message: 'Server error sending message.' });
  }
};

module.exports = { getChatHistory, sendMessage };