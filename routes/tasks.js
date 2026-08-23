const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function getUserVipLevel(userId) {
  const r = await pool.query('SELECT vip_level FROM users WHERE id = $1', [userId]);
  return r.rows.length ? (r.rows[0].vip_level || 0) : 0;
}

async function getVipConfig(level) {
  const r = await pool.query('SELECT * FROM vip_levels WHERE level = $1', [level]);
  if (r.rows.length) return r.rows[0];
  // fallback to level 0
  const def = await pool.query('SELECT * FROM vip_levels WHERE level = 0');
  return def.rows[0] || { daily_task_limit: 10, task_reward_usdt: 0.10 };
}

// ── GET /api/tasks ────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;
    const today = new Date().toISOString().split('T')[0];

    const vipLevel = await getUserVipLevel(userId);
    const vipCfg   = await getVipConfig(vipLevel);
    const dailyLimit = vipCfg.daily_task_limit;

    // tasks completed today
    const completedResult = await pool.query(
      `SELECT task_id FROM daily_task_tracking
       WHERE user_id = $1 AND task_date = $2 AND status = 'completed'`,
      [userId, today]
    );
    const completedTaskIds = completedResult.rows.map(r => r.task_id);

    // active tasks visible for this vip level
    const tasksResult = await pool.query(
      `SELECT id, title, description, thumbnail_url, video_url, task_type,
              reward_usdt, duration_seconds, order_index, min_vip_level
       FROM tasks
       WHERE is_active = true AND min_vip_level <= $1
       ORDER BY order_index ASC, created_at ASC`,
      [vipLevel]
    );

    const tasks = tasksResult.rows.map(task => ({
      ...task,
      reward_pkr: (task.reward_usdt * pkrRate).toFixed(2),
      is_completed: completedTaskIds.includes(task.id)
    }));

    res.json({
      success: true,
      data: {
        tasks,
        stats: {
          completed_today: completedTaskIds.length,
          remaining_today: dailyLimit === 0 ? 999 : Math.max(0, dailyLimit - completedTaskIds.length),
          daily_limit: dailyLimit,
          vip_level: vipLevel
        }
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
});

// ── POST /api/tasks/:id/start ─────────────────────────────────────────────────
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND is_active = true', [taskId]
    );
    if (!taskResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskResult.rows[0];

    const vipLevel = await getUserVipLevel(userId);

    if (task.min_vip_level > vipLevel) {
      return res.status(403).json({ success: false, message: `This task requires VIP ${task.min_vip_level} or higher` });
    }

    // already completed today?
    const done = await pool.query(
      `SELECT id FROM daily_task_tracking
       WHERE user_id = $1 AND task_id = $2 AND task_date = $3 AND status = 'completed'`,
      [userId, taskId, today]
    );
    if (done.rows.length) {
      return res.status(400).json({ success: false, message: 'Task already completed today' });
    }

    // daily limit check
    const vipCfg = await getVipConfig(vipLevel);
    const dailyLimit = vipCfg.daily_task_limit;
    if (dailyLimit > 0) {
      const countResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM daily_task_tracking
         WHERE user_id = $1 AND task_date = $2 AND status = 'completed'`,
        [userId, today]
      );
      if (parseInt(countResult.rows[0].cnt) >= dailyLimit) {
        return res.status(400).json({ success: false, message: 'Daily task limit reached' });
      }
    }

    // upsert pending row for today
    await pool.query(
      `INSERT INTO daily_task_tracking (user_id, task_id, task_date, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (user_id, task_id, task_date) DO UPDATE SET status = 'pending'`,
      [userId, taskId, today]
    );

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

    res.json({
      success: true,
      data: {
        task_id: task.id,
        session_id: sessionId,
        video_url: task.video_url,
        duration_seconds: task.duration_seconds || 30
      }
    });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({ success: false, message: 'Failed to start task' });
  }
});

// ── POST /api/tasks/:id/complete ──────────────────────────────────────────────
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];
    const { session_id, watch_duration_seconds = 0 } = req.body;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND is_active = true', [taskId]
    );
    if (!taskResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    const task = taskResult.rows[0];

    // must have been started today
    const trackResult = await pool.query(
      `SELECT id, status FROM daily_task_tracking
       WHERE user_id = $1 AND task_id = $2 AND task_date = $3`,
      [userId, taskId, today]
    );
    if (!trackResult.rows.length) {
      return res.status(400).json({ success: false, message: 'Task not started. Call /start first.' });
    }
    if (trackResult.rows[0].status === 'completed') {
      return res.status(400).json({ success: false, message: 'Task already completed today' });
    }

    // watch-duration gate (80% rule)
    if (task.duration_seconds && watch_duration_seconds < task.duration_seconds * 0.8) {
      return res.status(400).json({ success: false, message: 'Video not watched long enough' });
    }

    const rewardUsdt = parseFloat(task.reward_usdt);

    // mark completed
    await pool.query(
      `UPDATE daily_task_tracking
       SET status = 'completed', completed_at = NOW(),
           reward_usdt = $1, watch_duration_seconds = $2
       WHERE user_id = $3 AND task_id = $4 AND task_date = $5`,
      [rewardUsdt, watch_duration_seconds, userId, taskId, today]
    );

    // credit balance + points
    await pool.query(
      `UPDATE users
       SET balance_usdt = balance_usdt + $1, points = points + 10
       WHERE id = $2`,
      [rewardUsdt, userId]
    );

    // record transaction (FIX: was missing before)
    await pool.query(
      `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
       VALUES ($1, 'task_reward', $2, $3, 'completed', $4)`,
      [userId, rewardUsdt, (rewardUsdt * pkrRate).toFixed(2), `Task reward: ${task.title}`]
    );

    // send referral commissions up the chain
    await creditReferralCommissions(userId, rewardUsdt, 'task_reward');

    const balRes = await pool.query('SELECT balance_usdt, points FROM users WHERE id = $1', [userId]);

    res.json({
      success: true,
      message: 'Task completed successfully',
      data: {
        reward_usdt: rewardUsdt,
        reward_pkr: (rewardUsdt * pkrRate).toFixed(2),
        new_balance_usdt: parseFloat(balRes.rows[0].balance_usdt),
        points: balRes.rows[0].points
      }
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete task' });
  }
});

// ── creditReferralCommissions (shared helper used by tasks + wallet) ───────────
async function creditReferralCommissions(userId, earningUsdt, sourceType) {
  try {
    const refs = await pool.query(
      `SELECT r.referrer_id, r.referral_level, r.commission_rate
       FROM referrals r
       WHERE r.referred_id = $1 AND r.referral_level <= 3
       ORDER BY r.referral_level ASC`,
      [userId]
    );
    for (const ref of refs.rows) {
      const commission = parseFloat((earningUsdt * parseFloat(ref.commission_rate)).toFixed(4));
      if (commission <= 0) continue;
      await pool.query(
        `UPDATE users SET balance_usdt = balance_usdt + $1 WHERE id = $2`,
        [commission, ref.referrer_id]
      );
      await pool.query(
        `UPDATE referrals SET total_commission_usdt = total_commission_usdt + $1
         WHERE referrer_id = $2 AND referred_id = $3`,
        [commission, ref.referrer_id, userId]
      );
      const pkrRate = parseFloat(process.env.PKR_RATE) || 280;
      await pool.query(
        `INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
         VALUES ($1, 'referral_commission', $2, $3, 'completed', $4)`,
        [ref.referrer_id, commission, (commission * pkrRate).toFixed(2),
         `Level ${ref.referral_level} commission from ${sourceType}`]
      );
    }
  } catch (err) {
    console.error('Credit referral commissions error:', err);
  }
}

module.exports = router;
module.exports.creditReferralCommissions = creditReferralCommissions;
