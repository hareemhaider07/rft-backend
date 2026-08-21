const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get available tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;
    const dailyLimit = parseInt(process.env.DAILY_TASK_LIMIT) || 10;

    // Get today's completed tasks
    const today = new Date().toISOString().split('T')[0];
    const completedResult = await pool.query(
      `SELECT task_id FROM user_tasks 
       WHERE user_id = $1 AND status = 'completed' AND DATE(created_at) = $2`,
      [userId, today]
    );

    const completedTaskIds = completedResult.rows.map(row => row.task_id);

    // Get active tasks
    const tasksResult = await pool.query(
      `SELECT id, title, description, thumbnail_url, video_url, task_type, 
              reward_usdt, duration_seconds, order_index
       FROM tasks 
       WHERE is_active = true 
       ORDER BY order_index ASC, created_at ASC`
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
          remaining_today: Math.max(0, dailyLimit - completedTaskIds.length),
          daily_limit: dailyLimit
        }
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

// Start task (create session)
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;

    // Check if task exists
    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND is_active = true',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const task = taskResult.rows[0];

    // Check if already completed today
    const today = new Date().toISOString().split('T')[0];
    const completedResult = await pool.query(
      `SELECT id FROM user_tasks 
       WHERE user_id = $1 AND task_id = $2 AND status = 'completed' AND DATE(created_at) = $3`,
      [userId, taskId, today]
    );

    if (completedResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed today'
      });
    }

    // Check daily limit
    const dailyLimit = parseInt(process.env.DAILY_TASK_LIMIT) || 10;
    const todayCompletedResult = await pool.query(
      `SELECT COUNT(*) as count FROM user_tasks 
       WHERE user_id = $1 AND status = 'completed' AND DATE(created_at) = $2`,
      [userId, today]
    );

    const completedCount = parseInt(todayCompletedResult.rows[0].count);
    if (completedCount >= dailyLimit) {
      return res.status(400).json({
        success: false,
        message: 'Daily task limit reached'
      });
    }

    // Create or update user task entry
    const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(7);

    await pool.query(
      `INSERT INTO user_tasks (user_id, task_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, task_id) 
       DO UPDATE SET status = 'pending'
       RETURNING id`,
      [userId, taskId]
    );

    res.json({
      success: true,
      data: {
        task_id: task.id,
        session_id: sessionId,
        video_url: task.video_url,
        duration_seconds: task.duration_seconds
      }
    });
  } catch (error) {
    console.error('Start task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start task'
    });
  }
});

// Complete task
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { session_id, watch_duration_seconds } = req.body;

    // Get task details
    const taskResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND is_active = true',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const task = taskResult.rows[0];

    // Check if already completed
    const completedResult = await pool.query(
      `SELECT id FROM user_tasks 
       WHERE user_id = $1 AND task_id = $2 AND status = 'completed'`,
      [userId, taskId]
    );

    if (completedResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed'
      });
    }

    // Verify watch duration (optional - can be skipped for MVP)
    if (task.duration_seconds && watch_duration_seconds < task.duration_seconds * 0.8) {
      return res.status(400).json({
        success: false,
        message: 'Video not watched long enough'
      });
    }

    // Update user task as completed
    await pool.query(
      `UPDATE user_tasks 
       SET status = 'completed', 
           completed_at = NOW(),
           reward_usdt = $1
       WHERE user_id = $2 AND task_id = $3`,
      [task.reward_usdt, userId, taskId]
    );

    // Update user balance
    await pool.query(
      `UPDATE users 
       SET balance_usdt = balance_usdt + $1,
           points = points + 10
       WHERE id = $2`,
      [task.reward_usdt, userId]
    );

    // Get new balance
    const balanceResult = await pool.query(
      'SELECT balance_usdt FROM users WHERE id = $1',
      [userId]
    );

    const pkrRate = parseFloat(process.env.PKR_RATE) || 280;

    res.json({
      success: true,
      message: 'Task completed successfully',
      data: {
        reward_usdt: task.reward_usdt,
        reward_pkr: (task.reward_usdt * pkrRate).toFixed(2),
        new_balance_usdt: balanceResult.rows[0].balance_usdt
      }
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete task'
    });
  }
});

module.exports = router;
