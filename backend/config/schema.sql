-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- Stores both customers and workers
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) CHECK (role IN ('customer', 'worker')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- WORKER PROFILES TABLE
-- Extra details only workers have
-- =====================
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skills TEXT[] NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,2) DEFAULT 0.00,
  total_ratings INT DEFAULT 0,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- PORTFOLIO TABLE
-- Photos of completed work shown on worker profile
-- =====================
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  job_title VARCHAR(150),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- JOBS TABLE
-- Job posts created by customers
-- =====================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  labor_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  rate NUMERIC(10,2) NOT NULL,
  location TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  workers_needed INT DEFAULT 1,
  urgency VARCHAR(15) CHECK (urgency IN ('urgent', 'scheduled')) NOT NULL,
  scheduled_time TIMESTAMP,
  photo_url TEXT,
  status VARCHAR(20) CHECK (status IN (
    'open', 'assigned', 'in_progress', 'completed', 'cancelled'
  )) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- JOB APPLICATIONS TABLE
-- Workers apply to jobs here
-- =====================
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN (
    'pending', 'accepted', 'rejected'
  )) DEFAULT 'pending',
  applied_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- ASSIGNED WORKERS TABLE
-- Tracks which worker is assigned to which job
-- =====================
CREATE TABLE IF NOT EXISTS assigned_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  entry_time TIMESTAMP,
  exit_time TIMESTAMP,
  entry_photo_url TEXT,
  completion_photo_url TEXT
);

-- =====================
-- OTP TABLE
-- For verifying worker arrival
-- =====================
CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  otp_code VARCHAR(6) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes'
);

-- =====================
-- COMMITMENT BONDS TABLE
-- AI bond system for reliability
-- =====================
CREATE TABLE IF NOT EXISTS commitment_bonds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bond_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) CHECK (status IN (
    'active', 'released', 'forfeited'
  )) DEFAULT 'active',
  no_show_probability NUMERIC(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- EMERGENCY BACKUPS TABLE
-- Tracks backup worker assignments on no-show
-- =====================
CREATE TABLE IF NOT EXISTS emergency_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  backup_worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notified_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) CHECK (status IN (
    'notified', 'accepted', 'declined', 'ignored'
  )) DEFAULT 'notified'
);

-- =====================
-- CHAT MESSAGES TABLE
-- Messages between customer and worker
-- =====================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- =====================
-- PAYMENTS TABLE
-- Tracks payment confirmation between parties
-- =====================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2),
  payment_sent BOOLEAN DEFAULT FALSE,
  payment_received BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  received_at TIMESTAMP
);

-- =====================
-- RATINGS TABLE
-- Customer rates worker after payment
-- =====================
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INT CHECK (score BETWEEN 1 AND 5) NOT NULL,
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);