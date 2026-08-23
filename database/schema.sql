-- ============================================================
-- RFT Entertainment — Complete Database Schema v2.1
-- Run this in Supabase SQL Editor → New Query → Run
-- Safe to run multiple times (idempotent)
-- ============================================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 1: CREATE ALL TABLES
-- ============================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255)  UNIQUE NOT NULL,
  phone           VARCHAR(20)   UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  name            VARCHAR(255),
  residence       VARCHAR(255),
  occupation      VARCHAR(255),
  whatsapp        VARCHAR(20),
  age             INTEGER,
  gender          VARCHAR(10),
  provider        VARCHAR(50)   DEFAULT 'email',
  provider_id     VARCHAR(255),
  kyc_status      VARCHAR(20)   DEFAULT 'not_started',
  kyc_data        JSONB,
  balance_usdt    DECIMAL(10,2) DEFAULT 0.00,
  frozen_usdt     DECIMAL(10,2) DEFAULT 0.00,
  points          INTEGER       DEFAULT 0,
  vip_level       INTEGER       DEFAULT 0,
  referral_code   VARCHAR(20)   UNIQUE,
  referred_by     VARCHAR(20),
  is_active       BOOLEAN       DEFAULT true,
  is_verified     BOOLEAN       DEFAULT false,
  last_login_at   TIMESTAMP,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- VIP LEVELS (defined BEFORE the INSERT below)
CREATE TABLE IF NOT EXISTS vip_levels (
  id                      SERIAL        PRIMARY KEY,
  level                   INTEGER       UNIQUE NOT NULL,
  name                    VARCHAR(50)   NOT NULL,
  required_deposit_usdt   DECIMAL(10,2) DEFAULT 0.00,
  daily_task_limit        INTEGER       DEFAULT 10,
  task_reward_usdt        DECIMAL(10,4) DEFAULT 0.10,
  referral_bonus_usdt     DECIMAL(10,2) DEFAULT 0.50,
  level1_commission_rate  DECIMAL(5,4)  DEFAULT 0.10,
  level2_commission_rate  DECIMAL(5,4)  DEFAULT 0.03,
  level3_commission_rate  DECIMAL(5,4)  DEFAULT 0.01,
  min_withdraw_usdt       DECIMAL(10,2) DEFAULT 10.00,
  color                   VARCHAR(20)   DEFAULT '#888888',
  badge_icon              VARCHAR(100)  DEFAULT 'ph-star',
  is_active               BOOLEAN       DEFAULT true,
  created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(255)  NOT NULL,
  description      TEXT,
  thumbnail_url    VARCHAR(500),
  video_url        VARCHAR(500),
  task_type        VARCHAR(50)   NOT NULL DEFAULT 'youtube',
  reward_usdt      DECIMAL(10,4) NOT NULL DEFAULT 0.10,
  duration_seconds INTEGER       DEFAULT 30,
  min_vip_level    INTEGER       DEFAULT 0,
  is_active        BOOLEAN       DEFAULT true,
  order_index      INTEGER       DEFAULT 0,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- DAILY TASK TRACKING (one row per user per task per day — resets each day)
CREATE TABLE IF NOT EXISTS daily_task_tracking (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID          REFERENCES users(id) ON DELETE CASCADE,
  task_id                 UUID          REFERENCES tasks(id) ON DELETE CASCADE,
  task_date               DATE          NOT NULL DEFAULT CURRENT_DATE,
  status                  VARCHAR(20)   DEFAULT 'pending',
  watch_duration_seconds  INTEGER       DEFAULT 0,
  reward_usdt             DECIMAL(10,4) DEFAULT 0,
  completed_at            TIMESTAMP,
  created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id, task_date)
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(30)   NOT NULL,
  amount_usdt       DECIMAL(10,2) NOT NULL,
  amount_pkr        DECIMAL(12,2),
  payment_method    VARCHAR(50),
  payment_reference VARCHAR(100),
  screenshot_url    VARCHAR(500),
  status            VARCHAR(20)   DEFAULT 'pending',
  notes             TEXT,
  admin_note        TEXT,
  processed_by      UUID,
  processed_at      TIMESTAMP,
  created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id           UUID          REFERENCES users(id) ON DELETE CASCADE,
  referred_id           UUID          REFERENCES users(id) ON DELETE CASCADE,
  referral_level        INTEGER       NOT NULL DEFAULT 1,
  commission_rate       DECIMAL(5,4)  DEFAULT 0.10,
  total_commission_usdt DECIMAL(10,2) DEFAULT 0.00,
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_id, referred_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255)  NOT NULL,
  message     TEXT          NOT NULL,
  type        VARCHAR(30)   DEFAULT 'info',
  is_read     BOOLEAN       DEFAULT false,
  action_url  VARCHAR(255),
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(255)  NOT NULL,
  content          TEXT          NOT NULL,
  type             VARCHAR(30)   DEFAULT 'info',
  is_active        BOOLEAN       DEFAULT true,
  target_vip_level INTEGER       DEFAULT -1,
  created_by       UUID,
  created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP
);

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS payment_methods (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100)  NOT NULL,
  identifier    VARCHAR(50)   UNIQUE NOT NULL,
  account_name  VARCHAR(255),
  account_number VARCHAR(255),
  qr_code_url   VARCHAR(500),
  instructions  TEXT,
  is_active     BOOLEAN       DEFAULT true,
  display_order INTEGER       DEFAULT 0,
  icon          VARCHAR(10)   DEFAULT '💳',
  color         VARCHAR(20)   DEFAULT '#333333',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ADMIN USERS
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(100)  UNIQUE NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   DEFAULT 'admin',
  is_active     BOOLEAN       DEFAULT true,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ADMIN REFRESH TOKENS
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID          REFERENCES admin_users(id) ON DELETE CASCADE,
  token       VARCHAR(500)  UNIQUE NOT NULL,
  expires_at  TIMESTAMP     NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  revoked_at  TIMESTAMP
);

-- KYC DOCUMENTS
CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID          REFERENCES users(id) ON DELETE CASCADE,
  document_type       VARCHAR(50)   NOT NULL,
  issuing_country     VARCHAR(3)    NOT NULL,
  document_number     VARCHAR(100)  NOT NULL,
  front_image_url     VARCHAR(500),
  back_image_url      VARCHAR(500),
  selfie_image_url    VARCHAR(500),
  verification_status VARCHAR(20)   DEFAULT 'pending',
  rejection_reason    TEXT,
  reviewed_by         UUID,
  submitted_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  verified_at         TIMESTAMP,
  created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(500)  UNIQUE NOT NULL,
  expires_at  TIMESTAMP     NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  revoked_at  TIMESTAMP
);

-- PASSWORD RESETS
CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  otp         VARCHAR(6)  NOT NULL,
  expires_at  TIMESTAMP   NOT NULL,
  used        BOOLEAN     DEFAULT false,
  created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STEP 2: ADD COLUMNS TO EXISTING TABLES (safe ALTER TABLE)
-- ============================================================

DO $$
BEGIN
  -- users extra columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='frozen_usdt') THEN
    ALTER TABLE users ADD COLUMN frozen_usdt DECIMAL(10,2) DEFAULT 0.00; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vip_level') THEN
    ALTER TABLE users ADD COLUMN vip_level INTEGER DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code') THEN
    ALTER TABLE users ADD COLUMN referral_code VARCHAR(20); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referred_by') THEN
    ALTER TABLE users ADD COLUMN referred_by VARCHAR(20); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_status') THEN
    ALTER TABLE users ADD COLUMN kyc_status VARCHAR(20) DEFAULT 'not_started'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_data') THEN
    ALTER TABLE users ADD COLUMN kyc_data JSONB; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='balance_usdt') THEN
    ALTER TABLE users ADD COLUMN balance_usdt DECIMAL(10,2) DEFAULT 0.00; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='points') THEN
    ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0; END IF;
  -- tasks extra column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='min_vip_level') THEN
    ALTER TABLE tasks ADD COLUMN min_vip_level INTEGER DEFAULT 0; END IF;
  -- transactions extra columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='admin_note') THEN
    ALTER TABLE transactions ADD COLUMN admin_note TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='processed_by') THEN
    ALTER TABLE transactions ADD COLUMN processed_by UUID; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='processed_at') THEN
    ALTER TABLE transactions ADD COLUMN processed_at TIMESTAMP; END IF;
  -- kyc_documents extra column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_by') THEN
    ALTER TABLE kyc_documents ADD COLUMN reviewed_by UUID; END IF;
END $$;

-- ============================================================
-- STEP 3: CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone          ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referral_code  ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by    ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status     ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_vip_level      ON users(vip_level);

CREATE INDEX IF NOT EXISTS idx_tasks_type           ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_active         ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_order          ON tasks(order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_vip            ON tasks(min_vip_level);

CREATE INDEX IF NOT EXISTS idx_dtt_user             ON daily_task_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_dtt_task             ON daily_task_tracking(task_id);
CREATE INDEX IF NOT EXISTS idx_dtt_date             ON daily_task_tracking(task_date);
CREATE INDEX IF NOT EXISTS idx_dtt_user_date        ON daily_task_tracking(user_id, task_date);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer   ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred   ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_level      ON referrals(referral_level);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read   ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_date   ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

CREATE INDEX IF NOT EXISTS idx_kyc_user             ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status           ON kyc_documents(verification_status);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

CREATE INDEX IF NOT EXISTS idx_pwd_resets_user      ON password_resets(user_id);

-- ============================================================
-- STEP 4: TRIGGERS (auto-update updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at         ON users;
DROP TRIGGER IF EXISTS update_tasks_updated_at         ON tasks;
DROP TRIGGER IF EXISTS update_transactions_updated_at  ON transactions;
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STEP 5: SEED VIP LEVELS (runs AFTER table is confirmed)
-- ============================================================

INSERT INTO vip_levels
  (level, name, required_deposit_usdt, daily_task_limit, task_reward_usdt,
   referral_bonus_usdt, level1_commission_rate, level2_commission_rate,
   level3_commission_rate, min_withdraw_usdt, color, badge_icon)
VALUES
  (0, 'VIP 0',    0.00,    10, 0.1000,  0.50,  0.10, 0.03, 0.01,  10.00, '#888888', 'ph-star'),
  (1, 'VIP 1',   50.00,    20, 0.1500,  1.00,  0.12, 0.04, 0.01,  10.00, '#CD7F32', 'ph-star-half'),
  (2, 'VIP 2',  200.00,    35, 0.2500,  2.00,  0.15, 0.05, 0.02,  20.00, '#C0C0C0', 'ph-star-fill'),
  (3, 'VIP 3',  500.00,    50, 0.4000,  3.00,  0.18, 0.06, 0.02,  30.00, '#FFD700', 'ph-crown-simple'),
  (4, 'VIP 4', 2000.00,    80, 0.7000,  5.00,  0.20, 0.08, 0.03,  50.00, '#E5E4E2', 'ph-crown'),
  (5, 'VIP 5', 5000.00,     0, 1.2000, 10.00,  0.25, 0.10, 0.05, 100.00, '#B9F2FF', 'ph-diamonds-four')
ON CONFLICT (level) DO UPDATE SET
  name                   = EXCLUDED.name,
  required_deposit_usdt  = EXCLUDED.required_deposit_usdt,
  daily_task_limit       = EXCLUDED.daily_task_limit,
  task_reward_usdt       = EXCLUDED.task_reward_usdt,
  referral_bonus_usdt    = EXCLUDED.referral_bonus_usdt,
  level1_commission_rate = EXCLUDED.level1_commission_rate,
  level2_commission_rate = EXCLUDED.level2_commission_rate,
  level3_commission_rate = EXCLUDED.level3_commission_rate,
  min_withdraw_usdt      = EXCLUDED.min_withdraw_usdt,
  color                  = EXCLUDED.color,
  badge_icon             = EXCLUDED.badge_icon;

-- ============================================================
-- STEP 6: SEED PAYMENT METHODS
-- ============================================================

INSERT INTO payment_methods
  (name, identifier, account_name, account_number, instructions, icon, color, display_order)
VALUES
  ('JazzCash',      'jazzcash',  'RFT Entertainment', '03001234567',              'Send to JazzCash mobile account number. Take a screenshot of the successful transfer.', '📱', '#FF0000', 1),
  ('Easypaisa',     'easypaisa', 'RFT Entertainment', '03001234568',              'Send to Easypaisa mobile account. Upload screenshot as proof of payment.',              '💰', '#00AA00', 2),
  ('SadaPay',       'sadapay',   'RFT Entertainment', '03001234569',              'Transfer via SadaPay app. Screenshot required.',                                         '💳', '#6600CC', 3),
  ('NayaPay',       'nayapay',   'RFT Entertainment', '03001234570',              'Send via NayaPay. Attach payment screenshot.',                                           '🏦', '#FF6600', 4),
  ('Raast',         'raast',     'RFT Entertainment', '03001234571',              'Send via Raast ID. Include your user ID in the remarks.',                                '⚡', '#00CCFF', 5),
  ('Bank Transfer', 'bank',      'RFT Entertainment', 'PK36HABB0000123456789000', 'Bank wire transfer. Include your registered phone number in the narration field.',       '🏛️', '#333333', 6)
ON CONFLICT (identifier) DO NOTHING;

-- ============================================================
-- STEP 7: SEED SAMPLE TASKS
-- ============================================================

INSERT INTO tasks
  (title, description, thumbnail_url, video_url, task_type, reward_usdt, duration_seconds, order_index)
VALUES
  ('Watch YouTube Video',   'Watch the full video to earn your reward.',    'https://placehold.co/300x180/1a1a1a/d4a843?text=YouTube',    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube',   0.10, 150, 1),
  ('Follow TikTok Account', 'Follow the account and earn instantly.',       'https://placehold.co/300x180/1a1a1a/ff0050?text=TikTok',    'https://tiktok.com/@example',                 'tiktok',    0.10,  30, 2),
  ('Like Instagram Post',   'Like the post to earn your reward.',           'https://placehold.co/300x180/1a1a1a/E1306C?text=Instagram', 'https://instagram.com/p/example',             'instagram', 0.10,  15, 3),
  ('Share Facebook Post',   'Share this post to earn rewards.',             'https://placehold.co/300x180/1a1a1a/1877F2?text=Facebook',  'https://facebook.com/post/example',           'facebook',  0.10,  45, 4),
  ('Subscribe on YouTube',  'Subscribe to the channel to earn rewards.',   'https://placehold.co/300x180/1a1a1a/FF0000?text=Subscribe', 'https://youtube.com/channel/example',         'youtube',   0.15,  30, 5),
  ('Watch TikTok Video',    'Watch and like the video to earn rewards.',   'https://placehold.co/300x180/1a1a1a/ff0050?text=TikTok+2', 'https://tiktok.com/v/example',                'tiktok',    0.12,  60, 6)
ON CONFLICT DO NOTHING;
