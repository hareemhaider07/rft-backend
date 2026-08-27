-- ============================================================
-- RFT Entertainment — New Tables Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Saved payout methods
CREATE TABLE IF NOT EXISTS saved_payout_methods (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID         REFERENCES users(id) ON DELETE CASCADE,
  method_name    VARCHAR(50)  NOT NULL,
  account_name   VARCHAR(255) NOT NULL,
  account_number VARCHAR(255) NOT NULL,
  is_default     BOOLEAN      DEFAULT false,
  is_active      BOOLEAN      DEFAULT true,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_saved_methods_user ON saved_payout_methods(user_id);

-- Login popups
CREATE TABLE IF NOT EXISTS login_popups (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  content     TEXT         NOT NULL,
  image_url   VARCHAR(500),
  button_text VARCHAR(100) DEFAULT 'Got it',
  button_url  VARCHAR(500),
  is_active   BOOLEAN      DEFAULT true,
  show_once   BOOLEAN      DEFAULT false,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP
);

-- Seed a welcome popup
INSERT INTO login_popups (title, content, button_text, is_active)
VALUES (
  '🎉 Welcome to RFT Entertainment!',
  'Complete daily tasks, refer friends, and spin the lucky wheel to earn PKR rewards every day. Upgrade your VIP to unlock more earning opportunities!',
  'Start Earning!',
  true
)
ON CONFLICT DO NOTHING;

SELECT 'saved_payout_methods' AS tbl, COUNT(*) FROM saved_payout_methods
UNION ALL SELECT 'login_popups', COUNT(*) FROM login_popups;
