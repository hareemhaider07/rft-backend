const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, residence, occupation, whatsapp, age, gender, 
              kyc_status, balance_usdt, points, referral_code, referred_by, 
              is_active, is_verified, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update user profile
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
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, residence, occupation, whatsapp, age, gender } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           residence = COALESCE($2, residence),
           occupation = COALESCE($3, occupation),
           whatsapp = COALESCE($4, whatsapp),
           age = COALESCE($5, age),
           gender = COALESCE($6, gender),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, email, phone, residence, occupation, whatsapp, age, gender`,
      [name, residence, occupation, whatsapp, age, gender, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get user stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get task completion stats
    const today = new Date().toISOString().split('T')[0];
    const taskStats = await pool.query(
      `SELECT 
         COUNT(*) as total_completed,
         COUNT(*) FILTER (WHERE DATE(created_at) = $1) as completed_today
       FROM user_tasks 
       WHERE user_id = $2 AND status = 'completed'`,
      [today, userId]
    );

    // Get total earned
    const earnedResult = await pool.query(
      `SELECT COALESCE(SUM(reward_usdt), 0) as total_earned
       FROM user_tasks 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );

    // Get today's earned
    const todayEarnedResult = await pool.query(
      `SELECT COALESCE(SUM(reward_usdt), 0) as today_earned
       FROM user_tasks 
       WHERE user_id = $1 AND status = 'completed' AND DATE(created_at) = $2`,
      [userId, today]
    );

    // Get referral count
    const referralResult = await pool.query(
      `SELECT COUNT(*) as referral_count
       FROM users 
       WHERE referred_by = $1`,
      [req.user.referral_code]
    );

    const stats = taskStats.rows[0];
    const earned = earnedResult.rows[0];
    const todayEarned = todayEarnedResult.rows[0];
    const referrals = referralResult.rows[0];

    const dailyLimit = parseInt(process.env.DAILY_TASK_LIMIT) || 10;
    const taskReward = parseFloat(process.env.TASK_REWARD_USDT) || 0.1;

    res.json({
      success: true,
      data: {
        total_tasks_completed: parseInt(stats.total_completed),
        tasks_today: parseInt(stats.completed_today),
        tasks_remaining: Math.max(0, dailyLimit - parseInt(stats.completed_today)),
        daily_limit: dailyLimit,
        total_earned_usdt: parseFloat(earned.total_earned),
        today_earned_usdt: parseFloat(todayEarned.today_earned),
        referral_count: parseInt(referrals.referral_count),
        referral_bonus_usdt: parseInt(referrals.referral_count) * 0.5 // 0.50 USDT per referral
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats'
    });
  }
});

module.exports = router;
