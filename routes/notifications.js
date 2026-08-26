const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
// v2.0 — includes /poll endpoint

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 20;
    const offset  = (page - 1) * limit;

    const [r, cnt, unread] = await Promise.all([
      pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications WHERE user_id=$1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=$1`, [userId]),
      pool.query(`SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=$1 AND is_read=false`, [userId])
    ]);

    res.json({
      success: true,
      data: {
        notifications: r.rows,
        unread_count:  parseInt(unread.rows[0].cnt),
        pagination: {
          page, limit,
          total:       parseInt(cnt.rows[0].cnt),
          total_pages: Math.ceil(cnt.rows[0].cnt / limit)
        }
      }
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// ── GET /api/notifications/poll ───────────────────────────────────────────────
// Lightweight polling endpoint — called every 15s by the frontend.
// Returns only unread count + any NEW notifications since ?since=<ISO timestamp>
// Minimises data transfer — only sends new items, not the full list.
router.get('/poll', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const since  = req.query.since || new Date(0).toISOString();

    const [unreadRes, newRes, balRes] = await Promise.all([
      // Total unread count
      pool.query(
        `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=$1 AND is_read=false`,
        [userId]
      ),
      // New notifications since last poll
      pool.query(
        `SELECT id, title, message, type, is_read, created_at
         FROM notifications
         WHERE user_id=$1 AND created_at > $2
         ORDER BY created_at ASC LIMIT 10`,
        [userId, since]
      ),
      // Fresh balance (so wallet always stays in sync)
      pool.query(
        `SELECT balance_usdt, frozen_usdt, points, vip_level FROM users WHERE id=$1`,
        [userId]
      )
    ]);

    const user = balRes.rows[0] || {};
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    res.json({
      success:      true,
      server_time:  new Date().toISOString(),
      unread_count: parseInt(unreadRes.rows[0].cnt),
      new_notifications: newRes.rows,
      balance: {
        usdt:      parseFloat(user.balance_usdt  || 0),
        pkr:       ((user.balance_usdt || 0) * pkrRate).toFixed(2),
        frozen:    parseFloat(user.frozen_usdt   || 0),
        points:    user.points    || 0,
        vip_level: user.vip_level || 0
      }
    });
  } catch (err) {
    console.error('Poll error:', err);
    res.status(500).json({ success: false, message: 'Poll failed' });
  }
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications' });
  }
});

// ── POST /api/notifications/:id/read ─────────────────────────────────────────
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notification' });
  }
});

// ── GET /api/notifications/announcements ──────────────────────────────────────
router.get('/announcements', authenticate, async (req, res) => {
  try {
    const userRes  = await pool.query('SELECT vip_level FROM users WHERE id=$1', [req.user.id]);
    const vipLevel = userRes.rows[0]?.vip_level || 0;

    const r = await pool.query(
      `SELECT id, title, content, type, created_at
       FROM announcements
       WHERE is_active=true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (target_vip_level = -1 OR target_vip_level <= $1)
       ORDER BY created_at DESC LIMIT 10`,
      [vipLevel]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

module.exports = router;
