/**
 * RFT Entertainment — One-time DB setup script
 * Runs spin schema + updates task URLs
 *
 * Run on Railway console:
 *   node scripts/setup-db.js
 */
require('dotenv').config();
const pool = require('../config/database');

async function run() {
  console.log('=== RFT Entertainment DB Setup ===\n');

  // ── 1. Create spin tables ──────────────────────────────────────────────────
  console.log('1. Creating spin_prizes + spin_history tables...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spin_prizes (
        id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
        name          VARCHAR(100)  NOT NULL,
        prize_type    VARCHAR(20)   NOT NULL,
        prize_value   DECIMAL(10,4) DEFAULT 0,
        color         VARCHAR(20)   NOT NULL,
        probability   DECIMAL(5,4)  NOT NULL,
        min_vip_level INTEGER       DEFAULT 0,
        is_active     BOOLEAN       DEFAULT true,
        display_order INTEGER       DEFAULT 0,
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spin_history (
        id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID          REFERENCES users(id) ON DELETE CASCADE,
        prize_id    UUID          REFERENCES spin_prizes(id),
        prize_name  VARCHAR(100),
        prize_type  VARCHAR(20),
        prize_value DECIMAL(10,4) DEFAULT 0,
        spin_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_one_per_day ON spin_history(user_id, spin_date);
      CREATE INDEX IF NOT EXISTS idx_spin_history_user ON spin_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_spin_history_date ON spin_history(spin_date);
      CREATE INDEX IF NOT EXISTS idx_spin_prizes_vip   ON spin_prizes(min_vip_level);
    `);
    console.log('   ✅ Spin tables created');

    // Seed VIP 0 prizes
    await pool.query(`
      INSERT INTO spin_prizes (name, prize_type, prize_value, color, probability, min_vip_level, display_order) VALUES
        ('Rs. 28',    'usdt',   0.10, '#2A9D8F', 0.2000, 0, 1),
        ('Rs. 14',    'usdt',   0.05, '#e8c76a', 0.2000, 0, 2),
        ('50 Points', 'points', 50,   '#1D3557', 0.1500, 0, 3),
        ('Try Again', 'empty',  0,    '#555555', 0.1300, 0, 4),
        ('20 Points', 'points', 20,   '#2196F3', 0.1500, 0, 5),
        ('Rs. 6',     'usdt',   0.02, '#6A0572', 0.0900, 0, 6),
        ('100 Points','points', 100,  '#06b6d4', 0.0500, 0, 7),
        ('Rs. 140',   'usdt',   0.50, '#E63946', 0.0300, 0, 8)
      ON CONFLICT DO NOTHING;
    `);
    console.log('   ✅ Spin prizes seeded');
  } catch (e) {
    console.error('   ❌ Spin tables error:', e.message);
  }

  // ── 2. Update task URLs ────────────────────────────────────────────────────
  console.log('\n2. Updating task URLs with real trailers...');
  const TASK_UPDATES = [
    { old_title: 'Watch Video Task 1',  new_title: 'Watch Avengers: Doomsday Trailer',    video_url: 'https://www.youtube.com/watch?v=irVNGjRFZGk', thumbnail_url: 'https://img.youtube.com/vi/irVNGjRFZGk/hqdefault.jpg' },
    { old_title: 'Watch Video Task 2',  new_title: 'Watch The Odyssey Trailer',            video_url: 'https://www.youtube.com/watch?v=f_bKjZeJBBI', thumbnail_url: 'https://img.youtube.com/vi/f_bKjZeJBBI/hqdefault.jpg' },
    { old_title: 'Watch Video Task 3',  new_title: 'Watch Maula Jatt Trailer',             video_url: 'https://www.youtube.com/watch?v=pEWqOAcYgpQ', thumbnail_url: 'https://img.youtube.com/vi/pEWqOAcYgpQ/hqdefault.jpg' },
    { old_title: 'Complete Survey',     new_title: 'Watch King — Shah Rukh Khan Trailer',  video_url: 'https://www.youtube.com/watch?v=Uu2QK9Z9X5E', thumbnail_url: 'https://img.youtube.com/vi/Uu2QK9Z9X5E/hqdefault.jpg' },
    { old_title: 'Share App',           new_title: 'Watch Ramayana Trailer',               video_url: 'https://www.youtube.com/watch?v=lNaSdnz2I8g', thumbnail_url: 'https://img.youtube.com/vi/lNaSdnz2I8g/hqdefault.jpg' },
    { old_title: 'Like Instagram Post', new_title: 'Watch Mirzapur The Movie Trailer',     video_url: 'https://www.youtube.com/watch?v=5vMWZhHPlaw', thumbnail_url: 'https://img.youtube.com/vi/5vMWZhHPlaw/hqdefault.jpg' },
    { old_title: 'Share Facebook Post', new_title: 'Watch Spider-Man: Brand New Day',      video_url: 'https://www.youtube.com/watch?v=62bIsvRcPv0', thumbnail_url: 'https://img.youtube.com/vi/62bIsvRcPv0/hqdefault.jpg' },
    { old_title: 'Subscribe on YouTube',new_title: 'Watch Jumanji: Open World Trailer',    video_url: 'https://www.youtube.com/watch?v=zhApeaHMvfs', thumbnail_url: 'https://img.youtube.com/vi/zhApeaHMvfs/hqdefault.jpg' },
    { old_title: 'Watch TikTok Video',  new_title: 'Watch Dhamaal 4 Trailer',              video_url: 'https://www.youtube.com/watch?v=IG-eByZdz6Y', thumbnail_url: 'https://img.youtube.com/vi/IG-eByZdz6Y/hqdefault.jpg' },
    { old_title: 'Watch TikTok 2',      new_title: 'Watch The Housemaid Trailer',          video_url: 'https://www.youtube.com/watch?v=48CtX6OgU3s', thumbnail_url: 'https://img.youtube.com/vi/48CtX6OgU3s/hqdefault.jpg' },
  ];

  for (const t of TASK_UPDATES) {
    try {
      const r = await pool.query(
        `UPDATE tasks SET
           title         = $1,
           video_url     = $2,
           thumbnail_url = $3,
           task_type     = 'youtube',
           updated_at    = NOW()
         WHERE title = $4
         RETURNING title`,
        [t.new_title, t.video_url, t.thumbnail_url, t.old_title]
      );
      if (r.rowCount > 0) {
        console.log(`   ✅ "${t.old_title}" → "${t.new_title}"`);
      } else {
        console.log(`   ⚠️  Not found: "${t.old_title}" (may already be updated)`);
      }
    } catch (e) {
      console.error(`   ❌ Error updating "${t.old_title}":`, e.message);
    }
  }

  // ── 3. Update payment methods with real numbers ────────────────────────────
  console.log('\n3. Checking payment methods...');
  try {
    const r = await pool.query(`SELECT identifier, account_number FROM payment_methods WHERE identifier IN ('jazzcash','easypaisa')`);
    if (r.rows.length === 0) {
      // Insert them
      await pool.query(`
        INSERT INTO payment_methods (name, identifier, account_name, account_number, instructions, icon, is_active, display_order)
        VALUES
          ('JazzCash',  'jazzcash',  'RFT Entertainment', '03001234567', 'Open JazzCash → Send Money → enter this number → upload screenshot', '📱', true, 1),
          ('Easypaisa', 'easypaisa', 'RFT Entertainment', '03001234567', 'Open Easypaisa → Send Money → enter this number → upload screenshot', '💚', true, 2)
        ON CONFLICT (identifier) DO UPDATE SET is_active = true;
      `);
      console.log('   ✅ Payment methods inserted');
    } else {
      console.log('   ✅ Payment methods exist:', r.rows.map(r => `${r.identifier}: ${r.account_number}`).join(', '));
    }
  } catch (e) {
    console.error('   ❌ Payment methods error:', e.message);
  }

  // ── 4. Verify VIP levels seeded ───────────────────────────────────────────
  console.log('\n4. Checking VIP levels...');
  try {
    const r = await pool.query('SELECT COUNT(*) AS cnt FROM vip_levels');
    const cnt = parseInt(r.rows[0].cnt);
    if (cnt === 0) {
      await pool.query(`
        INSERT INTO vip_levels (level, name, required_deposit_usdt, daily_task_limit, task_reward_usdt, min_withdraw_usdt, color)
        VALUES
          (0, 'Starter',  0,    10, 0.10, 10,  '#888888'),
          (1, 'Bronze',   50,   15, 0.12, 8,   '#CD7F32'),
          (2, 'Silver',   200,  20, 0.15, 7,   '#C0C0C0'),
          (3, 'Gold',     500,  25, 0.18, 5,   '#FFD700'),
          (4, 'Platinum', 1000, 30, 0.22, 5,   '#E5E4E2'),
          (5, 'Diamond',  5000, 40, 0.30, 3,   '#B9F2FF')
        ON CONFLICT (level) DO NOTHING;
      `);
      console.log('   ✅ VIP levels seeded');
    } else {
      console.log(`   ✅ VIP levels already exist (${cnt} levels)`);
    }
  } catch (e) {
    console.error('   ❌ VIP levels error:', e.message);
  }

  console.log('\n=== Setup complete ===');
  await pool.end();
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
