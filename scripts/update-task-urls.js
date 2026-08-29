/**
 * Update task URLs with real YouTube/TikTok trailers
 * Run: node scripts/update-task-urls.js
 */
require('dotenv').config();
const pool = require('../config/database');

const TASKS = [
  {
    title:         'Watch Video Task 1',
    video_url:     'https://www.youtube.com/watch?v=irVNGjRFZGk',
    thumbnail_url: `https://img.youtube.com/vi/irVNGjRFZGk/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch the Avengers: Doomsday official trailer'
  },
  {
    title:         'Watch Video Task 2',
    video_url:     'https://www.youtube.com/watch?v=f_bKjZeJBBI',
    thumbnail_url: `https://img.youtube.com/vi/f_bKjZeJBBI/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch The Odyssey official trailer by Christopher Nolan'
  },
  {
    title:         'Watch Video Task 3',
    video_url:     'https://www.youtube.com/watch?v=pEWqOAcYgpQ',
    thumbnail_url: `https://img.youtube.com/vi/pEWqOAcYgpQ/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch The Legend of Maula Jatt official trailer'
  },
  {
    title:         'Complete Survey',
    video_url:     'https://www.youtube.com/watch?v=Uu2QK9Z9X5E',
    thumbnail_url: `https://img.youtube.com/vi/Uu2QK9Z9X5E/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch King movie title reveal — Shah Rukh Khan'
  },
  {
    title:         'Share App',
    video_url:     'https://www.youtube.com/watch?v=lNaSdnz2I8g',
    thumbnail_url: `https://img.youtube.com/vi/lNaSdnz2I8g/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch Ramayana official trailer — Ranbir Kapoor'
  },
  {
    title:         'Like Instagram Post',
    video_url:     'https://www.youtube.com/watch?v=KozPWehBjvs',
    thumbnail_url: `https://img.youtube.com/vi/KozPWehBjvs/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch Aag Lagay Basti Mein — Fahad Mustafa & Mahira Khan'
  },
  {
    title:         'Share Facebook Post',
    video_url:     'https://www.youtube.com/watch?v=5vMWZhHPlaw',
    thumbnail_url: `https://img.youtube.com/vi/5vMWZhHPlaw/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch Mirzapur The Movie official trailer'
  },
  {
    title:         'Subscribe on YouTube',
    video_url:     'https://www.youtube.com/watch?v=zhApeaHMvfs',
    thumbnail_url: `https://img.youtube.com/vi/zhApeaHMvfs/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch Jumanji: Open World official trailer'
  },
  {
    title:         'Watch TikTok Video',
    video_url:     'https://www.youtube.com/watch?v=62bIsvRcPv0',
    thumbnail_url: `https://img.youtube.com/vi/62bIsvRcPv0/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch Spider-Man: Brand New Day new trailer'
  },
  {
    title:         'Watch TikTok 2',
    video_url:     'https://www.youtube.com/watch?v=48CtX6OgU3s',
    thumbnail_url: `https://img.youtube.com/vi/48CtX6OgU3s/hqdefault.jpg`,
    task_type:     'youtube',
    description:   'Watch The Housemaid official trailer'
  }
];

async function run() {
  try {
    // Get all existing tasks
    const existing = await pool.query('SELECT id, title FROM tasks ORDER BY order_index ASC');
    console.log(`Found ${existing.rows.length} tasks in DB`);

    for (let i = 0; i < existing.rows.length; i++) {
      const task    = existing.rows[i];
      const newData = TASKS[i % TASKS.length];

      await pool.query(
        `UPDATE tasks SET
           title         = $1,
           video_url     = $2,
           thumbnail_url = $3,
           task_type     = $4,
           description   = $5
         WHERE id = $6`,
        [newData.title, newData.video_url, newData.thumbnail_url, newData.task_type, newData.description, task.id]
      );
      console.log(`✅ Updated: "${task.title}" → "${newData.title}" (${newData.video_url})`);
    }

    // Insert any missing tasks if DB has fewer than 10
    if (existing.rows.length < 10) {
      for (let i = existing.rows.length; i < TASKS.length; i++) {
        const t = TASKS[i];
        await pool.query(
          `INSERT INTO tasks (title, description, video_url, thumbnail_url, task_type, reward_usdt, duration_seconds, is_active, order_index)
           VALUES ($1, $2, $3, $4, $5, 0.10, 30, true, $6)`,
          [t.title, t.description, t.video_url, t.thumbnail_url, t.task_type, i + 1]
        );
        console.log(`✅ Inserted new task: "${t.title}"`);
      }
    }

    console.log('\n✅ All task URLs updated successfully.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
