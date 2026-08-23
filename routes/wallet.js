const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireKYC } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

const router = express.Router();

const pkrRate = () => parseFloat(process.env.PKR_RATE) || 280;

// ── GET /api/wallet/balance ───────────────────────────────────────────────────
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT balance_usdt, frozen_usdt, points, vip_level FROM users WHERE id = $1`,
      [userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = result.rows[0];

    const statsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'task_reward' THEN amount_usdt ELSE 0 END), 0)        AS total_earned,
         COALESCE(SUM(CASE WHEN type = 'withdrawal'  AND status = 'completed' THEN amount_usdt ELSE 0 END), 0) AS total_withdrawn,
         COALESCE(SUM(CASE WHEN type = 'recharge'    AND status = 'completed' THEN amount_usdt ELSE 0 END), 0) AS total_recharged,
         COALESCE(SUM(CASE WHEN type = 'referral_commission' THEN amount_usdt ELSE 0 END), 0) AS total_referral
       FROM transactions WHERE user_id = $1`,
      [userId]
    );
    const s = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        balance_usdt: parseFloat(user.balance_usdt),
        balance_pkr: (user.balance_usdt * pkrRate()).toFixed(2),
        frozen_usdt: parseFloat(user.frozen_usdt || 0),
        points: user.points,
        vip_level: user.vip_level || 0,
        total_earned_usdt: parseFloat(s.total_earned),
        total_withdrawn_usdt: parseFloat(s.total_withdrawn),
        total_recharged_usdt: parseFloat(s.total_recharged),
        total_referral_usdt: parseFloat(s.total_referral)
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch balance' });
  }
});

// ── GET /api/wallet/transactions ──────────────────────────────────────────────
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const type   = req.query.type || null;
    const offset = (page - 1) * limit;

    let query  = `SELECT id, type, amount_usdt, amount_pkr, payment_method, status, notes, created_at
                  FROM transactions WHERE user_id = $1`;
    const params = [userId];

    if (type) { query += ` AND type = $${params.length + 1}`; params.push(type); }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQ = `SELECT COUNT(*) FROM transactions WHERE user_id = $1`;
    const cParams = [userId];
    if (type) { countQ += ` AND type = $2`; cParams.push(type); }
    const countResult = await pool.query(countQ, cParams);
    const total = parseInt(countResult.rows[0].count);

    const transactions = result.rows.map(tx => ({
      ...tx,
      amount_pkr: tx.amount_pkr || (tx.amount_usdt * pkrRate()).toFixed(2)
    }));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

// ── GET /api/wallet/payment-info ──────────────────────────────────────────────
// Returns all active payment methods with account details and QR codes
router.get('/payment-info', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, identifier, account_name, account_number,
              qr_code_url, instructions, icon, color
       FROM payment_methods
       WHERE is_active = true
       ORDER BY display_order ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get payment info error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment info' });
  }
});

// ── POST /api/wallet/recharge ─────────────────────────────────────────────────
router.post('/recharge', authenticate, [
  body('amount_usdt').isFloat({ min: 1 }).withMessage('Invalid amount'),
  body('payment_method').notEmpty().withMessage('Payment method required'),
  body('account_number').notEmpty().withMessage('Account number required'),
  body('account_name').notEmpty().withMessage('Account name required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { amount_usdt, payment_method, account_number, account_name, payment_reference } = req.body;
    const userId = req.user.id;
    const rate   = pkrRate();

    const result = await pool.query(
      `INSERT INTO transactions
         (user_id, type, amount_usdt, amount_pkr, payment_method, payment_reference, status, notes)
       VALUES ($1, 'recharge', $2, $3, $4, $5, 'pending', $6)
       RETURNING id, created_at`,
      [userId, amount_usdt, (amount_usdt * rate).toFixed(2), payment_method,
       payment_reference || null,
       `Recharge from ${account_name} (${account_number})`]
    );

    // notify user
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Recharge Submitted', $2, 'info')`,
      [userId, `Your recharge of ${amount_usdt} USDT is under review.`]
    );

    res.json({
      success: true,
      message: 'Recharge request submitted. Upload payment screenshot to confirm.',
      data: {
        transaction_id: result.rows[0].id,
        amount_usdt,
        amount_pkr: (amount_usdt * rate).toFixed(2),
        status: 'pending',
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({ success: false, message: 'Failed to create recharge request' });
  }
});

// ── POST /api/wallet/recharge/:id/screenshot ──────────────────────────────────
router.post('/recharge/:id/screenshot', authenticate, uploadSingle('screenshot'), async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // FIX: was using double-quote SQL string literal — now uses single quotes
    const txResult = await pool.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND type = 'recharge'`,
      [transactionId, userId]
    );
    if (!txResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const screenshotUrl = `/uploads/${req.file.filename}`;
    await pool.query(
      `UPDATE transactions SET screenshot_url = $1 WHERE id = $2`,
      [screenshotUrl, transactionId]
    );

    res.json({
      success: true,
      message: 'Screenshot uploaded. Admin will review and credit your balance.',
      data: { transaction_id: transactionId, screenshot_url: screenshotUrl }
    });
  } catch (error) {
    console.error('Upload screenshot error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload screenshot' });
  }
});

// ── POST /api/wallet/withdraw ─────────────────────────────────────────────────
router.post('/withdraw', authenticate, requireKYC, [
  body('amount_usdt').isFloat({ min: 1 }).withMessage('Invalid amount'),
  body('payment_method').notEmpty().withMessage('Payment method required'),
  body('account_number').notEmpty().withMessage('Account number required'),
  body('account_name').notEmpty().withMessage('Account name required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { amount_usdt, payment_method, account_number, account_name } = req.body;
    const userId = req.user.id;
    const rate   = pkrRate();

    // get user VIP for min-withdraw check
    const userResult = await pool.query(
      'SELECT balance_usdt, vip_level FROM users WHERE id = $1', [userId]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { balance_usdt, vip_level } = userResult.rows[0];

    const vipResult = await pool.query('SELECT min_withdraw_usdt FROM vip_levels WHERE level = $1', [vip_level || 0]);
    const minWithdraw = vipResult.rows.length ? parseFloat(vipResult.rows[0].min_withdraw_usdt) : 10;

    if (parseFloat(amount_usdt) < minWithdraw) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is ${minWithdraw} USDT` });
    }
    if (parseFloat(amount_usdt) > parseFloat(balance_usdt)) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // deduct balance immediately (freeze until processed)
    await pool.query(
      `UPDATE users
       SET balance_usdt = balance_usdt - $1, frozen_usdt = frozen_usdt + $1
       WHERE id = $2`,
      [amount_usdt, userId]
    );

    const result = await pool.query(
      `INSERT INTO transactions
         (user_id, type, amount_usdt, amount_pkr, payment_method, status, notes)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5)
       RETURNING id, created_at`,
      [userId, amount_usdt, (amount_usdt * rate).toFixed(2), payment_method,
       `Withdrawal to ${account_name} (${account_number})`]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'Withdrawal Requested', $2, 'info')`,
      [userId, `Your withdrawal of ${amount_usdt} USDT is being processed.`]
    );

    res.json({
      success: true,
      message: 'Withdrawal submitted. Admin will process within 24–48 hours.',
      data: {
        transaction_id: result.rows[0].id,
        amount_usdt,
        amount_pkr: (amount_usdt * rate).toFixed(2),
        status: 'pending',
        estimated_completion: '24–48 hours'
      }
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, message: 'Failed to create withdrawal request' });
  }
});

module.exports = router;
