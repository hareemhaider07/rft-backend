-- ============================================================
-- RFT Entertainment — Seed Data
-- Run this AFTER schema.sql has finished successfully
-- ============================================================

-- ── VIP Levels ──────────────────────────────────────────────
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
  (5, 'VIP 5', 5000.00,   0, 1.2000, 10.00, 0.25, 0.10, 0.05, 100.00, '#B9F2FF', 'ph-diamonds-four')
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

-- ── Payment Methods ──────────────────────────────────────────
INSERT INTO payment_methods
  (name, identifier, account_name, account_number, instructions, icon, color, display_order)
VALUES
  ('JazzCash',      'jazzcash',  'RFT Entertainment', '03001234567',              'Send to this JazzCash number. Take a screenshot of the confirmation screen.',       '📱', '#FF0000', 1),
  ('Easypaisa',     'easypaisa', 'RFT Entertainment', '03001234568',              'Send to this Easypaisa number. Upload the payment screenshot as proof.',           '💰', '#00AA00', 2),
  ('SadaPay',       'sadapay',   'RFT Entertainment', '03001234569',              'Transfer via SadaPay app. Screenshot required for verification.',                  '💳', '#6600CC', 3),
  ('NayaPay',       'nayapay',   'RFT Entertainment', '03001234570',              'Send via NayaPay. Attach payment screenshot after transfer.',                      '🏦', '#FF6600', 4),
  ('Raast',         'raast',     'RFT Entertainment', '03001234571',              'Send via Raast ID. Include your registered phone number in the remarks field.',    '⚡', '#00CCFF', 5),
  ('Bank Transfer', 'bank',      'RFT Entertainment', 'PK36HABB0000123456789000', 'Bank wire transfer. Write your registered phone number in the narration field.',   '🏛️', '#333333', 6)
ON CONFLICT (identifier) DO NOTHING;

-- ── Sample Tasks ─────────────────────────────────────────────
INSERT INTO tasks
  (title, description, thumbnail_url, video_url, task_type, reward_usdt, duration_seconds, order_index)
VALUES
  ('Watch YouTube Video',   'Watch the full video to earn your reward.',  'https://placehold.co/300x180/1a1a1a/d4a843?text=YouTube',    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube',   0.10, 150, 1),
  ('Follow TikTok Account', 'Follow the account and earn instantly.',     'https://placehold.co/300x180/1a1a1a/ff0050?text=TikTok',    'https://tiktok.com/@example',                 'tiktok',    0.10,  30, 2),
  ('Like Instagram Post',   'Like the post to earn your reward.',         'https://placehold.co/300x180/1a1a1a/E1306C?text=Instagram', 'https://instagram.com/p/example',             'instagram', 0.10,  15, 3),
  ('Share Facebook Post',   'Share this post to earn rewards.',           'https://placehold.co/300x180/1a1a1a/1877F2?text=Facebook',  'https://facebook.com/post/example',           'facebook',  0.10,  45, 4),
  ('Subscribe on YouTube',  'Subscribe to the channel to earn rewards.', 'https://placehold.co/300x180/1a1a1a/FF0000?text=Subscribe', 'https://youtube.com/channel/example',         'youtube',   0.15,  30, 5),
  ('Watch TikTok Video',    'Watch and like the video to earn rewards.', 'https://placehold.co/300x180/1a1a1a/ff0050?text=TikTok+2', 'https://tiktok.com/v/example',                'tiktok',    0.12,  60, 6)
ON CONFLICT DO NOTHING;
