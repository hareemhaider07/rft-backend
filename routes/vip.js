const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/vip/levels  — all VIP tiers
router.get('/levels', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT level, name, required_deposit_usdt, daily_task_limit, task_reward_usdt,
              referral_bonus_usdt, level1_commission_rate, level2_commission_rate,
              level3_commission_rate, min_withdraw_usdt, color, badge_icon
       FROM vip_levels WHERE is_active = true ORDER BY level ASC`
    );
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;
    const levels = result.rows.map(v => ({
      ...v,
      required_deposit_pkr: (v.required_deposit_usdt * pkrRate).toFixed(2),
      task_reward_pkr:      (v.task_reward_usdt      * pkrRate).toFixed(2)
    }));
    res.json({ success: true, data: levels });
  } catch (err) {
    console.error('VIP levels error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP levels' });
  }
});

// GET /api/vip/status  — current user's VIP info + progress to next level
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userRes = await pool.query(
      'SELECT vip_level, balance_usdt FROM users WHERE id = $1', [userId]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { vip_level, balance_usdt } = userRes.rows[0];

    // total deposited
    const depositRes = await pool.query(
      `SELECT COALESCE(SUM(amount_usdt), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'recharge' AND status = 'completed'`,
      [userId]
    );
    const totalDeposited = parseFloat(depositRes.rows[0].total);

    // current vip config
    const curRes = await pool.query('SELECT * FROM vip_levels WHERE level = $1', [vip_level]);
    const current = curRes.rows[0] || {};

    // next vip config
    const nextRes = await pool.query(
      'SELECT * FROM vip_levels WHERE level = $1', [vip_level + 1]
    );
    const next = nextRes.rows[0] || null;

    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    res.json({
      success: true,
      data: {
        current_level: vip_level,
        current_vip: current,
        next_vip: next,
        total_deposited_usdt: totalDeposited,
        needed_for_next_usdt: next
          ? Math.max(0, parseFloat(next.required_deposit_usdt) - totalDeposited)
          : 0,
        progress_pct: next && parseFloat(next.required_deposit_usdt) > 0
          ? Math.min(100, Math.round((totalDeposited / parseFloat(next.required_deposit_usdt)) * 100))
          : 100
      }
    });
  } catch (err) {
    console.error('VIP status error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch VIP status' });
  }
});

// POST /api/vip/upgrade  — re-evaluate VIP level based on total deposits
// Called automatically after a deposit is approved, or manually by user
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const depositRes = await pool.query(
      `SELECT COALESCE(SUM(amount_usdt), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'recharge' AND status = 'completed'`,
      [userId]
    );
    const totalDeposited = parseFloat(depositRes.rows[0].total);

    // find highest eligible level
    const levelsRes = await pool.query(
      `SELECT level FROM vip_levels
       WHERE is_active = true AND required_deposit_usdt <= $1
       ORDER BY level DESC LIMIT 1`,
      [totalDeposited]
    );
    const newLevel = levelsRes.rows.length ? levelsRes.rows[0].level : 0;

    const userRes = await pool.query('SELECT vip_level FROM users WHERE id = $1', [userId]);
    const oldLevel = userRes.rows[0]?.vip_level || 0;

    if (newLevel > oldLevel) {
      await pool.query('UPDATE users SET vip_level = $1 WHERE id = $2', [newLevel, userId]);

      // notify user
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'success')`,
        [userId, `🎉 VIP ${newLevel} Unlocked!`,
         `Congratulations! You have been upgraded to VIP ${newLevel}. Enjoy higher rewards and limits.`]
      );

      return res.json({
        success: true,
        message: `Upgraded to VIP ${newLevel}!`,
        data: { old_level: oldLevel, new_level: newLevel, upgraded: true }
      });
    }

    res.json({
      success: true,
      message: 'VIP level is already up to date.',
      data: { current_level: oldLevel, upgraded: false }
    });
  } catch (err) {
    console.error('VIP upgrade error:', err);
    res.status(500).json({ success: false, message: 'Failed to process VIP upgrade' });
  }
});

module.exports = router;
