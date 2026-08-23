const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/referral/info  — user's referral link + summary stats
router.get('/info', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userRes = await pool.query(
      'SELECT referral_code, vip_level FROM users WHERE id = $1', [userId]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { referral_code, vip_level } = userRes.rows[0];

    // VIP commission rates
    const vipRes = await pool.query(
      'SELECT level1_commission_rate, level2_commission_rate, level3_commission_rate FROM vip_levels WHERE level = $1',
      [vip_level || 0]
    );
    const rates = vipRes.rows[0] || { level1_commission_rate: 0.10, level2_commission_rate: 0.03, level3_commission_rate: 0.01 };

    // team counts per level
    const l1Res = await pool.query(
      `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = $1 AND referral_level = 1`, [userId]
    );
    const l2Res = await pool.query(
      `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = $1 AND referral_level = 2`, [userId]
    );
    const l3Res = await pool.query(
      `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = $1 AND referral_level = 3`, [userId]
    );

    // total commissions earned
    const commRes = await pool.query(
      `SELECT COALESCE(SUM(amount_usdt), 0) AS total
       FROM transactions WHERE user_id = $1 AND type = 'referral_commission'`,
      [userId]
    );
    const totalComm = parseFloat(commRes.rows[0].total);

    const baseUrl = process.env.FRONTEND_URL || 'https://rft-frontend.netlify.app';

    res.json({
      success: true,
      data: {
        referral_code,
        referral_link: `${baseUrl}/?ref=${referral_code}`,
        commission_rates: {
          level1: `${(parseFloat(rates.level1_commission_rate) * 100).toFixed(0)}%`,
          level2: `${(parseFloat(rates.level2_commission_rate) * 100).toFixed(0)}%`,
          level3: `${(parseFloat(rates.level3_commission_rate) * 100).toFixed(0)}%`
        },
        team_count: {
          level1: parseInt(l1Res.rows[0].cnt),
          level2: parseInt(l2Res.rows[0].cnt),
          level3: parseInt(l3Res.rows[0].cnt),
          total:  parseInt(l1Res.rows[0].cnt) + parseInt(l2Res.rows[0].cnt) + parseInt(l3Res.rows[0].cnt)
        },
        total_commission_usdt: totalComm,
        total_commission_pkr: (totalComm * (parseFloat(process.env.PKR_RATE) || 280)).toFixed(2)
      }
    });
  } catch (err) {
    console.error('Referral info error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch referral info' });
  }
});

// GET /api/referral/team  — paginated list of direct + indirect referrals
router.get('/team', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const level  = parseInt(req.query.level) || 1;   // 1 | 2 | 3
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.vip_level, u.created_at,
              r.total_commission_usdt, r.created_at AS joined_via_referral_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1 AND r.referral_level = $2
       ORDER BY r.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, level, limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_id = $1 AND referral_level = $2`,
      [userId, level]
    );
    const total = parseInt(countRes.rows[0].cnt);

    // mask phone for privacy
    const members = result.rows.map(m => ({
      ...m,
      phone: m.phone ? m.phone.slice(0, 4) + '****' + m.phone.slice(-2) : '****'
    }));

    res.json({
      success: true,
      data: {
        members,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    console.error('Referral team error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch team' });
  }
});

module.exports = router;
