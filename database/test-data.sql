-- ============================================================
-- RFT Entertainment — Test / Dummy Data
-- Run in Supabase SQL Editor
-- TESTING ONLY — replace with real data before launch
-- ============================================================

-- ── 1. UPDATE TASKS WITH REAL YOUTUBE/TIKTOK URLS ────────────
-- Delete old placeholder tasks first
DELETE FROM daily_task_tracking;
DELETE FROM tasks;

INSERT INTO tasks (title, description, thumbnail_url, video_url, task_type, reward_usdt, duration_seconds, min_vip_level, order_index) VALUES

-- YouTube tasks
('Watch RFT Intro Video',
 'Watch our introduction video to learn about RFT Entertainment rewards platform.',
 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
 'youtube', 0.10, 30, 0, 1),

('Subscribe RFT YouTube Channel',
 'Subscribe to our YouTube channel to stay updated with the latest content.',
 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
 'https://www.youtube.com/watch?v=9bZkp7q19f0',
 'youtube', 0.12, 30, 0, 2),

('Watch Today''s Featured Video',
 'Watch this featured video all the way through to earn your reward.',
 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
 'youtube', 0.10, 60, 0, 3),

-- TikTok tasks
('Follow RFT TikTok Account',
 'Follow our TikTok account to earn instant rewards.',
 'https://placehold.co/300x180/0a0a0a/ff0050?text=TikTok+Follow',
 'https://www.tiktok.com/@tiktok',
 'tiktok', 0.10, 20, 0, 4),

('Like & Share TikTok Video',
 'Like and share this TikTok video to earn your reward.',
 'https://placehold.co/300x180/0a0a0a/ff0050?text=TikTok+Like',
 'https://www.tiktok.com/@charlidamelio',
 'tiktok', 0.12, 20, 0, 5),

-- Instagram tasks
('Follow RFT Instagram',
 'Follow our Instagram page to earn instant rewards.',
 'https://placehold.co/300x180/0a0a0a/E1306C?text=Instagram+Follow',
 'https://www.instagram.com/instagram/',
 'instagram', 0.10, 15, 0, 6),

('Like Instagram Post',
 'Like this Instagram post to earn your reward.',
 'https://placehold.co/300x180/0a0a0a/E1306C?text=Instagram+Like',
 'https://www.instagram.com/p/example/',
 'instagram', 0.10, 15, 0, 7),

-- Facebook tasks
('Like RFT Facebook Page',
 'Like our Facebook page to earn instant rewards.',
 'https://placehold.co/300x180/0a0a0a/1877F2?text=Facebook+Like',
 'https://www.facebook.com/facebook',
 'facebook', 0.10, 20, 0, 8),

-- VIP-only tasks (higher rewards)
('Watch YouTube Video (VIP 1)',
 'Exclusive VIP task — watch this video for higher rewards.',
 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg',
 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
 'youtube', 0.20, 60, 1, 9),

('Subscribe YouTube Channel (VIP 1)',
 'VIP exclusive — subscribe for bonus rewards.',
 'https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
 'youtube', 0.25, 30, 1, 10),

('VIP TikTok Task',
 'Exclusive TikTok task for VIP 1 members and above.',
 'https://placehold.co/300x180/0a0a0a/ff0050?text=VIP+TikTok',
 'https://www.tiktok.com/@khaby.lame',
 'tiktok', 0.20, 30, 1, 11);

-- ── 2. UPDATE PAYMENT METHODS WITH TEST DATA ─────────────────
UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = '03001234567',
  instructions   = 'TEST MODE: Send to JazzCash 03001234567. Take screenshot and upload. Amount will be credited after admin review.',
  is_active      = true
WHERE identifier = 'jazzcash';

UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = '03001234568',
  instructions   = 'TEST MODE: Send to Easypaisa 03001234568. Screenshot required.',
  is_active      = true
WHERE identifier = 'easypaisa';

UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = '03001234569',
  instructions   = 'TEST MODE: Send via SadaPay. Screenshot required.',
  is_active      = true
WHERE identifier = 'sadapay';

UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = '03001234570',
  instructions   = 'TEST MODE: Send via NayaPay. Screenshot required.',
  is_active      = true
WHERE identifier = 'nayapay';

UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = 'RAAST-TEST-001',
  instructions   = 'TEST MODE: Send via Raast. Include your phone number in remarks.',
  is_active      = true
WHERE identifier = 'raast';

UPDATE payment_methods SET
  account_name   = 'RFT Entertainment (TEST)',
  account_number = 'PK36HABB0000123456789000',
  instructions   = 'TEST MODE: Bank transfer. Include your registered phone number in narration.',
  is_active      = true
WHERE identifier = 'bank';

-- ── 3. ADD TEST ANNOUNCEMENTS ─────────────────────────────────
-- Clear old ones first
DELETE FROM announcements;

INSERT INTO announcements (title, content, type, is_active, target_vip_level) VALUES
('🎉 Welcome to RFT Entertainment!',
 'Earn USDT daily by watching videos, completing tasks, and referring friends. Complete your first task now to get started!',
 'success', true, -1),

('💰 New Tasks Added!',
 'We have added 11 new tasks today. Log in and complete all tasks to maximize your daily earnings.',
 'info', true, -1),

('⭐ VIP System Now Live',
 'Upgrade your VIP level to unlock more daily tasks, higher rewards, and exclusive bonuses. Deposit now to level up!',
 'info', true, -1),

('🎡 Lucky Draw Available!',
 'Spin the wheel daily to win USDT and Points prizes. VIP members get extra spins every day.',
 'success', true, -1),

('🏆 VIP 1 Special Offer',
 'VIP 1 members now get 2 daily spins and access to exclusive higher-reward tasks. Upgrade today!',
 'info', true, 1);

-- ── 4. UPDATE VIP LEVEL DISPLAY NAMES (cosmetic) ─────────────
UPDATE vip_levels SET name = 'Starter'   WHERE level = 0;
UPDATE vip_levels SET name = 'Bronze'    WHERE level = 1;
UPDATE vip_levels SET name = 'Silver'    WHERE level = 2;
UPDATE vip_levels SET name = 'Gold'      WHERE level = 3;
UPDATE vip_levels SET name = 'Platinum'  WHERE level = 4;
UPDATE vip_levels SET name = 'Diamond'   WHERE level = 5;

-- ── 5. VERIFY ────────────────────────────────────────────────
SELECT 'tasks'          AS tbl, COUNT(*) AS rows FROM tasks
UNION ALL SELECT 'announcements',    COUNT(*) FROM announcements
UNION ALL SELECT 'payment_methods',  COUNT(*) FROM payment_methods
UNION ALL SELECT 'vip_levels',       COUNT(*) FROM vip_levels
UNION ALL SELECT 'spin_prizes',      COUNT(*) FROM spin_prizes;
