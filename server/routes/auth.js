const express    = require('express');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const db         = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { sendMail }   = require('../mailer');

const router = express.Router();

const SALT_ROUNDS       = 12;
// Short-lived access token; the client silently refreshes on 401 (A4).
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_DAYS      = 30;
const COOKIE_NAME       = 'refresh_token';
const MAX_PASSWORD_BYTES = 72; // bcrypt truncates beyond this

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Bound token-table growth: expired rows are only pruned on presentation, so
// sweep both token tables opportunistically on refresh (A5).
function pruneExpiredTokens() {
  try {
    db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
    db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < datetime('now')").run();
  } catch (e) {
    console.error('Token prune error:', e);
  }
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
    // Default to secure in production; allow explicit opt-out (COOKIE_SECURE=false)
    // for plain-HTTP LAN installs (A6).
    secure:   process.env.COOKIE_SECURE != null
                ? process.env.COOKIE_SECURE === 'true'
                : process.env.NODE_ENV === 'production',
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
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES)
    return res.status(400).json({ error: 'Password must be 72 bytes or fewer' });
  if (email.length > 254)
    return res.status(400).json({ error: 'Email address is too long' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });
  const trimmedName = username.trim();
  if (trimmedName.length < 2 || trimmedName.length > 32)
    return res.status(400).json({ error: 'Username must be 2–32 characters' });
  if (!/^[A-Za-z0-9_.\- ]+$/.test(trimmedName))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, spaces, and _ . -' });

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
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE'))
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

  // Rotate: invalidate the presented token and issue a fresh one so a stolen
  // refresh token cannot be reused indefinitely (A5).
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
  const newRefresh = crypto.randomBytes(64).toString('hex');
  const expiresAt  = new Date(Date.now() + REFRESH_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
    .run(user.id, hashToken(newRefresh), expiresAt);
  setRefreshCookie(res, newRefresh);
  pruneExpiredTokens();

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

// Tighter limiter than the shared auth limiter — caps reset-email abuse (A13).
const forgotLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  message:         { error: 'Too many reset requests — please try again later' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
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

    const appUrl = process.env.APP_URL;
    if (!appUrl) console.warn('[WARN] APP_URL is not set — reset link will be broken');
    const resetLink = `${appUrl || 'http://localhost:8080'}/?reset=${token}`;

    const safeName = escapeHtml(user.username);
    await sendMail({
      to:      user.email,
      subject: 'Powerlift — password reset',
      text:    `Hi ${user.username},\n\nReset your password (link valid for 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
      html:    `<p>Hi ${safeName},</p><p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, ignore this email.</p>`,
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
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES)
    return res.status(400).json({ error: 'Password must be 72 bytes or fewer' });

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
