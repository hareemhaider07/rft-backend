// RFT Entertainment — Live API Test (no dependencies)
// Run: node backend/scripts/test-live.js

const BASE = 'https://rft-backend-production.up.railway.app/api';
const stamp = Date.now();
const TIMEOUT_MS = 15000;

async function r(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method, headers: h,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timer);
    const json = await res.json();
    return { _status: res.status, ...json };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return { _status: 408, success: false, message: 'TIMEOUT after ' + TIMEOUT_MS + 'ms' };
    return { _status: 0, success: false, message: e.message };
  }
}

const ok  = (m) => console.log('  \u2705 ' + m);
const err = (m) => console.log('  \u274C ' + m);
const sec = (m) => console.log('\n--- ' + m + ' ---');

(async () => {
  console.log('\nRFT Entertainment \u2014 Live API Test\n');

  // 1. Health
  sec('1. Health');
  const h = await r('GET', '/../health');
  h.status === 'ok' ? ok('Health OK') : err('Health: ' + JSON.stringify(h));

  // 2. Wake up DB — admin login first (already works, warms up the pool)
  sec('2. DB Warm-up via Admin Login');
  const adm = await r('POST', '/admin/auth/login', { username: 'admin', password: 'Admin1234' });
  const adminToken = adm.data?.access_token;
  adm.success ? ok('DB awake — Admin login OK') : err('Admin login: ' + adm.message);

  // 3. Register
  sec('3. Register new user');
  const reg = await r('POST', '/auth/register', {
    name: 'Test User',
    email: 'test_' + stamp + '@rft.com',
    phone: '031' + stamp.toString().slice(-8),
    password: 'Test1234'
  });
  if (!reg.success) { err('Register: ' + reg.message); }
  else {
    ok('Registered: ' + reg.data.user.email);
    ok('Referral code: ' + reg.data.user.referral_code);
    ok('VIP level: ' + reg.data.user.vip_level);
  }
  const token = reg.data?.accessToken;

  if (!token) {
    err('No token — skipping remaining tests');
    if (adminToken) await runAdminTests(adminToken, null);
    return;
  }

  // 4. Login
  sec('4. Login');
  const login = await r('POST', '/auth/login', {
    email_or_phone: 'test_' + stamp + '@rft.com',
    password: 'Test1234'
  });
  login.success ? ok('Login OK') : err('Login: ' + login.message);
  const t = login.data?.accessToken || token;

  // 5. Profile (JWT auth check)
  sec('5. JWT Authorization');
  const prof = await r('GET', '/user/profile', null, t);
  prof.success ? ok('Protected route OK: ' + prof.data.name) : err('Profile: ' + prof.message);
  const noAuth = await r('GET', '/user/profile');
  noAuth._status === 401 ? ok('Unauthenticated request blocked (401)') : err('Expected 401, got ' + noAuth._status);

  // 6. Wallet
  sec('6. Wallet');
  const bal = await r('GET', '/wallet/balance', null, t);
  bal.success ? ok('Balance: ' + bal.data.balance_usdt + ' USDT') : err('Balance: ' + bal.message);
  const pm = await r('GET', '/wallet/payment-info', null, t);
  pm.success ? ok('Payment methods: ' + pm.data.length + ' loaded') : err(pm.message);

  // 7. Tasks
  sec('7. Tasks');
  const tasks = await r('GET', '/tasks', null, t);
  if (tasks.success) {
    ok('Tasks: ' + tasks.data.tasks.length + ' available, daily limit ' + tasks.data.stats.daily_limit);
    const task = tasks.data.tasks.find(tk => !tk.is_completed);
    if (task) {
      const start = await r('POST', '/tasks/' + task.id + '/start', {}, t);
      if (start.success) {
        ok('Task started: ' + task.title);
        const done = await r('POST', '/tasks/' + task.id + '/complete', {
          session_id: start.data.session_id,
          watch_duration_seconds: task.duration_seconds || 30
        }, t);
        done.success ? ok('Task reward: +' + done.data.reward_usdt + ' USDT') : err('Complete: ' + done.message);
      } else err('Start: ' + start.message);
    }
  } else err('Tasks: ' + tasks.message);

  // 8. VIP
  sec('8. VIP System');
  const vl = await r('GET', '/vip/levels', null, t);
  vl.success ? ok('VIP tiers: ' + vl.data.length + ' levels loaded') : err(vl.message);
  const vs = await r('GET', '/vip/status', null, t);
  vs.success ? ok('VIP: Level ' + vs.data.current_level + ', ' + vs.data.progress_pct + '% to next') : err(vs.message);

  // 9. Referral
  sec('9. Referral System');
  const ref = await r('GET', '/referral/info', null, t);
  ref.success ? ok('Referral link: ' + ref.data.referral_link) : err(ref.message);

  // 10. Notifications
  sec('10. Notifications');
  const notifs = await r('GET', '/notifications', null, t);
  notifs.success
    ? ok(notifs.data.notifications.length + ' notifications, ' + notifs.data.unread_count + ' unread')
    : err(notifs.message);

  // 11. KYC gate
  sec('11. KYC Gate on Withdrawal');
  const wd = await r('POST', '/wallet/withdraw', {
    amount_usdt: 10, payment_method: 'jazzcash',
    account_number: '03001234567', account_name: 'Test'
  }, t);
  wd._status === 403 ? ok('Withdrawal blocked without KYC (403 correct)') : err('Expected 403, got ' + wd._status + ': ' + wd.message);

  // 12. Admin
  if (adminToken) await runAdminTests(adminToken, t);

  console.log('\n' + '='.repeat(50));
  console.log('  All tests complete!');
  console.log('='.repeat(50) + '\n');
})().catch(e => console.error('Fatal:', e.message));

async function runAdminTests(adminToken, userToken) {
  const ok  = (m) => console.log('  \u2705 ' + m);
  const err = (m) => console.log('  \u274C ' + m);
  console.log('\n--- 12. Admin Panel ---');
  ok('Admin login already verified');

  const dash = await r('GET', '/admin/dashboard', null, adminToken);
  dash.success
    ? ok('Dashboard: ' + dash.data.stats.total_users + ' users, ' +
        dash.data.stats.pending_deposits + ' pending deposits')
    : err('Dashboard: ' + dash.message);

  if (userToken) {
    const blocked = await r('GET', '/admin/dashboard', null, userToken);
    blocked._status === 401
      ? ok('User token blocked from admin (401 correct)')
      : err('Expected 401, got ' + blocked._status);
  }

  const vips = await r('GET', '/admin/vip-levels', null, adminToken);
  vips.success ? ok('Admin VIP management: ' + vips.data.length + ' levels') : err(vips.message);

  const pms = await r('GET', '/admin/payment-methods', null, adminToken);
  pms.success ? ok('Admin payment methods: ' + pms.data.length + ' methods') : err(pms.message);
}
