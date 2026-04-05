const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS       = 12;
const ACCESS_TOKEN_TTL  = '24h';
const REFRESH_DAYS      = 30;
const COOKIE_NAME       = 'refresh_token';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge:   REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });
  if (username.trim().length < 2)
    return res.status(400).json({ error: 'Username must be at least 2 characters' });

  try {
    const hash   = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username.trim(), email.trim().toLowerCase(), hash);

    const userId = result.lastInsertRowid;
    db.prepare('INSERT INTO user_profile (user_id, name) VALUES (?, ?)').run(userId, username.trim());

    const user         = { id: userId, username: username.trim(), email: email.trim().toLowerCase() };
    const accessToken  = makeAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt    = new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(userId, hashToken(refreshToken), expiresAt);

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    if (err.message?.includes('UNIQUE'))
      return res.status(409).json({ error: 'Username or email already exists' });
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  // Use constant-time compare to prevent timing attacks
  const hash  = row?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000';
  const match = await bcrypt.compare(password, hash);
  if (!row || !match)
    return res.status(401).json({ error: 'Invalid credentials' });

  const user         = { id: row.id, username: row.username, email: row.email };
  const accessToken  = makeAccessToken(user);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const expiresAt    = new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(row.id, hashToken(refreshToken), expiresAt);

  setRefreshCookie(res, refreshToken);
  res.json({ user, accessToken });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(token));
  if (!row) return res.status(401).json({ error: 'Invalid refresh token' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(row.user_id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  res.json({ user, accessToken: makeAccessToken(user) });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
  res.json({ ok: true });
});

module.exports = router;
