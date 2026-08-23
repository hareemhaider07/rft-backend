-- ============================================================
-- RFT Entertainment — Seed Data
-- Run AFTER fix.sql and schema.sql have both succeeded
-- ============================================================

-- ── Payment Methods ──────────────────────────────────────────
INSERT INTO payment_methods
  (name, identifier, account_name, account_number, instructions, icon, color, display_order)
VALUES
  ('JazzCash',      'jazzcash',  'RFT Entertainment', '03001234567',              'Send to this JazzCash number. Screenshot required.',              '📱', '#FF0000', 1),
  ('Easypaisa',     'easypaisa', 'RFT Entertainment', '03001234568',              'Send to this Easypaisa number. Upload screenshot as proof.',      '💰', '#00AA00', 2),
  ('SadaPay',       'sadapay',   'RFT Entertainment', '03001234569',              'Transfer via SadaPay app. Screenshot required.',                  '💳', '#6600CC', 3),
  ('NayaPay',       'nayapay',   'RFT Entertainment', '03001234570',              'Send via NayaPay. Attach payment screenshot.',                    '🏦', '#FF6600', 4),
  ('Raast',         'raast',     'RFT Entertainment', '03001234571',              'Send via Raast ID. Include your phone number in remarks.',        '⚡', '#00CCFF', 5),
  ('Bank Transfer', 'bank',      'RFT Entertainment', 'PK36HABB0000123456789000', 'Bank wire. Write your registered phone number in narration.',     '🏛️', '#333333', 6)
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

-- ── Verify everything ────────────────────────────────────────
SELECT 'vip_levels'      AS table_name, COUNT(*) AS rows FROM vip_levels
UNION ALL
SELECT 'payment_methods' AS table_name, COUNT(*) AS rows FROM payment_methods
UNION ALL
SELECT 'tasks'           AS table_name, COUNT(*) AS rows FROM tasks;
