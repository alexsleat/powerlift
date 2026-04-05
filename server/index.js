const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust the nginx reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Body parsing — 10 MB to accommodate the full exercise library JSON
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// CORS — in production nginx proxies /api so requests arrive same-origin.
// This config is primarily for local `vite dev` usage.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Stricter rate limit on auth endpoints (20 attempts per 15 min per IP)
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  message:         { error: 'Too many requests — please try again later' },
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/data', dataRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Powerlift server listening on port ${PORT}`));
