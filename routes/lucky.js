const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Prize table — weighted random
// weights must sum to 100
const PRIZES = [
  { label: 'Try Again',  usdt: 0,    points: 0,   weight: 35, color: '#333344' },
  { label: '+10 Points', usdt: 0,    points: 10,  weight: 25, color: '#1a3a5c' },
  { label: '+20 Points', usdt: 0,    points: 20,  weight: 15, color: '#2d1a5c' },
  { label: '0.05 USDT',  usdt: 0.05, points: 0,   weight: 10, color: '#5c3a00' },
  { label: '0.10 USDT',  usdt: 0.10, points: 0,   weight: 7,  color: '#1a5c2a' },
  { label: '0.25 USDT',  usdt: 0.25, points: 0,   weight: 4,  color: '#5c1a00' },
  { label: '0.50 USDT',  usdt: 0.50, points: 0,   weight: 2,  color: '#003366' },
  { label: '1.00 USDT',  usdt: 1.00, points: 0,   weight: 1,  color: '#4a0000' },
  { label: '+50 Points', usdt: 0,    points: 50,  weight: 1,  color: '#1a4a00' },
];

function pickPrize() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const prize of PRIZES) {
    cumulative += prize.weight;
    if (rand < cumulative) return prize;
  }
  return PRIZES[0];
}

// GET /api/lucky/status — can the user spin today?
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const r = await pool.query(
      `SELECT id, prize_label, prize_usdt, prize_points, created_at
       FROM lucky_draws WHERE user_id=$1 AND spin_date=$2`,
      [userId, today]
    );

    res.json({
      success: true,
      data: {
        can_spin:   r.rows.length === 0,
        last_spin:  r.rows[0] || null,
        prizes:     PRIZES.map(p => ({ label: p.label, color: p.color })),
        next_spin:  r.rows.length > 0 ? 'Tomorrow' : 'Now'
      }
    });
  } catch (err) {
    console.error('Lucky status error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch spin status' });
  }
});

// POST /api/lucky/spin — spin the wheel (once per day)
router.post('/spin', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    // Check already spun today
    const existing = await pool.query(
      `SELECT id FROM lucky_draws WHERE user_id=$1 AND spin_date=$2`,
      [userId, today]
    );
    if (existing.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'You have already spun today. Come back tomorrow!'
      });
    }

    const prize = pickPrize();

    // Record spin
    await pool.query(
      `INSERT INTO lucky_draws (user_id, spin_date, prize_label, prize_usdt, prize_points)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, today, prize.label, prize.usdt, prize.points]
    );

    // Credit reward
    if (prize.usdt > 0) {
      await pool.query(
        `UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2`,
        [prize.usdt, userId]
      );
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
         VALUES ($1, 'lucky_draw', $2, $3, 'completed', $4)`,
        [userId, prize.usdt, (prize.usdt * pkrRate).toFixed(2), `Lucky Draw: ${prize.label}`]
      );
    }
    if (prize.points > 0) {
      await pool.query(
        `UPDATE users SET points = points + $1 WHERE id = $2`,
        [prize.points, userId]
      );
    }

    // Send notification
    if (prize.usdt > 0 || prize.points > 0) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, '🎰 Lucky Draw!', $2, 'success')`,
        [userId, `You won ${prize.label} from the Lucky Draw!`]
      );
    }

    // Get updated balance
    const balRes = await pool.query(
      'SELECT balance_usdt, points FROM users WHERE id=$1', [userId]
    );

    res.json({
      success: true,
      message: prize.usdt > 0 || prize.points > 0 ? `🎉 You won ${prize.label}!` : 'Better luck tomorrow!',
      data: {
        prize:           prize.label,
        prize_usdt:      prize.usdt,
        prize_points:    prize.points,
        prize_color:     prize.color,
        prize_index:     PRIZES.indexOf(prize),
        new_balance_usdt: parseFloat(balRes.rows[0].balance_usdt),
        new_points:       balRes.rows[0].points
      }
    });
  } catch (err) {
    console.error('Lucky spin error:', err);
    res.status(500).json({ success: false, message: 'Spin failed' });
  }
});

module.exports = router;
