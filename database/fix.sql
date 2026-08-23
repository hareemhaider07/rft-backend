-- ============================================================
-- RFT Entertainment — ONE-TIME FIX SCRIPT
-- Run this ONCE in Supabase SQL Editor to fix the broken
-- vip_levels table and seed all data correctly.
-- ============================================================

-- STEP 1: Drop the broken vip_levels table (it was created
-- without the 'level' column due to earlier failed runs)
DROP TABLE IF EXISTS vip_levels CASCADE;

-- STEP 2: Recreate it correctly with ALL columns
CREATE TABLE vip_levels (
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

-- STEP 3: Insert all 6 VIP levels
INSERT INTO vip_levels
  (level, name, required_deposit_usdt, daily_task_limit, task_reward_usdt,
   referral_bonus_usdt, level1_commission_rate, level2_commission_rate,
   level3_commission_rate, min_withdraw_usdt, color, badge_icon)
VALUES
  (0, 'VIP 0',    0.00,  10, 0.1000,  0.50, 0.10, 0.03, 0.01,  10.00, '#888888', 'ph-star'),
  (1, 'VIP 1',   50.00,  20, 0.1500,  1.00, 0.12, 0.04, 0.01,  10.00, '#CD7F32', 'ph-star-half'),
  (2, 'VIP 2',  200.00,  35, 0.2500,  2.00, 0.15, 0.05, 0.02,  20.00, '#C0C0C0', 'ph-star-fill'),
  (3, 'VIP 3',  500.00,  50, 0.4000,  3.00, 0.18, 0.06, 0.02,  30.00, '#FFD700', 'ph-crown-simple'),
  (4, 'VIP 4', 2000.00,  80, 0.7000,  5.00, 0.20, 0.08, 0.03,  50.00, '#E5E4E2', 'ph-crown'),
  (5, 'VIP 5', 5000.00,   0, 1.2000, 10.00, 0.25, 0.10, 0.05, 100.00, '#B9F2FF', 'ph-diamonds-four');

-- STEP 4: Verify — you should see 6 rows
SELECT level, name, daily_task_limit, task_reward_usdt FROM vip_levels ORDER BY level;
