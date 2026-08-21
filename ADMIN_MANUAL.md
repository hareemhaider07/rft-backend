# RFT Entertainment - Admin Manual

This manual explains how to manually approve recharge requests, withdrawal requests, and KYC documents in the Supabase database.

## Accessing Supabase Database

1. Log in to your Supabase dashboard: https://supabase.com/dashboard
2. Select your RFT Entertainment project
3. Go to **Table Editor** or **SQL Editor** to manage data

## Manual Processes

Since we're using manual processing for the MVP, you'll need to:

1. **Approve recharge requests** after verifying bank transfer screenshots
2. **Approve withdrawal requests** after sending funds to users
3. **Review and approve KYC documents** after verifying identity

---

## 1. Approving Recharge Requests

### View Pending Recharge Requests

**Using SQL Editor:**
```sql
SELECT 
    t.id,
    t.user_id,
    u.name,
    u.email,
    u.phone,
    t.amount_usdt,
    t.amount_pkr,
    t.payment_method,
    t.screenshot_url,
    t.notes,
    t.created_at
FROM transactions t
JOIN users u ON t.user_id = u.id
WHERE t.type = 'recharge' 
  AND t.status = 'pending'
ORDER BY t.created_at DESC;
```

**Using Table Editor:**
1. Go to Table Editor
2. Select `transactions` table
3. Click "Filter" button
4. Add filter: `type` equals `recharge`
5. Add filter: `status` equals `pending`

### Verify Payment

1. Check the `screenshot_url` field for the payment proof
2. Verify the amount matches the transaction
3. Verify the payment method matches the user's account
4. Cross-reference with your bank records if possible

### Approve Recharge

**After verification, run this SQL:**
```sql
-- Update transaction status to completed
UPDATE transactions 
SET status = 'completed', 
    updated_at = NOW()
WHERE id = 'transaction-uuid-here';

-- Add funds to user balance
UPDATE users 
SET balance_usdt = balance_usdt + (
    SELECT amount_usdt 
    FROM transactions 
    WHERE id = 'transaction-uuid-here'
)
WHERE id = 'user-uuid-here';
```

**Replace:**
- `transaction-uuid-here` with the actual transaction ID
- `user-uuid-here` with the actual user ID

### Reject Recharge

If payment is invalid or cannot be verified:

```sql
UPDATE transactions 
SET status = 'failed',
    notes = 'Payment verification failed',
    updated_at = NOW()
WHERE id = 'transaction-uuid-here';
```

---

## 2. Approving Withdrawal Requests

### View Pending Withdrawal Requests

**Using SQL Editor:**
```sql
SELECT 
    t.id,
    t.user_id,
    u.name,
    u.email,
    u.phone,
    t.amount_usdt,
    t.amount_pkr,
    t.payment_method,
    t.notes,
    t.created_at
FROM transactions t
JOIN users u ON t.user_id = u.id
WHERE t.type = 'withdrawal' 
  AND t.status = 'pending'
ORDER BY t.created_at DESC;
```

**Using Table Editor:**
1. Go to Table Editor
2. Select `transactions` table
3. Filter: `type` equals `withdrawal`
4. Filter: `status` equals `pending`

### Verify Withdrawal

1. Check user's KYC status:
   ```sql
   SELECT kyc_status FROM users WHERE id = 'user-uuid-here';
   ```
   - Only approve if `kyc_status` is `verified`

2. Check user's balance:
   ```sql
   SELECT balance_usdt FROM users WHERE id = 'user-uuid-here';
   ```
   - Ensure they have sufficient balance

3. Verify payment details in `notes` field

### Process Withdrawal

1. **Send funds** to the user's account using your bank/payment system
2. **After successful transfer**, approve the withdrawal:

```sql
UPDATE transactions 
SET status = 'completed',
    updated_at = NOW()
WHERE id = 'transaction-uuid-here';
```

**Note:** The amount is already deducted from the user's balance when they requested the withdrawal, so you don't need to update their balance again.

### Reject Withdrawal

If you cannot process the withdrawal:

```sql
-- Update transaction status to failed
UPDATE transactions 
SET status = 'failed',
    notes = 'Withdrawal rejected - reason here',
    updated_at = NOW()
WHERE id = 'transaction-uuid-here';

-- Refund amount to user balance
UPDATE users 
SET balance_usdt = balance_usdt + (
    SELECT amount_usdt 
    FROM transactions 
    WHERE id = 'transaction-uuid-here'
)
WHERE id = 'user-uuid-here';
```

---

## 3. Reviewing KYC Documents

### View Pending KYC Requests

**Using SQL Editor:**
```sql
SELECT 
    k.id,
    k.user_id,
    u.name,
    u.email,
    u.phone,
    k.document_type,
    k.issuing_country,
    k.document_number,
    k.front_image_url,
    k.back_image_url,
    k.selfie_image_url,
    k.submitted_at
FROM kyc_documents k
JOIN users u ON k.user_id = u.id
WHERE k.verification_status = 'pending'
ORDER BY k.submitted_at DESC;
```

**Using Table Editor:**
1. Go to Table Editor
2. Select `kyc_documents` table
3. Filter: `verification_status` equals `pending`

### Verify Documents

1. **Open the document images:**
   - `front_image_url` - Front of ID card
   - `back_image_url` - Back of ID card
   - `selfie_image_url` - Selfie with ID

2. **Verify:**
   - Document is valid and not expired
   - Information matches user profile (name, DOB if visible)
   - Selfie matches the person on the ID
   - Document type matches what was selected
   - Issuing country is correct

### Approve KYC

**After successful verification:**

```sql
-- Update KYC document status
UPDATE kyc_documents 
SET verification_status = 'verified',
    verified_at = NOW()
WHERE id = 'kyc-uuid-here';

-- Update user KYC status
UPDATE users 
SET kyc_status = 'verified',
    updated_at = NOW()
WHERE id = 'user-uuid-here';
```

### Reject KYC

If documents are invalid or cannot be verified:

```sql
UPDATE kyc_documents 
SET verification_status = 'rejected',
    rejection_reason = 'Reason for rejection here',
    verified_at = NOW()
WHERE id = 'kyc-uuid-here';

-- Update user KYC status
UPDATE users 
SET kyc_status = 'rejected',
    updated_at = NOW()
WHERE id = 'user-uuid-here';
```

---

## 4. Common SQL Queries

### View all users
```sql
SELECT 
    id, 
    name, 
    email, 
    phone, 
    kyc_status, 
    balance_usdt, 
    points, 
    created_at,
    last_login_at
FROM users
ORDER BY created_at DESC;
```

### View user's transaction history
```sql
SELECT 
    type, 
    amount_usdt, 
    amount_pkr, 
    payment_method, 
    status, 
    notes, 
    created_at
FROM transactions
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;
```

### View user's task completions
```sql
SELECT 
    ut.task_id,
    t.title,
    ut.status,
    ut.reward_usdt,
    ut.completed_at
FROM user_tasks ut
JOIN tasks t ON ut.task_id = t.id
WHERE ut.user_id = 'user-uuid-here'
ORDER BY ut.completed_at DESC;
```

### View today's statistics
```sql
-- New registrations today
SELECT COUNT(*) FROM users 
WHERE DATE(created_at) = CURRENT_DATE;

-- Tasks completed today
SELECT COUNT(*) FROM user_tasks 
WHERE status = 'completed' 
  AND DATE(completed_at) = CURRENT_DATE;

-- Pending recharge requests
SELECT COUNT(*) FROM transactions 
WHERE type = 'recharge' 
  AND status = 'pending';

-- Pending withdrawal requests
SELECT COUNT(*) FROM transactions 
WHERE type = 'withdrawal' 
  AND status = 'pending';

-- Pending KYC requests
SELECT COUNT(*) FROM kyc_documents 
WHERE verification_status = 'pending';
```

### View financial summary
```sql
-- Total recharges
SELECT 
    COUNT(*) as total_recharges,
    SUM(amount_usdt) as total_recharge_amount
FROM transactions 
WHERE type = 'recharge' 
  AND status = 'completed';

-- Total withdrawals
SELECT 
    COUNT(*) as total_withdrawals,
    SUM(amount_usdt) as total_withdrawal_amount
FROM transactions 
WHERE type = 'withdrawal' 
  AND status = 'completed';

-- Total task rewards paid
SELECT 
    COUNT(*) as total_tasks,
    SUM(reward_usdt) as total_rewards
FROM user_tasks 
WHERE status = 'completed';

-- Current total user balances
SELECT 
    SUM(balance_usdt) as total_balances
FROM users;
```

---

## 5. User Management

### Manually add balance to user
```sql
UPDATE users 
SET balance_usdt = balance_usdt + 50.00
WHERE id = 'user-uuid-here';

-- Record as manual transaction
INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
VALUES (
    'user-uuid-here',
    'manual_adjustment',
    50.00,
    14000.00,
    'completed',
    'Manual balance adjustment by admin'
);
```

### Manually deduct balance from user
```sql
UPDATE users 
SET balance_usdt = balance_usdt - 50.00
WHERE id = 'user-uuid-here';

-- Record as manual transaction
INSERT INTO transactions (user_id, type, amount_usdt, amount_pkr, status, notes)
VALUES (
    'user-uuid-here',
    'manual_adjustment',
    -50.00,
    -14000.00,
    'completed',
    'Manual balance deduction by admin'
);
```

### Deactivate user account
```sql
UPDATE users 
SET is_active = false,
    updated_at = NOW()
WHERE id = 'user-uuid-here';
```

### Reactivate user account
```sql
UPDATE users 
SET is_active = true,
    updated_at = NOW()
WHERE id = 'user-uuid-here';
```

### Delete user account (with all data)
```sql
-- This will cascade delete all related data
DELETE FROM users WHERE id = 'user-uuid-here';
```

---

## 6. Task Management

### Add new task
```sql
INSERT INTO tasks (title, description, thumbnail_url, video_url, task_type, reward_usdt, duration_seconds, order_index)
VALUES (
    'Watch YouTube Video',
    'Watch the complete video to earn rewards',
    'https://your-cdn.com/thumbnail.jpg',
    'https://youtube.com/watch?v=example',
    'youtube',
    0.10,
    150,
    5
);
```

### Deactivate task
```sql
UPDATE tasks 
SET is_active = false
WHERE id = 'task-uuid-here';
```

### Update task reward
```sql
UPDATE tasks 
SET reward_usdt = 0.15,
    updated_at = NOW()
WHERE id = 'task-uuid-here';
```

---

## 7. Best Practices

### Security
- Never share your Supabase credentials
- Use SQL Editor with caution - always verify queries before running
- Keep records of all manual approvals
- Review pending requests regularly (at least daily)

### Verification
- Always verify payment screenshots before approving recharges
- Always verify KYC documents thoroughly before approval
- Cross-check withdrawal details with user profile
- Keep notes for all rejected transactions

### Record Keeping
- Document reasons for all rejections
- Keep screenshots of payment proofs (download from URLs)
- Maintain a log of manual approvals outside the system
- Regular backup of database (Supabase has automatic backups)

### Communication
- Notify users when their KYC is approved/rejected
- Notify users when recharge/withdrawal is processed
- Provide clear reasons for rejections

---

## 8. Troubleshooting

### User cannot withdraw
- Check if user's KYC is verified: `SELECT kyc_status FROM users WHERE id = 'user-id'`
- Check if user has sufficient balance: `SELECT balance_usdt FROM users WHERE id = 'user-id'`
- Check if there are pending withdrawals: `SELECT * FROM transactions WHERE user_id = 'user-id' AND type = 'withdrawal' AND status = 'pending'`

### User balance incorrect
- Check transaction history: `SELECT * FROM transactions WHERE user_id = 'user-id'`
- Check for failed transactions that didn't refund
- Manually adjust balance if needed (see User Management section)

### KYC stuck in pending
- Check if KYC documents exist: `SELECT * FROM kyc_documents WHERE user_id = 'user-id'`
- Check verification status
- Manually approve/reject if needed

### Tasks not completing
- Check if task is active: `SELECT is_active FROM tasks WHERE id = 'task-id'`
- Check user's daily task limit
- Check if task already completed today

---

## 9. Automation (Future)

Once you're ready to automate these processes, consider:

1. **Payment Gateway Integration**
   - JazzCash API for automatic recharge
   - Easypaisa API for automatic recharge
   - Webhook handlers for payment confirmations

2. **KYC Service Integration**
   - Jumio, Onfido, or Sumsub for automatic verification
   - Webhook handlers for verification results

3. **Admin Dashboard**
   - Build a simple admin panel in React/Vue
   - Display pending requests in a table
   - One-click approve/reject buttons
   - View document images inline

4. **Email Notifications**
   - Send email when KYC is approved/rejected
   - Send email when recharge/withdrawal is processed
   - Send email for important account updates

---

## 10. Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Review backend logs: `pm2 logs rft-api`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
4. Verify database connection
5. Test API endpoints manually

## Summary

For the MVP phase, you'll need to:
1. **Daily**: Check and approve pending recharge requests
2. **Daily**: Check and approve pending withdrawal requests
3. **Daily**: Review and approve/reject KYC documents
4. **Weekly**: Review financial summaries and user statistics
5. **As needed**: Handle user support requests and account issues

This manual process is temporary and can be automated once you integrate payment gateways and KYC services.
