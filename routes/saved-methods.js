/**
 * RFT Entertainment — Saved Payout Methods
 * Users can save their bank/mobile wallet accounts for quick withdrawal
 */
const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/saved-methods — list user's saved payout methods
router.get('/', authenticate, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, method_name, account_name, account_number, is_default, created_at
       FROM saved_payout_methods
       WHERE user_id = $1 AND is_active = true
       ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Get saved methods error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch saved methods', error: err.message });
  }
});

// POST /api/saved-methods — save a new payout method
router.post('/', authenticate, async (req, res) => {
  try {
    const { method_name, account_name, account_number, is_default } = req.body;
    if (!method_name || !account_name || !account_number) {
      return res.status(400).json({ success: false, message: 'method_name, account_name, account_number required' });
    }

    // If this is default, unset others
    if (is_default) {
      await pool.query(
        `UPDATE saved_payout_methods SET is_default = false WHERE user_id = $1`,
        [req.user.id]
      );
    }

    const r = await pool.query(
      `INSERT INTO saved_payout_methods (user_id, method_name, account_name, account_number, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, method_name, account_name, account_number, is_default`,
      [req.user.id, method_name, account_name, account_number, is_default || false]
    );
    res.status(201).json({ success: true, data: r.rows[0], message: 'Method saved' });
  } catch (err) {
    console.error('Save method error:', err);
    res.status(500).json({ success: false, message: 'Failed to save method', error: err.message });
  }
});

// PUT /api/saved-methods/:id/default — set as default
router.put('/:id/default', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE saved_payout_methods SET is_default = false WHERE user_id = $1`, [req.user.id]
    );
    await pool.query(
      `UPDATE saved_payout_methods SET is_default = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Default updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update default' });
  }
});

// DELETE /api/saved-methods/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE saved_payout_methods SET is_active = false WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Method removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove method' });
  }
});

module.exports = router;
