-- ============================================================
-- RFT Entertainment — Lucky Draw / Spin Wheel Schema
-- Run in Supabase SQL Editor → New Query
-- ============================================================

-- SPIN PRIZES TABLE
-- Each prize has a min_vip_level so higher VIPs get better prizes
CREATE TABLE IF NOT EXISTS spin_prizes (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100)  NOT NULL,
  prize_type    VARCHAR(20)   NOT NULL,  -- 'usdt' | 'points' | 'empty'
  prize_value   DECIMAL(10,4) DEFAULT 0,
  color         VARCHAR(20)   NOT NULL,  -- wheel segment color
  probability   DECIMAL(5,4)  NOT NULL,  -- 0.0000 to 1.0000, must sum to 1 per vip group
  min_vip_level INTEGER       DEFAULT 0,
  is_active     BOOLEAN       DEFAULT true,
  display_order INTEGER       DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- SPIN HISTORY TABLE — one spin per user per day (reset daily)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_one_per_day
  ON spin_history(user_id, spin_date);

CREATE INDEX IF NOT EXISTS idx_spin_history_user ON spin_history(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_history_date ON spin_history(spin_date);
CREATE INDEX IF NOT EXISTS idx_spin_prizes_vip   ON spin_prizes(min_vip_level);

-- ── SEED PRIZES ──────────────────────────────────────────────
-- VIP 0 prizes (8 segments, probabilities sum to 1.0)
INSERT INTO spin_prizes (name, prize_type, prize_value, color, probability, min_vip_level, display_order) VALUES
  ('0.10 USDT',   'usdt',   0.10, '#d4a843', 0.1500, 0, 1),
  ('0.05 USDT',   'usdt',   0.05, '#e8c76a', 0.2000, 0, 2),
  ('50 Points',   'points', 50,   '#22c55e', 0.2000, 0, 3),
  ('Try Again',   'empty',  0,    '#444455', 0.1500, 0, 4),
  ('20 Points',   'points', 20,   '#3b82f6', 0.1500, 0, 5),
  ('0.02 USDT',   'usdt',   0.02, '#a855f7', 0.0500, 0, 6),
  ('100 Points',  'points', 100,  '#06b6d4', 0.0300, 0, 7),
  ('0.50 USDT',   'usdt',   0.50, '#ef4444', 0.0300, 0, 8)
ON CONFLICT DO NOTHING;

-- VIP 1+ prizes (better rewards)
INSERT INTO spin_prizes (name, prize_type, prize_value, color, probability, min_vip_level, display_order) VALUES
  ('0.20 USDT',   'usdt',   0.20, '#d4a843', 0.1500, 1, 1),
  ('0.10 USDT',   'usdt',   0.10, '#e8c76a', 0.2000, 1, 2),
  ('100 Points',  'points', 100,  '#22c55e', 0.2000, 1, 3),
  ('Try Again',   'empty',  0,    '#444455', 0.1000, 1, 4),
  ('50 Points',   'points', 50,   '#3b82f6', 0.1500, 1, 5),
  ('0.05 USDT',   'usdt',   0.05, '#a855f7', 0.1000, 1, 6),
  ('200 Points',  'points', 200,  '#06b6d4', 0.0500, 1, 7),
  ('1.00 USDT',   'usdt',   1.00, '#ef4444', 0.0500, 1, 8)
ON CONFLICT DO NOTHING;

-- VIP 3+ prizes (premium)
INSERT INTO spin_prizes (name, prize_type, prize_value, color, probability, min_vip_level, display_order) VALUES
  ('0.50 USDT',   'usdt',   0.50, '#d4a843', 0.1500, 3, 1),
  ('0.25 USDT',   'usdt',   0.25, '#e8c76a', 0.2000, 3, 2),
  ('200 Points',  'points', 200,  '#22c55e', 0.1500, 3, 3),
  ('Try Again',   'empty',  0,    '#444455', 0.0500, 3, 4),
  ('100 Points',  'points', 100,  '#3b82f6', 0.1500, 3, 5),
  ('0.10 USDT',   'usdt',   0.10, '#a855f7', 0.1500, 3, 6),
  ('500 Points',  'points', 500,  '#06b6d4', 0.0800, 3, 7),
  ('2.00 USDT',   'usdt',   2.00, '#ef4444', 0.0700, 3, 8)
ON CONFLICT DO NOTHING;

SELECT 'spin_prizes' AS tbl, COUNT(*) AS rows FROM spin_prizes
UNION ALL
SELECT 'spin_history', COUNT(*) FROM spin_history;
