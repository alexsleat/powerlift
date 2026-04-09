const express    = require('express');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const db         = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendMail }   = require('../mailer');

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

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  // Always return 200 immediately — prevents email enumeration
  res.json({ ok: true });

  try {
    const user = db.prepare('SELECT id, email, username FROM users WHERE email = ?')
      .get(email.trim().toLowerCase());
    if (!user) return;

    // Replace any existing unused token for this user
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    const token    = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    db.prepare('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
      .run(user.id, hashToken(token), expiresAt);

    const appUrl    = process.env.APP_URL || 'http://localhost:8080';
    const resetLink = `${appUrl}/?reset=${token}`;

    await sendMail({
      to:      user.email,
      subject: 'Powerlift — password reset',
      text:    `Hi ${user.username},\n\nReset your password (link valid for 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
      html:    `<p>Hi ${user.username},</p><p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, ignore this email.</p>`,
    });
  } catch (err) {
    console.error('Forgot-password error:', err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password)
    return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const row = db.prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(hashToken(token));
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(row.id);
    return res.status(400).json({ error: 'Reset link has expired — please request a new one' });
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(row.id);
    // Invalidate all refresh tokens so all sessions are signed out
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(row.user_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
