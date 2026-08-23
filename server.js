require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// Trust proxy (Railway)
app.set('trust proxy', 1);

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health (before rate limiter)
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'RFT Entertainment API is running' }));

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
    app_name:          'RFT Entertainment'
  }
}));

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

module.exports = app;
