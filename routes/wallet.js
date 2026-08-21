const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, requireKYC } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

const router = express.Router();

// Get wallet balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const result = await pool.query(
      `SELECT balance_usdt, points FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Get total earned and withdrawn
    const statsResult = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'task_reward' THEN amount_usdt ELSE 0 END), 0) as total_earned,
         COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN amount_usdt ELSE 0 END), 0) as total_withdrawn
       FROM transactions 
       WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        balance_usdt: parseFloat(user.balance_usdt),
        balance_pkr: (user.balance_usdt * pkrRate).toFixed(2),
        points: user.points,
        frozen_usdt: 0,
        total_earned_usdt: parseFloat(stats.total_earned),
        total_withdrawn_usdt: parseFloat(stats.total_withdrawn)
      }
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch balance'
    });
  }
});

// Get transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;
    const offset = (page - 1) * limit;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    let query = `
      SELECT id, type, amount_usdt, amount_pkr, payment_method, status, notes, created_at
      FROM transactions 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM transactions WHERE user_id = $1`;
    const countParams = [userId];
    if (type) {
      countQuery += ` AND type = $2`;
      countParams.push(type);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const transactions = result.rows.map(tx => ({
      ...tx,
      amount_pkr: tx.amount_pkr || (tx.amount_usdt * pkrRate).toFixed(2)
    }));

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

// Recharge with bank transfer screenshot
router.post('/recharge', authenticate, [
  body('amount_usdt').isFloat({ min: parseFloat(process.env.MIN_RECHARGE_USDT) || 10, max: parseFloat(process.env.MAX_RECHARGE_USDT) || 10000 }).withMessage('Invalid amount'),
  body('payment_method').notEmpty().withMessage('Payment method is required'),
  body('account_number').notEmpty().withMessage('Account number is required'),
  body('account_name').notEmpty().withMessage('Account name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount_usdt, payment_method, account_number, account_name } = req.body;
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, payment_method, status, notes)
       VALUES ($1, 'recharge', $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userId, amount_usdt, (amount_usdt * pkrRate).toFixed(2), payment_method, `Bank transfer from ${account_name} (${account_number})`]
    );

    const transaction = result.rows[0];

    res.json({
      success: true,
      message: 'Recharge request submitted. Please upload payment screenshot.',
      data: {
        transaction_id: transaction.id,
        amount_usdt,
        amount_pkr: (amount_usdt * pkrRate).toFixed(2),
        status: 'pending',
        payment_method,
        notes: 'Upload screenshot to /api/wallet/recharge/:id/screenshot'
      }
    });
  } catch (error) {
    console.error('Recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create recharge request'
    });
  }
});

// Upload recharge screenshot
router.post('/recharge/:id/screenshot', authenticate, uploadSingle('screenshot'), async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify transaction belongs to user
    const txResult = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND type = "recharge"',
      [transactionId, userId]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Update transaction with screenshot URL
    const screenshotUrl = `/uploads/${req.file.filename}`;
    await pool.query(
      'UPDATE transactions SET screenshot_url = $1 WHERE id = $2',
      [screenshotUrl, transactionId]
    );

    res.json({
      success: true,
      message: 'Screenshot uploaded successfully',
      data: {
        transaction_id: transactionId,
        screenshot_url: screenshotUrl
      }
    });
  } catch (error) {
    console.error('Upload screenshot error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload screenshot'
    });
  }
});

// Withdraw (requires KYC)
router.post('/withdraw', authenticate, requireKYC, [
  body('amount_usdt').isFloat({ min: parseFloat(process.env.MIN_WITHDRAW_USDT) || 10, max: parseFloat(process.env.MAX_WITHDRAW_USDT) || 10000 }).withMessage('Invalid amount'),
  body('payment_method').notEmpty().withMessage('Payment method is required'),
  body('account_number').notEmpty().withMessage('Account number is required'),
  body('account_name').notEmpty().withMessage('Account name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount_usdt, payment_method, account_number, account_name } = req.body;
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    // Check balance
    const balanceResult = await pool.query(
      'SELECT balance_usdt FROM users WHERE id = $1',
      [userId]
    );

    if (balanceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const balance = parseFloat(balanceResult.rows[0].balance_usdt);

    if (amount_usdt > balance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Freeze the amount
    await pool.query(
      'UPDATE users SET balance_usdt = balance_usdt - $1 WHERE id = $2',
      [amount_usdt, userId]
    );

    // Create transaction record
    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, payment_method, status, notes)
       VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userId, amount_usdt, (amount_usdt * pkrRate).toFixed(2), payment_method, `Withdrawal to ${account_name} (${account_number})`]
    );

    const transaction = result.rows[0];

    res.json({
      success: true,
      message: 'Withdrawal request submitted. Admin will review and process.',
      data: {
        transaction_id: transaction.id,
        amount_usdt,
        amount_pkr: (amount_usdt * pkrRate).toFixed(2),
        status: 'pending',
        payment_method,
        estimated_completion: '24-48 hours'
      }
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request'
    });
  }
});

module.exports = router;
