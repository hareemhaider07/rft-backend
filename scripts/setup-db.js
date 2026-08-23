/**
 * RFT Entertainment — Database Setup Script
 * Runs the complete schema.sql against the Supabase database.
 * Run: node backend/scripts/setup-db.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const pool = require('../config/database');

async function main() {
  console.log('🚀 Running RFT Entertainment database setup…');

  const sql = fs.readFileSync(
    path.join(__dirname, '../database/schema.sql'),
    'utf8'
  );

  // Split on semicolons but keep dollar-quoted blocks intact
  // Run as a single transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Database schema applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Schema error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }

  await pool.end();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
