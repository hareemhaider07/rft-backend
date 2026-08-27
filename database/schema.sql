-- ============================================================
-- RFT Entertainment — Database Schema v2.2
-- INSTRUCTIONS: Run this in Supabase SQL Editor
-- If you get ANY error, run it a SECOND TIME — it is fully
-- idempotent (safe to run multiple times).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- ============================================================
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='frozen_usdt')    THEN ALTER TABLE users ADD COLUMN frozen_usdt  DECIMAL(10,2) DEFAULT 0.00;       END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vip_level')     THEN ALTER TABLE users ADD COLUMN vip_level    INTEGER       DEFAULT 0;           END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code') THEN ALTER TABLE users ADD COLUMN referral_code VARCHAR(20)  UNIQUE;              END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='referred_by')   THEN ALTER TABLE users ADD COLUMN referred_by   VARCHAR(20);                     END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_status')    THEN ALTER TABLE users ADD COLUMN kyc_status    VARCHAR(20)  DEFAULT 'not_started'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='kyc_data')      THEN ALTER TABLE users ADD COLUMN kyc_data      JSONB;                           END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='balance_usdt')  THEN ALTER TABLE users ADD COLUMN balance_usdt  DECIMAL(10,2) DEFAULT 0.00;      END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='points')        THEN ALTER TABLE users ADD COLUMN points        INTEGER       DEFAULT 0;           END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone         ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status    ON users(kyc_status);
CREATE INDEX IF NOT EXISTS idx_users_vip_level     ON users(vip_level);

-- ============================================================
-- TABLE: vip_levels
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_levels (
  id                     SERIAL        PRIMARY KEY,
  level                  INTEGER       UNIQUE NOT NULL,
  name                   VARCHAR(50)   NOT NULL,
  required_deposit_usdt  DECIMAL(10,2) DEFAULT 0.00,
  daily_task_limit       INTEGER       DEFAULT 10,
  task_reward_usdt       DECIMAL(10,4) DEFAULT 0.10,
  referral_bonus_usdt    DECIMAL(10,2) DEFAULT 0.50,
  level1_commission_rate DECIMAL(5,4)  DEFAULT 0.10,
  level2_commission_rate DECIMAL(5,4)  DEFAULT 0.03,
  level3_commission_rate DECIMAL(5,4)  DEFAULT 0.01,
  min_withdraw_usdt      DECIMAL(10,2) DEFAULT 10.00,
  color                  VARCHAR(20)   DEFAULT '#888888',
  badge_icon             VARCHAR(100)  DEFAULT 'ph-star',
  is_active              BOOLEAN       DEFAULT true,
  created_at             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: tasks
-- ============================================================
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='min_vip_level') THEN
    ALTER TABLE tasks ADD COLUMN min_vip_level INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_type   ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_order  ON tasks(order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_vip    ON tasks(min_vip_level);

-- ============================================================
-- TABLE: daily_task_tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_task_tracking (
  id                     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID          REFERENCES users(id) ON DELETE CASCADE,
  task_id                UUID          REFERENCES tasks(id) ON DELETE CASCADE,
  task_date              DATE          NOT NULL DEFAULT CURRENT_DATE,
  status                 VARCHAR(20)   DEFAULT 'pending',
  watch_duration_seconds INTEGER       DEFAULT 0,
  reward_usdt            DECIMAL(10,4) DEFAULT 0,
  completed_at           TIMESTAMP,
  created_at             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id, task_date)
);

CREATE INDEX IF NOT EXISTS idx_dtt_user      ON daily_task_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_dtt_task      ON daily_task_tracking(task_id);
CREATE INDEX IF NOT EXISTS idx_dtt_date      ON daily_task_tracking(task_date);
CREATE INDEX IF NOT EXISTS idx_dtt_user_date ON daily_task_tracking(user_id, task_date);

-- ============================================================
-- TABLE: transactions
-- ============================================================
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='admin_note')    THEN ALTER TABLE transactions ADD COLUMN admin_note    TEXT;      END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='processed_by')  THEN ALTER TABLE transactions ADD COLUMN processed_by  UUID;      END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='processed_at')  THEN ALTER TABLE transactions ADD COLUMN processed_at  TIMESTAMP; END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_user   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type   ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date   ON transactions(created_at);

-- ============================================================
-- TABLE: referrals
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_level    ON referrals(referral_level);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  type       VARCHAR(30)  DEFAULT 'info',
  is_read    BOOLEAN      DEFAULT false,
  action_url VARCHAR(255),
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(created_at);

-- ============================================================
-- TABLE: announcements
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(255) NOT NULL,
  content          TEXT         NOT NULL,
  type             VARCHAR(30)  DEFAULT 'info',
  is_active        BOOLEAN      DEFAULT true,
  target_vip_level INTEGER      DEFAULT -1,
  created_by       UUID,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

-- ============================================================
-- TABLE: payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100) NOT NULL,
  identifier     VARCHAR(50)  UNIQUE NOT NULL,
  account_name   VARCHAR(255),
  account_number VARCHAR(255),
  qr_code_url    VARCHAR(500),
  instructions   TEXT,
  is_active      BOOLEAN      DEFAULT true,
  display_order  INTEGER      DEFAULT 0,
  icon           VARCHAR(10)  DEFAULT '💳',
  color          VARCHAR(20)  DEFAULT '#333333',
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: admin_users
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  DEFAULT 'admin',
  is_active     BOOLEAN      DEFAULT true,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: admin_refresh_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id   UUID         REFERENCES admin_users(id) ON DELETE CASCADE,
  token      VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);

-- ============================================================
-- TABLE: kyc_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID         REFERENCES users(id) ON DELETE CASCADE,
  document_type       VARCHAR(50)  NOT NULL,
  issuing_country     VARCHAR(3)   NOT NULL,
  document_number     VARCHAR(100) NOT NULL,
  front_image_url     VARCHAR(500),
  back_image_url      VARCHAR(500),
  selfie_image_url    VARCHAR(500),
  verification_status VARCHAR(20)  DEFAULT 'pending',
  rejection_reason    TEXT,
  reviewed_by         UUID,
  submitted_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  verified_at         TIMESTAMP,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kyc_documents' AND column_name='reviewed_by') THEN
    ALTER TABLE kyc_documents ADD COLUMN reviewed_by UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kyc_user   ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_documents(verification_status);

-- ============================================================
-- TABLE: refresh_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID         REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================
-- TABLE: password_resets
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id         UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID       UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  otp        VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP  NOT NULL,
  used       BOOLEAN    DEFAULT false,
  created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pwd_resets_user ON password_resets(user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS trg_users_updated_at          ON users;
DROP TRIGGER IF EXISTS trg_tasks_updated_at          ON tasks;
DROP TRIGGER IF EXISTS trg_transactions_updated_at   ON transactions;
DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;

CREATE TRIGGER trg_users_updated_at           BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tasks_updated_at           BEFORE UPDATE ON tasks           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_transactions_updated_at    BEFORE UPDATE ON transactions    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAVED PAYOUT METHODS TABLE
-- =============================================
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

-- =============================================
-- LOGIN POPUPS TABLE (admin-managed notices)
-- =============================================
CREATE TABLE IF NOT EXISTS login_popups (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      VARCHAR(255) NOT NULL,
  content    TEXT         NOT NULL,
  image_url  VARCHAR(500),
  button_text VARCHAR(100) DEFAULT 'Got it',
  button_url  VARCHAR(500),
  is_active  BOOLEAN      DEFAULT true,
  show_once  BOOLEAN      DEFAULT false,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
