/**
 * RFT Entertainment — Admin Account Setup Script
 * Run: node backend/scripts/create-admin.js
 *
 * Or make a one-time POST request to:
 * POST /api/admin/auth/setup
 * Body: { "username": "admin", "email": "your@email.com", "password": "yourpassword" }
 *
 * That endpoint auto-locks after first use.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool   = require('../config/database');

async function main() {
  const username = process.argv[2] || 'admin';
  const email    = process.argv[3] || 'admin@rft.com';
  const password = process.argv[4] || 'Admin@1234';

  console.log(`Creating admin: ${username} / ${email}`);

  const existing = await pool.query('SELECT id FROM admin_users LIMIT 1');
  if (existing.rows.length) {
    console.log('Admin already exists. Use the login endpoint.');
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    `INSERT INTO admin_users(username,email,password_hash,role)
     VALUES($1,$2,$3,'superadmin') RETURNING id,username,email`,
    [username, email, hash]
  );

  console.log('✅ Admin created:', r.rows[0]);
  console.log(`\nLogin at: https://rft-frontend.netlify.app/admin.html`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
