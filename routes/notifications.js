const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications  — user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const page    = parseInt(req.query.page)  || 1;
    const limit   = parseInt(req.query.limit) || 20;
    const offset  = (page - 1) * limit;

    const r = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications WHERE user_id=$1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const cnt  = await pool.query(`SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=$1`, [userId]);
    const unread = await pool.query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=$1 AND is_read=false`, [userId]
    );

    res.json({
      success: true,
      data: {
        notifications: r.rows,
        unread_count: parseInt(unread.rows[0].cnt),
        pagination: { page, limit, total: parseInt(cnt.rows[0].cnt), total_pages: Math.ceil(cnt.rows[0].cnt / limit) }
      }
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/read-all  — mark all as read
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications' });
  }
});

// POST /api/notifications/:id/read  — mark one as read
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

// GET /api/notifications/announcements  — active public announcements
router.get('/announcements', authenticate, async (req, res) => {
  try {
    const userRes = await pool.query('SELECT vip_level FROM users WHERE id=$1', [req.user.id]);
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
