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
const chatbotRoutes = require('./routes/chatbotRoutes');

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
app.use('/api/chatbot', chatbotRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'WorkLink backend is running!' });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_room', (jobId) => {
    socket.join(jobId);
    console.log(`User ${socket.id} joined room: ${jobId}`);
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

// Auto-migrate: add assigned_at column if it doesn't exist
// Auto-migrate: arrival_deadline system
// RULE: urgent = posted_at + 30min | scheduled = scheduled_time + 30min
// Set via DB trigger on INSERT so it works regardless of which controller creates the job.
pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_deadline TIMESTAMPTZ`)
  .then(async () => {
    console.log('✅ PostgreSQL connected successfully');

    // Step 1: Create or replace the trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION set_arrival_deadline()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.urgency = 'urgent' THEN
          NEW.arrival_deadline := NEW.created_at + INTERVAL '30 minutes';
        ELSIF NEW.urgency = 'scheduled' AND NEW.scheduled_time IS NOT NULL THEN
          NEW.arrival_deadline := NEW.scheduled_time + INTERVAL '30 minutes';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(e => console.warn('Trigger fn:', e.message));

    // Step 2: Drop old trigger if exists, then create fresh
    await pool.query(`DROP TRIGGER IF EXISTS trg_arrival_deadline ON jobs`).catch(() => {});
    await pool.query(`
      CREATE TRIGGER trg_arrival_deadline
      BEFORE INSERT ON jobs
      FOR EACH ROW EXECUTE FUNCTION set_arrival_deadline();
    `).catch(e => console.warn('Trigger create:', e.message));

    // Step 3: Backfill ALL existing jobs correctly using their own data
    // Urgent: posted_at (created_at) + 30min
    await pool.query(`
      UPDATE jobs
      SET arrival_deadline = created_at + INTERVAL '30 minutes'
      WHERE urgency = 'urgent'
    `).catch(e => console.warn('Backfill urgent:', e.message));

    // Scheduled: scheduled_time + 30min (NULL if no scheduled_time)
    await pool.query(`
      UPDATE jobs
      SET arrival_deadline = CASE
        WHEN scheduled_time IS NOT NULL THEN scheduled_time + INTERVAL '30 minutes'
        ELSE NULL
      END
      WHERE urgency = 'scheduled'
    `).catch(e => console.warn('Backfill scheduled:', e.message));

    // Add wait_until column for the "Wait 10 more minutes" option
    await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS wait_until TIMESTAMPTZ`)
      .catch(() => {});
    console.log('✅ Arrival deadline trigger installed and all jobs backfilled');
  })
  .catch(err => console.warn('DB migration note:', err.message));

server.listen(PORT, () => {
  console.log(`🚀 WorkLink server running on port ${PORT}`);
});