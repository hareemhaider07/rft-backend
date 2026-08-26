const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── helpers ───────────────────────────────────────────────────────────────────

async function getUserVipLevel(userId) {
  const r = await pool.query('SELECT vip_level FROM users WHERE id = $1', [userId]);
  return r.rows.length ? (r.rows[0].vip_level || 0) : 0;
}

// Pick prize using weighted random from the pool for this VIP level
function pickPrize(prizes) {
  const rand = Math.random();
  let cumulative = 0;
  for (const prize of prizes) {
    cumulative += parseFloat(prize.probability);
    if (rand <= cumulative) return prize;
  }
  return prizes[prizes.length - 1]; // fallback to last
}

// ── GET /api/spin/prizes ──────────────────────────────────────────────────────
// Returns prizes for the user's VIP level (for rendering the wheel)
router.get('/prizes', authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const vipLevel = await getUserVipLevel(userId);
    const pkrRate  = parseFloat(process.env.PKR_RATE) || 280;

    // Get the highest prize tier this user qualifies for
    // e.g. VIP 3 gets VIP 3 prizes, VIP 1 gets VIP 1 prizes, VIP 0 gets VIP 0
    const tierResult = await pool.query(
      `SELECT DISTINCT min_vip_level FROM spin_prizes
       WHERE is_active = true AND min_vip_level <= $1
       ORDER BY min_vip_level DESC LIMIT 1`,
      [vipLevel]
    );
    const tier = tierResult.rows.length ? tierResult.rows[0].min_vip_level : 0;

    const prizes = await pool.query(
      `SELECT id, name, prize_type, prize_value, color, probability, display_order
       FROM spin_prizes
       WHERE is_active = true AND min_vip_level = $1
       ORDER BY display_order ASC`,
      [tier]
    );

    // Check if user already spun today
    const today = new Date().toISOString().split('T')[0];
    const spunToday = await pool.query(
      `SELECT id, prize_name, prize_type, prize_value, created_at
       FROM spin_history WHERE user_id = $1 AND spin_date = $2`,
      [userId, today]
    );

    // Check daily spins allowed based on VIP
    const spinsAllowed = vipLevel >= 3 ? 3 : vipLevel >= 1 ? 2 : 1;

    const spunCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM spin_history WHERE user_id = $1 AND spin_date = $2`,
      [userId, today]
    );
    const spinsUsed      = parseInt(spunCount.rows[0].cnt);
    const spinsRemaining = Math.max(0, spinsAllowed - spinsUsed);

    res.json({
      success: true,
      data: {
        prizes: prizes.rows.map(p => ({
          ...p,
          prize_value_pkr: p.prize_type === 'usdt'
            ? (parseFloat(p.prize_value) * pkrRate).toFixed(0)
            : null
        })),
        vip_level:        vipLevel,
        spins_allowed:    spinsAllowed,
        spins_used:       spinsUsed,
        spins_remaining:  spinsRemaining,
        can_spin:         spinsRemaining > 0,
        last_spin:        spunToday.rows[0] || null
      }
    });
  } catch (err) {
    console.error('Get prizes error:', err);
    res.status(500).json({ success: false, message: 'Failed to load spin prizes' });
  }
});

// ── POST /api/spin/spin ───────────────────────────────────────────────────────
router.post('/spin', authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const today    = new Date().toISOString().split('T')[0];
    const pkrRate  = parseFloat(process.env.PKR_RATE) || 280;
    const vipLevel = await getUserVipLevel(userId);

    // Check daily limit
    const spinsAllowed = vipLevel >= 3 ? 3 : vipLevel >= 1 ? 2 : 1;
    const spunCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM spin_history WHERE user_id = $1 AND spin_date = $2`,
      [userId, today]
    );
    const spinsUsed = parseInt(spunCount.rows[0].cnt);

    if (spinsUsed >= spinsAllowed) {
      return res.status(400).json({
        success: false,
        message: `Daily spin limit reached. Come back tomorrow!`,
        spins_used: spinsUsed,
        spins_allowed: spinsAllowed
      });
    }

    // Load eligible prizes
    const tierResult = await pool.query(
      `SELECT DISTINCT min_vip_level FROM spin_prizes
       WHERE is_active = true AND min_vip_level <= $1
       ORDER BY min_vip_level DESC LIMIT 1`,
      [vipLevel]
    );
    const tier = tierResult.rows.length ? tierResult.rows[0].min_vip_level : 0;

    const prizes = await pool.query(
      `SELECT * FROM spin_prizes WHERE is_active = true AND min_vip_level = $1 ORDER BY display_order ASC`,
      [tier]
    );
    if (!prizes.rows.length) {
      return res.status(500).json({ success: false, message: 'No prizes configured' });
    }

    // Pick winner
    const winner = pickPrize(prizes.rows);

    // Record spin (unique constraint prevents double-spin on same day if spinsAllowed=1)
    // For multiple spins we just INSERT without unique constraint issue
    await pool.query(
      `INSERT INTO spin_history (user_id, prize_id, prize_name, prize_type, prize_value, spin_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, winner.id, winner.name, winner.prize_type, winner.prize_value, today]
    );

    // Credit reward
    if (winner.prize_type === 'usdt' && parseFloat(winner.prize_value) > 0) {
      await pool.query(
        `UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2`,
        [winner.prize_value, userId]
      );
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
         VALUES ($1, 'spin_reward', $2, $3, 'completed', $4)`,
        [userId, winner.prize_value, (winner.prize_value * pkrRate).toFixed(2),
         `Lucky draw: ${winner.name}`]
      );
    } else if (winner.prize_type === 'points' && parseFloat(winner.prize_value) > 0) {
      await pool.query(
        `UPDATE users SET points = points + $1 WHERE id = $2`,
        [Math.floor(winner.prize_value), userId]
      );
    }

    // Send notification
    let notifMsg = winner.prize_type === 'empty'
      ? 'Better luck next time! Try again tomorrow.'
      : `You won ${winner.name} from the Lucky Draw!`;
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, '🎡 Lucky Draw Result', $2, $3)`,
      [userId, notifMsg, winner.prize_type === 'empty' ? 'info' : 'success']
    );

    // Get updated balance
    const balRes = await pool.query(
      'SELECT balance_usdt, points FROM users WHERE id = $1', [userId]
    );

    const spinsNowUsed = spinsUsed + 1;

    res.json({
      success: true,
      data: {
        prize: {
          id:          winner.id,
          name:        winner.name,
          prize_type:  winner.prize_type,
          prize_value: parseFloat(winner.prize_value),
          prize_value_pkr: winner.prize_type === 'usdt'
            ? (winner.prize_value * pkrRate).toFixed(0) : null,
          color:       winner.color,
          won:         winner.prize_type !== 'empty'
        },
        new_balance_usdt: parseFloat(balRes.rows[0].balance_usdt),
        new_points:       balRes.rows[0].points,
        spins_used:       spinsNowUsed,
        spins_remaining:  Math.max(0, spinsAllowed - spinsNowUsed),
        can_spin:         spinsNowUsed < spinsAllowed
      }
    });
  } catch (err) {
    console.error('Spin error:', err);
    res.status(500).json({ success: false, message: 'Spin failed. Try again.' });
  }
});

// ── GET /api/spin/history ─────────────────────────────────────────────────────
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = parseInt(req.query.limit) || 20;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const r = await pool.query(
      `SELECT id, prize_name, prize_type, prize_value, spin_date, created_at
       FROM spin_history WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );

    const history = r.rows.map(h => ({
      ...h,
      prize_value_pkr: h.prize_type === 'usdt'
        ? (parseFloat(h.prize_value) * pkrRate).toFixed(0) : null
    }));

    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Spin history error:', err);
    res.status(500).json({ success: false, message: 'Failed to load spin history' });
  }
});

// ── GET /api/spin/stats (admin use + profile) ─────────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const r = await pool.query(
      `SELECT
         COUNT(*) AS total_spins,
         COALESCE(SUM(CASE WHEN prize_type='usdt'   THEN prize_value ELSE 0 END), 0) AS total_usdt_won,
         COALESCE(SUM(CASE WHEN prize_type='points' THEN prize_value ELSE 0 END), 0) AS total_points_won,
         COUNT(CASE WHEN prize_type='empty' THEN 1 END) AS empty_spins
       FROM spin_history WHERE user_id = $1`,
      [userId]
    );
    const s = r.rows[0];
    res.json({
      success: true,
      data: {
        total_spins:      parseInt(s.total_spins),
        total_usdt_won:   parseFloat(s.total_usdt_won),
        total_usdt_pkr:   (s.total_usdt_won * pkrRate).toFixed(0),
        total_points_won: parseInt(s.total_points_won),
        empty_spins:      parseInt(s.empty_spins)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load spin stats' });
  }
});

module.exports = router;
