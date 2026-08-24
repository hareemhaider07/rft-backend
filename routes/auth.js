const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { generateTokens } = require('../middleware/auth');

const router = express.Router();

// ── helper: build 3-level referral chain after new user registers ─────────────
async function buildReferralChain(newUserId, referralCode) {
  if (!referralCode) return;
  try {
    // find direct referrer (level 1)
    const refRes = await pool.query(
      'SELECT id, vip_level FROM users WHERE referral_code = $1', [referralCode]
    );
    if (!refRes.rows.length) return;
    const l1User = refRes.rows[0];

    const vipRes = await pool.query(
      'SELECT level1_commission_rate, level2_commission_rate, level3_commission_rate FROM vip_levels WHERE level = $1',
      [l1User.vip_level || 0]
    );
    const rates = vipRes.rows[0] || { level1_commission_rate: 0.10, level2_commission_rate: 0.03, level3_commission_rate: 0.01 };

    // insert level-1 referral
    await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id, referral_level, commission_rate)
       VALUES ($1, $2, 1, $3) ON CONFLICT DO NOTHING`,
      [l1User.id, newUserId, rates.level1_commission_rate]
    );

    // level-2: who referred l1User?
    const l2Res = await pool.query(
      `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND referral_level = 1`,
      [l1User.id]
    );
    if (l2Res.rows.length) {
      const l2Id = l2Res.rows[0].referrer_id;
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, referral_level, commission_rate)
         VALUES ($1, $2, 2, $3) ON CONFLICT DO NOTHING`,
        [l2Id, newUserId, rates.level2_commission_rate]
      );

      // level-3: who referred l2?
      const l3Res = await pool.query(
        `SELECT referrer_id FROM referrals WHERE referred_id = $1 AND referral_level = 1`,
        [l2Id]
      );
      if (l3Res.rows.length) {
        const l3Id = l3Res.rows[0].referrer_id;
        await pool.query(
          `INSERT INTO referrals (referrer_id, referred_id, referral_level, commission_rate)
           VALUES ($1, $2, 3, $3) ON CONFLICT DO NOTHING`,
          [l3Id, newUserId, rates.level3_commission_rate]
        );
      }
    }

    // credit registration bonus to direct referrer
    const bonusRes = await pool.query(
      'SELECT referral_bonus_usdt FROM vip_levels WHERE level = $1', [l1User.vip_level || 0]
    );
    const bonus = bonusRes.rows.length ? parseFloat(bonusRes.rows[0].referral_bonus_usdt) : 0.50;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    await pool.query(
      'UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2',
      [bonus, l1User.id]
    );
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
       VALUES ($1, 'referral_bonus', $2, $3, 'completed', 'Registration referral bonus')`,
      [l1User.id, bonus, (bonus * pkrRate).toFixed(2)]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Referral Bonus!', $2, 'success')`,
      [l1User.id, `You earned ${bonus} USDT for referring a new member!`]
    );
  } catch (err) {
    console.error('buildReferralChain error:', err);
  }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, email, phone, password, referral_code } = req.body;

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email.toLowerCase(), phone]
    );
    if (existing.rows.length) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userReferralCode = 'RFT' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, referral_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, referral_code, balance_usdt, points, kyc_status`,
      [name, email.toLowerCase(), phone, password_hash, userReferralCode, referral_code || null]
    );
    const user = { ...result.rows[0], vip_level: 0 };

    // build 3-level referral chain + credit registration bonus
    if (referral_code) await buildReferralChain(user.id, referral_code);

    const tokens = generateTokens(user.id);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken]
    );

    // welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Welcome to RFT!', 'Complete your first task to start earning USDT rewards.', 'info')`,
      [user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, ...tokens }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message, detail: error.detail || null });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
  body('email_or_phone').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { email_or_phone, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $2',
      [email_or_phone.toLowerCase(), email_or_phone]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is inactive. Contact support.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    const tokens = generateTokens(user.id);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id, name: user.name, email: user.email, phone: user.phone,
          referral_code: user.referral_code, balance_usdt: user.balance_usdt,
          points: user.points, kyc_status: user.kyc_status, vip_level: user.vip_level || 0
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1', [refresh_token]);
    }
    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const tokenResult = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [refresh_token]
    );
    if (!tokenResult.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const tokenData = tokenResult.rows[0];
    const tokens = generateTokens(tokenData.user_id);

    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [tokenData.id]);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [tokenData.user_id, tokens.refreshToken]
    );

    res.json({ success: true, data: tokens });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Generates a 6-digit OTP stored in DB, returns it in response
// (In production wire this to SMS/email; for now admin can read it from DB)
router.post('/forgot-password', [
  body('email_or_phone').notEmpty().withMessage('Email or phone required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { email_or_phone } = req.body;
    const r = await pool.query(
      'SELECT id, email, phone FROM users WHERE email=$1 OR phone=$2',
      [email_or_phone.toLowerCase(), email_or_phone]
    );
    // Always return success to prevent user enumeration
    if (!r.rows.length) {
      return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }
    const user = r.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store OTP in password_resets table (create if not exists via upsert pattern)
    await pool.query(
      `INSERT INTO password_resets (user_id, otp, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET otp=$2, expires_at=$3, used=false`,
      [user.id, otp, expiresAt]
    );

    // In production: send OTP via SMS/email here
    // For now we include it in dev response only
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      success: true,
      message: 'Reset code generated. Contact admin or check SMS.',
      ...(isDev && { debug_otp: otp, debug_note: 'OTP shown in dev mode only' })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', [
  body('email_or_phone').notEmpty().withMessage('Email or phone required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('new_password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { email_or_phone, otp, new_password } = req.body;

    const userRes = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR phone=$2',
      [email_or_phone.toLowerCase(), email_or_phone]
    );
    if (!userRes.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    const userId = userRes.rows[0].id;

    const resetRes = await pool.query(
      `SELECT * FROM password_resets
       WHERE user_id=$1 AND otp=$2 AND used=false AND expires_at > NOW()`,
      [userId, otp]
    );
    if (!resetRes.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [password_hash, userId]);
    await pool.query('UPDATE password_resets SET used=true WHERE user_id=$1', [userId]);

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

module.exports = router;
