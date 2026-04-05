const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// =====================
// REGISTER
// POST /api/auth/register
// =====================
const register = async (req, res) => {
  const { full_name, email, phone, password, role, skills, address } = req.body;

  if (!full_name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

if (role !== 'customer' && role !== 'worker' && role !== 'admin') {
    return res.status(400).json({ message: 'Role must be customer, worker or admin.' });
  }

  if (role === 'worker' && (!skills || skills.length === 0)) {
    return res.status(400).json({ message: 'Workers must provide at least one skill.' });
  }

  try {
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const phoneCheck = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    if (phoneCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Phone number already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, phone, role, address, created_at`,
      [full_name, email, phone, password_hash, role, address || null]
    );

    const user = newUser.rows[0];

    if (role === 'worker') {
      await pool.query(
        `INSERT INTO worker_profiles (user_id, skills)
         VALUES ($1, $2)`,
        [user.id, skills]
      );
    }

    res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
      },
    });

  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// =====================
// LOGIN
// POST /api/auth/login
// =====================
const login = async (req, res) => {
  const { email, password } = req.body;

  // Step 1: Check required fields
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Step 2: Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check if user is banned
    if (user.is_banned) {
      return res.status(403).json({
        message: `Your account has been banned. Reason: ${user.ban_reason || 'Policy violation'}. Please contact support.`,
      });
    }

    // Step 3: Compare entered password with hashed password in database
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Step 4: If worker, get their profile id too
    let worker_profile_id = null;
    if (user.role === 'worker') {
      const profileResult = await pool.query(
        'SELECT id FROM worker_profiles WHERE user_id = $1',
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        worker_profile_id = profileResult.rows[0].id;
      }
    }

    // Step 5: Create a JWT token with user info inside
    // This token expires in 7 days
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        worker_profile_id: worker_profile_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Step 6: Return token and user info
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        worker_profile_id: worker_profile_id,
      },
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, address, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
};

const updateProfile = async (req, res) => {
  const { full_name, phone, address } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        address = COALESCE($3, address)
       WHERE id = $4 RETURNING id, full_name, email, phone, role, address`,
      [full_name, phone, address || null, req.user.id]
    );
    res.status(200).json({ message: 'Profile updated!', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
};

module.exports = { register, login, getProfile, updateProfile };