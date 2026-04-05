const pool = require('../config/db');

// POST /api/dispute-chat/:disputeId  — send a message
const sendDisputeMessage = async (req, res) => {
  const senderId = req.user.id;
  const senderRole = req.user.role;
  const { disputeId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }

  try {
    // Verify sender is party to the dispute or admin
    const disputeRes = await pool.query(
      'SELECT * FROM disputes WHERE id = $1',
      [disputeId]
    );
    if (disputeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Dispute not found.' });
    }
    const dispute = disputeRes.rows[0];

    if (
      senderRole !== 'admin' &&
      senderId !== dispute.reporter_id &&
      senderId !== dispute.reported_id
    ) {
      return res.status(403).json({ message: 'You are not a party to this dispute.' });
    }

    const result = await pool.query(
      `INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [disputeId, senderId, senderRole, message.trim()]
    );

    const row = result.rows[0];

    // Emit via socket so all parties see it in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`dispute_${disputeId}`).emit('dispute_message', {
        id: row.id,
        dispute_id: disputeId,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: req.user.full_name,
        message: row.message,
        sent_at: row.sent_at,
      });
    }

    res.status(201).json({ message: 'Message sent.', chat: row });
  } catch (err) {
    console.error('Send dispute message error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

// GET /api/dispute-chat/:disputeId  — get all messages
const getDisputeMessages = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { disputeId } = req.params;

  try {
    // Verify access
    const disputeRes = await pool.query(
      'SELECT * FROM disputes WHERE id = $1',
      [disputeId]
    );
    if (disputeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Dispute not found.' });
    }
    const dispute = disputeRes.rows[0];

    if (
      userRole !== 'admin' &&
      userId !== dispute.reporter_id &&
      userId !== dispute.reported_id
    ) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const result = await pool.query(
      `SELECT dm.*, u.full_name AS sender_name
       FROM dispute_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE dm.dispute_id = $1
       ORDER BY dm.sent_at ASC`,
      [disputeId]
    );

    res.status(200).json({ messages: result.rows });
  } catch (err) {
    console.error('Get dispute messages error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

module.exports = { sendDisputeMessage, getDisputeMessages };