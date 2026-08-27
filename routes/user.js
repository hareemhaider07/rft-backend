const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
// v2.0 — includes /earnings-chart and /leaderboard endpoints

const router = express.Router();

// GET /api/user/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, residence, occupation, whatsapp, age, gender,
              kyc_status, balance_usdt, frozen_usdt, points, vip_level,
              referral_code, referred_by, is_active, is_verified, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// PUT /api/user/profile
router.put('/profile', authenticate, [
  body('name').optional().trim(),
  body('residence').optional().trim(),
  body('occupation').optional().trim(),
  body('whatsapp').optional().trim(),
  body('age').optional().isInt({ min: 18, max: 120 }),
  body('gender').optional().isIn(['male', 'female', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    const { name, residence, occupation, whatsapp, age, gender } = req.body;
    const result = await pool.query(
      `UPDATE users
       SET name=COALESCE($1,name), residence=COALESCE($2,residence),
           occupation=COALESCE($3,occupation), whatsapp=COALESCE($4,whatsapp),
           age=COALESCE($5,age), gender=COALESCE($6,gender), updated_at=NOW()
       WHERE id=$7
       RETURNING id, name, email, phone, residence, occupation, whatsapp, age, gender`,
      [name, residence, occupation, whatsapp, age, gender, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// GET /api/user/stats  — uses daily_task_tracking (fixed from old user_tasks)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    const [taskAll, taskToday, earnedAll, earnedToday, referralCount] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS cnt FROM daily_task_tracking WHERE user_id=$1 AND status='completed'`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM daily_task_tracking WHERE user_id=$1 AND task_date=$2 AND status='completed'`,
        [userId, today]
      ),
      pool.query(
        `SELECT COALESCE(SUM(reward_usdt),0) AS total FROM daily_task_tracking WHERE user_id=$1 AND status='completed'`,
        [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(reward_usdt),0) AS total FROM daily_task_tracking WHERE user_id=$1 AND task_date=$2 AND status='completed'`,
        [userId, today]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id=$1 AND referral_level=1`,
        [userId]
      )
    ]);

    // get VIP daily limit
    const userRes = await pool.query('SELECT vip_level FROM users WHERE id=$1', [userId]);
    const vipLevel = userRes.rows[0]?.vip_level || 0;
    const vipRes = await pool.query('SELECT daily_task_limit FROM vip_levels WHERE level=$1', [vipLevel]);
    const dailyLimit = vipRes.rows[0]?.daily_task_limit || 10;

    const completedToday = parseInt(taskToday.rows[0].cnt);

    res.json({
      success: true,
      data: {
        total_tasks_completed: parseInt(taskAll.rows[0].cnt),
        tasks_today:           completedToday,
        tasks_remaining:       dailyLimit === 0 ? 999 : Math.max(0, dailyLimit - completedToday),
        daily_limit:           dailyLimit,
        total_earned_usdt:     parseFloat(earnedAll.rows[0].total),
        today_earned_usdt:     parseFloat(earnedToday.rows[0].total),
        referral_count:        parseInt(referralCount.rows[0].cnt)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

// GET /api/user/earnings-chart?period=7|30|90
// Returns daily breakdown for the chart
router.get('/earnings-chart', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const period  = Math.min(parseInt(req.query.period) || 30, 90);
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    // Daily task earnings
    const taskRows = await pool.query(
      `SELECT task_date::text AS date,
              COALESCE(SUM(reward_usdt), 0) AS amount
       FROM daily_task_tracking
       WHERE user_id = $1
         AND status = 'completed'
         AND task_date >= CURRENT_DATE - INTERVAL '1 day' * $2
       GROUP BY task_date
       ORDER BY task_date ASC`,
      [userId, period]
    );

    // Daily referral + spin earnings from transactions
    const txRows = await pool.query(
      `SELECT DATE(created_at)::text AS date,
              type,
              COALESCE(SUM(amount_usdt), 0) AS amount
       FROM transactions
       WHERE user_id = $1
         AND status = 'completed'
         AND type IN ('referral_commission', 'referral_bonus', 'spin_reward')
         AND created_at >= CURRENT_DATE - INTERVAL '1 day' * $2
       GROUP BY DATE(created_at), type
       ORDER BY DATE(created_at) ASC`,
      [userId, period]
    );

    // Build a map of all dates in the range
    const dateMap = {};
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dateMap[key] = { date: key, tasks: 0, referral: 0, spin: 0, total: 0 };
    }

    // Fill task earnings
    for (const r of taskRows.rows) {
      if (dateMap[r.date]) {
        dateMap[r.date].tasks = parseFloat(r.amount);
      }
    }

    // Fill other earnings
    for (const r of txRows.rows) {
      if (!dateMap[r.date]) continue;
      const amt = parseFloat(r.amount);
      if (r.type === 'referral_commission' || r.type === 'referral_bonus') {
        dateMap[r.date].referral += amt;
      } else if (r.type === 'spin_reward') {
        dateMap[r.date].spin += amt;
      }
    }

    // Calculate totals and build array
    const days = Object.values(dateMap).map(d => {
      d.tasks    = parseFloat(d.tasks.toFixed(4));
      d.referral = parseFloat(d.referral.toFixed(4));
      d.spin     = parseFloat(d.spin.toFixed(4));
      d.total    = parseFloat((d.tasks + d.referral + d.spin).toFixed(4));
      return d;
    });

    // Summary stats
    const totalTasks    = days.reduce((s, d) => s + d.tasks,    0);
    const totalReferral = days.reduce((s, d) => s + d.referral, 0);
    const totalSpin     = days.reduce((s, d) => s + d.spin,     0);
    const totalAll      = totalTasks + totalReferral + totalSpin;
    const maxDay        = Math.max(...days.map(d => d.total), 0.001);

    // Streak: consecutive days with earnings
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].total > 0) streak++;
      else break;
    }

    // Best day
    const bestDay = days.reduce((best, d) => d.total > (best?.total || 0) ? d : best, null);

    res.json({
      success: true,
      data: {
        period,
        days,
        summary: {
          total_usdt:          parseFloat(totalAll.toFixed(4)),
          total_pkr:           (totalAll * pkrRate).toFixed(0),
          total_tasks_usdt:    parseFloat(totalTasks.toFixed(4)),
          total_referral_usdt: parseFloat(totalReferral.toFixed(4)),
          total_spin_usdt:     parseFloat(totalSpin.toFixed(4)),
          earning_streak:      streak,
          best_day_usdt:       bestDay ? parseFloat(bestDay.total.toFixed(4)) : 0,
          best_day_date:       bestDay?.date || null,
          active_days:         days.filter(d => d.total > 0).length,
          max_day_value:       parseFloat(maxDay.toFixed(4))
        }
      }
    });
  } catch (error) {
    console.error('Earnings chart error:', error);
    res.status(500).json({ success: false, message: 'Failed to load earnings chart', error: error.message });
  }
});

// GET /api/user/leaderboard?type=weekly|referrals|tasks|spin&limit=20
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const type    = req.query.type || 'weekly';
    const limit   = Math.min(parseInt(req.query.limit) || 20, 50);
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const maskName = (name, code) => {
      if (!name) return '•••' + (code || '').slice(-3);
      const first = name.split(' ')[0];
      if (first.length <= 2) return first.charAt(0) + '***';
      return first.charAt(0) + '•'.repeat(Math.min(first.length - 2, 4)) + first.slice(-1);
    };

    let rows = [];

    if (type === 'weekly') {
      // Top earners this week (task rewards)
      const r = await pool.query(
        `SELECT u.name, u.referral_code, u.vip_level,
                COALESCE(SUM(d.reward_usdt), 0) AS score
         FROM daily_task_tracking d
         JOIN users u ON u.id = d.user_id
         WHERE d.task_date >= CURRENT_DATE - INTERVAL '7 days'
           AND d.status = 'completed' AND u.is_active = true
         GROUP BY u.id, u.name, u.referral_code, u.vip_level
         ORDER BY score DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows.map((r, i) => ({
        rank: i + 1,
        display_name: maskName(r.name, r.referral_code),
        vip_level: r.vip_level || 0,
        score: parseFloat(r.score).toFixed(2),
        score_label: parseFloat(r.score).toFixed(2) + ' USDT',
        score_pkr: (r.score * pkrRate).toFixed(0)
      }));

    } else if (type === 'monthly') {
      // Top earners this month
      const r = await pool.query(
        `SELECT u.name, u.referral_code, u.vip_level,
                COALESCE(SUM(d.reward_usdt), 0) AS score
         FROM daily_task_tracking d
         JOIN users u ON u.id = d.user_id
         WHERE d.task_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND d.status = 'completed' AND u.is_active = true
         GROUP BY u.id, u.name, u.referral_code, u.vip_level
         ORDER BY score DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows.map((r, i) => ({
        rank: i + 1,
        display_name: maskName(r.name, r.referral_code),
        vip_level: r.vip_level || 0,
        score: parseFloat(r.score).toFixed(2),
        score_label: parseFloat(r.score).toFixed(2) + ' USDT',
        score_pkr: (r.score * pkrRate).toFixed(0)
      }));

    } else if (type === 'tasks') {
      // Most tasks completed all time
      const r = await pool.query(
        `SELECT u.name, u.referral_code, u.vip_level,
                COUNT(*) AS score
         FROM daily_task_tracking d
         JOIN users u ON u.id = d.user_id
         WHERE d.status = 'completed' AND u.is_active = true
         GROUP BY u.id, u.name, u.referral_code, u.vip_level
         ORDER BY score DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows.map((r, i) => ({
        rank: i + 1,
        display_name: maskName(r.name, r.referral_code),
        vip_level: r.vip_level || 0,
        score: parseInt(r.score),
        score_label: parseInt(r.score) + ' tasks',
        score_pkr: null
      }));

    } else if (type === 'referrals') {
      // Most referrals
      const r = await pool.query(
        `SELECT u.name, u.referral_code, u.vip_level,
                COUNT(ref.referred_id) AS score
         FROM users u
         LEFT JOIN referrals ref ON ref.referrer_id = u.id AND ref.referral_level = 1
         WHERE u.is_active = true
         GROUP BY u.id, u.name, u.referral_code, u.vip_level
         HAVING COUNT(ref.referred_id) > 0
         ORDER BY score DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows.map((r, i) => ({
        rank: i + 1,
        display_name: maskName(r.name, r.referral_code),
        vip_level: r.vip_level || 0,
        score: parseInt(r.score),
        score_label: parseInt(r.score) + ' referrals',
        score_pkr: null
      }));

    } else if (type === 'spin') {
      // Biggest spin winners
      const r = await pool.query(
        `SELECT u.name, u.referral_code, u.vip_level,
                COALESCE(SUM(sh.prize_value), 0) AS score,
                COUNT(*) AS spin_count
         FROM spin_history sh
         JOIN users u ON u.id = sh.user_id
         WHERE sh.prize_type = 'usdt' AND u.is_active = true
         GROUP BY u.id, u.name, u.referral_code, u.vip_level
         ORDER BY score DESC LIMIT $1`,
        [limit]
      );
      rows = r.rows.map((r, i) => ({
        rank: i + 1,
        display_name: maskName(r.name, r.referral_code),
        vip_level: r.vip_level || 0,
        score: parseFloat(r.score).toFixed(2),
        score_label: parseFloat(r.score).toFixed(2) + ' USDT won',
        score_pkr: (r.score * pkrRate).toFixed(0),
        spin_count: parseInt(r.spin_count)
      }));
    }

    // Find current user's rank
    let myRank = null;
    try {
      const userId = req.user.id;
      const myName = (await pool.query('SELECT name, referral_code FROM users WHERE id=$1', [userId])).rows[0];
      const myMasked = maskName(myName?.name, myName?.referral_code);
      const idx = rows.findIndex(r => r.display_name === myMasked);
      if (idx !== -1) myRank = idx + 1;
    } catch (_) {}

    res.json({
      success: true,
      data: {
        type,
        leaders: rows,
        my_rank: myRank,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard', error: error.message });
  }
});

module.exports = router;

// GET /api/user/my-tasks — completed task history
router.get('/my-tasks', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const [rows, cnt] = await Promise.all([
      pool.query(
        `SELECT d.id, d.task_date, d.status, d.reward_usdt, d.watch_duration_seconds,
                d.completed_at, t.title, t.task_type, t.thumbnail_url
         FROM daily_task_tracking d
         JOIN tasks t ON t.id = d.task_id
         WHERE d.user_id = $1 AND d.status = 'completed'
         ORDER BY d.completed_at DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM daily_task_tracking WHERE user_id=$1 AND status='completed'`,
        [userId]
      )
    ]);

    res.json({
      success: true,
      data: {
        tasks: rows.rows.map(r => ({
          ...r,
          reward_pkr: Math.round(parseFloat(r.reward_usdt) * pkrRate)
        })),
        pagination: {
          page, limit,
          total: parseInt(cnt.rows[0].cnt),
          total_pages: Math.ceil(cnt.rows[0].cnt / limit)
        }
      }
    });
  } catch (err) {
    console.error('My tasks error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch task history', error: err.message });
  }
});

// GET /api/user/team-stats — referral team performance summary
router.get('/team-stats', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    const [l1, l2, l3, commissions] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id=$1 AND referral_level=1`, [userId]),
      pool.query(`SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id=$1 AND referral_level=2`, [userId]),
      pool.query(`SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id=$1 AND referral_level=3`, [userId]),
      pool.query(
        `SELECT COALESCE(SUM(amount_usdt),0) AS total FROM transactions
         WHERE user_id=$1 AND type IN ('referral_commission','referral_bonus') AND status='completed'`,
        [userId]
      )
    ]);

    // Active referrals (logged in within 7 days)
    const activeRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id=$1 AND r.referral_level=1
         AND u.last_login_at > NOW() - INTERVAL '7 days'`,
      [userId]
    );

    // Commission by level
    const byLevel = await pool.query(
      `SELECT r.referral_level,
              COALESCE(SUM(r.total_commission_usdt),0) AS commission
       FROM referrals r WHERE r.referrer_id=$1
       GROUP BY r.referral_level ORDER BY r.referral_level`,
      [userId]
    );

    const levelMap = {};
    byLevel.rows.forEach(r => { levelMap[r.referral_level] = parseFloat(r.commission); });

    const totalComm = parseFloat(commissions.rows[0].total);

    res.json({
      success: true,
      data: {
        level1_count:   parseInt(l1.rows[0].cnt),
        level2_count:   parseInt(l2.rows[0].cnt),
        level3_count:   parseInt(l3.rows[0].cnt),
        total_count:    parseInt(l1.rows[0].cnt) + parseInt(l2.rows[0].cnt) + parseInt(l3.rows[0].cnt),
        active_7d:      parseInt(activeRes.rows[0].cnt),
        total_commission_usdt: totalComm,
        total_commission_pkr:  Math.round(totalComm * pkrRate),
        l1_commission:  levelMap[1] || 0,
        l2_commission:  levelMap[2] || 0,
        l3_commission:  levelMap[3] || 0
      }
    });
  } catch (err) {
    console.error('Team stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch team stats', error: err.message });
  }
});
