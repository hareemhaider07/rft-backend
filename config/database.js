const { Pool } = require('pg');

// Force IPv4 by disabling IPv6 lookup
// Railway does not support IPv6 connections to external services
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Force IPv4 family
  family: 4,
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('✅ Connected to Supabase PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
});

module.exports = pool;
