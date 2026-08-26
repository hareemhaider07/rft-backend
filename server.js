require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ── Startup env check — shows a clear error in Railway logs ──────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ MISSING ENVIRONMENT VARIABLES:', missing.join(', '));
  console.error('   Set these in Railway → your service → Variables tab');
  process.exit(1);
}

const app = express();

// Trust proxy (Railway)
app.set('trust proxy', 1);

// Health check — before EVERYTHING so Railway healthcheck always gets a 200
// even if CORS, auth, or any other middleware has a problem
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'RFT Entertainment API is running' });
});

// CORS — parse CORS_ORIGIN safely so stray quotes/newlines never crash the server
const rawOrigin = (process.env.CORS_ORIGIN || '').trim().replace(/^["']|["']$/g, '');
const allowedOrigins = rawOrigin
  ? rawOrigin.split(',').map(o => o.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests (curl, Railway healthcheck, Postman)
    if (!origin) return callback(null, true);
    // allow everything if no origins configured
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // block unknown origins in production, allow in dev
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/wallet',        require('./routes/wallet'));
app.use('/api/kyc',           require('./routes/kyc'));
app.use('/api/vip',           require('./routes/vip'));
app.use('/api/referral',      require('./routes/referral'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/spin',          require('./routes/spin'));
app.use('/api/admin',         require('./routes/admin'));

// API health + public config
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}));

// Public app config (non-sensitive, read by frontend on load)
app.get('/api/config', (req, res) => res.json({
  success: true,
  data: {
    pkr_rate:          parseFloat(process.env.PKR_RATE) || 280,
    support_whatsapp:  process.env.SUPPORT_WHATSAPP || '923XXXXXXXXX',
    min_recharge_usdt: parseFloat(process.env.MIN_RECHARGE_USDT) || 10,
    min_withdraw_usdt: parseFloat(process.env.MIN_WITHDRAW_USDT) || 10,
    app_name:          'RFT Entertainment',
    storage_enabled:   !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  }
}));

// Debug endpoint — test DB directly (remove after fixing)
app.get('/api/debug-db', async (req, res) => {
  const pool = require('./config/database');
  const results = {};
  const test = async (name, query) => {
    try {
      const r = await pool.query(query);
      results[name] = { ok: true, rows: r.rows.length, sample: r.rows[0] };
    } catch (e) {
      results[name] = { ok: false, error: e.message };
    }
  };
  await test('users_count',   'SELECT COUNT(*) FROM users');
  await test('users_cols',    "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('id','email','phone','password_hash','referral_code','vip_level','balance_usdt','kyc_status') ORDER BY column_name");
  await test('users_insert_test', "SELECT 1 FROM users WHERE email='__probe__@test.com'");
  await test('refresh_tokens_exists', 'SELECT COUNT(*) FROM refresh_tokens');
  await test('notifications_exists',  'SELECT COUNT(*) FROM notifications');
  res.json({ success: true, results });
});

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 RFT Entertainment API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Keep Supabase DB awake — ping every 4 minutes
// Supabase free tier pauses after inactivity; this prevents it
const pool = require('./config/database');
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('DB keepalive failed:', e.message);
  }
}, 4 * 60 * 1000);

module.exports = app;
