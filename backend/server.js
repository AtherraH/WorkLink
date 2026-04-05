const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const jobRoutes = require('./routes/jobRoutes');
const chatRoutes = require('./routes/chatRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const otpRoutes = require('./routes/otpRoutes');
const bondRoutes = require('./routes/bondRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const completionRoutes = require('./routes/completionRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const disputeChatRoutes = require('./routes/disputeChatRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/bonds', bondRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/completion', completionRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/dispute-chat', disputeChatRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'WorkLink backend is running!' });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join job chat room
  socket.on('join_room', (jobId) => {
    socket.join(jobId);
    console.log(`User ${socket.id} joined room: ${jobId}`);
  });

  // Join personal notification room (for job_notification events)
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Join dispute chat room
  socket.on('join_dispute_room', (disputeId) => {
    socket.join(`dispute_${disputeId}`);
    console.log(`User ${socket.id} joined dispute room: ${disputeId}`);
  });

  // Admin sends notification to user (ban/warn/unban/resolve)
  socket.on('admin_notify_user', ({ userId, notification }) => {
    io.to(`user_${userId}`).emit('system_notification', notification);
  });

  socket.on('send_message', async (data) => {
    const { jobId, senderId, senderName, message } = data;
    try {
      const result = await pool.query(
        `INSERT INTO chat_messages (job_id, sender_id, message)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [jobId, senderId, message]
      );
      io.to(jobId).emit('receive_message', {
        id: result.rows[0].id,
        sender_id: senderId,
        sender_name: senderName,
        message: message,
        sent_at: result.rows[0].sent_at,
      });
    } catch (err) {
      console.error('Socket message error:', err.message);
    }
  });

  socket.on('update_location', async (data) => {
    const { jobId, latitude, longitude, workerId } = data;
    try {
      await pool.query(
        `UPDATE worker_profiles
         SET latitude = $1, longitude = $2
         WHERE user_id = $3`,
        [latitude, longitude, workerId]
      );
      io.to(jobId).emit('worker_location_update', {
        latitude,
        longitude,
        workerId,
      });
    } catch (err) {
      console.error('Location update error:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 WorkLink server running on port ${PORT}`);
});