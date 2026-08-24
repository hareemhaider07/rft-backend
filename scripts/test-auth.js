/**
 * RFT Entertainment — Auth & API Test Script
 * Run: node backend/scripts/test-auth.js
 */

const BASE = 'https://rft-backend-production.up.railway.app/api';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await r.json();
  return { status: r.status, ...json };
}

function pass(msg) { console.log(`  ✅ PASS — ${msg}`); }
function fail(msg) { console.log(`  ❌ FAIL — ${msg}`); }
function section(msg) { console.log(`\n${'─'.repeat(50)}\n  ${msg}\n${'─'.repeat(50)}`); }

async function run() {
  console.log(`\n🧪 RFT Entertainment — Live API Test`);
  console.log(`   Backend: ${BASE}\n`);

  // ── 1. Health ────────────────────────────────────────────
  section('1. Health Check');
  const health = await req('GET', '/../health');
  health.status === 'ok' ? pass('Health endpoint returns ok') : fail(`Health: ${JSON.stringify(health)}`);

  // ── 2. Register ──────────────────────────────────────────
  section('2. Registration');
  const testEmail = `test_${Date.now()}@rft.com`;
  const testPhone = `031${Date.now().toString().slice(-8)}`;
  const reg = await req('POST', '/auth/register', {
    name: 'Test User', email: testEmail, phone: testPhone, password: 'Test1234'
  });
  reg.success ? pass(`Registered: ${reg.data?.user?.email}`) : fail(`Register: ${reg.message}`);
  const accessToken = reg.data?.accessToken;
  const userId = reg.data?.user?.id;
  const refCode = reg.data?.user?.referral_code;

  if (!accessToken) {
    fail('No access token received — stopping tests');
    return;
  }
  pass(`Access token received (${accessToken.substring(0,20)}...)`);
  pass(`Referral code: ${refCode}`);

  // ── 3. Login ─────────────────────────────────────────────
  section('3. Login');
  const login = await req('POST', '/auth/login', {
    email_or_phone: testEmail, password: 'Test1234'
  });
  login.success ? pass(`Login OK: ${login.data?.user?.email}`) : fail(`Login: ${login.message}`);
  const loginToken = login.data?.accessToken || accessToken;

  // ── 4. Protected route — profile ─────────────────────────
  section('4. Authorization (JWT Protected Routes)');
  const profile = await req('GET', '/user/profile', null, loginToken);
  profile.success ? pass(`Profile fetch OK: ${profile.data?.name}`) : fail(`Profile: ${profile.message}`);

  // ── 5. No token → should fail ────────────────────────────
  const noToken = await req('GET', '/user/profile');
  noToken.status === 401 ? pass('Unauthenticated request correctly blocked (401)') : fail(`Expected 401, got ${noToken.status}`);

  // ── 6. Wallet balance ────────────────────────────────────
  section('5. Wallet');
  const bal = await req('GET', '/wallet/balance', null, loginToken);
  bal.success ? pass(`Balance: ${bal.data?.balance_usdt} USDT`) : fail(`Balance: ${bal.message}`);

  // ── 7. Payment methods ───────────────────────────────────
  const pm = await req('GET', '/wallet/payment-info', null, loginToken);
  pm.success ? pass(`Payment methods: ${pm.data?.length} loaded`) : fail(`Payment info: ${pm.message}`);

  // ── 8. Tasks ─────────────────────────────────────────────
  section('6. Tasks');
  const tasks = await req('GET', '/tasks', null, loginToken);
  tasks.success ? pass(`Tasks loaded: ${tasks.data?.tasks?.length} tasks available`) : fail(`Tasks: ${tasks.message}`);

  if (tasks.data?.tasks?.length > 0) {
    const task = tasks.data.tasks[0];
    const start = await req('POST', `/tasks/${task.id}/start`, {}, loginToken);
    start.success ? pass(`Task start OK: session ${start.data?.session_id?.substring(0,10)}...`) : fail(`Task start: ${start.message}`);

    if (start.success) {
      const complete = await req('POST', `/tasks/${task.id}/complete`, {
        session_id: start.data.session_id,
        watch_duration_seconds: task.duration_seconds || 30
      }, loginToken);
      complete.success
        ? pass(`Task complete OK: +${complete.data?.reward_usdt} USDT earned`)
        : fail(`Task complete: ${complete.message}`);
    }
  }

  // ── 9. VIP ───────────────────────────────────────────────
  section('7. VIP System');
  const vipLevels = await req('GET', '/vip/levels', null, loginToken);
  vipLevels.success ? pass(`VIP levels: ${vipLevels.data?.length} tiers loaded`) : fail(`VIP levels: ${vipLevels.message}`);

  const vipStatus = await req('GET', '/vip/status', null, loginToken);
  vipStatus.success ? pass(`VIP status: Level ${vipStatus.data?.current_level}`) : fail(`VIP status: ${vipStatus.message}`);

  // ── 10. Referral ─────────────────────────────────────────
  section('8. Referral System');
  const refInfo = await req('GET', '/referral/info', null, loginToken);
  refInfo.success ? pass(`Referral link: ${refInfo.data?.referral_link}`) : fail(`Referral info: ${refInfo.message}`);

  // ── 11. Notifications ────────────────────────────────────
  section('9. Notifications');
  const notifs = await req('GET', '/notifications', null, loginToken);
  notifs.success ? pass(`Notifications: ${notifs.data?.notifications?.length} received`) : fail(`Notifications: ${notifs.message}`);

  // ── 12. Withdraw without KYC → should fail ───────────────
  section('10. KYC Gate on Withdrawal');
  const wd = await req('POST', '/wallet/withdraw', {
    amount_usdt: 10, payment_method: 'jazzcash',
    account_number: '03001234567', account_name: 'Test'
  }, loginToken);
  wd.status === 403 ? pass('Withdrawal correctly blocked without KYC (403)') : fail(`Expected 403 KYC block, got: ${wd.message}`);

  // ── 13. Admin login ──────────────────────────────────────
  section('11. Admin Authentication');
  const adminLogin = await req('POST', '/admin/auth/login', {
    username: 'admin', password: 'Admin1234'
  });
  adminLogin.success ? pass('Admin login OK') : fail(`Admin login: ${adminLogin.message}`);

  const adminToken = adminLogin.data?.access_token;
  if (adminToken) {
    const dash = await req('GET', '/admin/dashboard', null, adminToken);
    dash.success ? pass(`Admin dashboard OK: ${dash.data?.stats?.total_users} users`) : fail(`Dashboard: ${dash.message}`);

    // Non-admin token should not access admin routes
    const unauth = await req('GET', '/admin/dashboard', null, loginToken);
    unauth.status === 401 ? pass('User token correctly blocked from admin routes (401)') : fail(`Expected 401, got ${unauth.status}`);
  }

  // ── Summary ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('  🎉 All tests complete!');
  console.log('═'.repeat(50) + '\n');
}

run().catch(err => {
  console.error('Test script error:', err.message);
  process.exit(1);
});
