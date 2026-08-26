// RFT Entertainment — Full Live Verification
// Tests every major endpoint that was recently added/fixed
// Run: node scripts/verify-live.js

const BASE = 'https://rft-backend-production.up.railway.app/api';
const TIMEOUT = 12000;

async function r(method, path, body, token) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    clearTimeout(t);
    return { _status: res.status, ...(await res.json()) };
  } catch (e) {
    clearTimeout(t);
    return { _status: 0, success: false, message: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  }
}

const ok  = (m) => console.log('  ✅ ' + m);
const err = (m) => console.log('  ❌ ' + m);
const sec = (m) => console.log('\n─── ' + m + ' ───');

(async () => {
  console.log('\nRFT Entertainment — Live Verification\n');

  // 1. Health
  sec('Health & Config');
  const h = await r('GET', '/../health');
  h.status === 'ok' ? ok('Health OK') : err('Health: ' + JSON.stringify(h));

  const cfg = await r('GET', '/config');
  if (cfg.success) {
    ok('Config OK — storage_enabled: ' + cfg.data.storage_enabled);
    ok('PKR rate: ' + cfg.data.pkr_rate);
  } else err('Config: ' + cfg.message);

  // 2. Admin login (wakes DB)
  sec('Admin Login (DB Wake-up)');
  const adm = await r('POST', '/admin/auth/login', { username: 'admin', password: 'Admin1234' });
  const adminToken = adm.data?.access_token;
  adm.success ? ok('Admin login OK') : err('Admin login: ' + adm.message);

  if (!adm.success) {
    err('Cannot proceed without admin token');
    return;
  }

  // 3. Register test user
  sec('Auth — Register & Login');
  const stamp = Date.now();
  const reg = await r('POST', '/auth/register', {
    name: 'Verify User', email: 'verify_' + stamp + '@rft.com',
    phone: '031' + stamp.toString().slice(-8), password: 'Test1234'
  });
  const token = reg.data?.accessToken || reg.data?.access_token;
  reg.success ? ok('Register OK — token: ' + (token ? token.slice(0,15)+'...' : 'MISSING ❌')) : err('Register: ' + reg.message);

  if (!token) { err('No token — skipping user tests'); }

  // 4. Check token works
  if (token) {
    sec('JWT Authorization');
    const prof = await r('GET', '/user/profile', null, token);
    prof.success ? ok('Profile OK: ' + prof.data.name) : err('Profile: ' + prof.message);

    const noAuth = await r('GET', '/user/profile');
    noAuth._status === 401 ? ok('Unauth blocked correctly (401)') : err('Expected 401, got ' + noAuth._status);
  }

  // 5. Spin wheel — the key test
  sec('Lucky Draw / Spin Wheel');
  const spinRoute = await r('GET', '/spin/prizes', null, token);
  if (spinRoute._status === 404) {
    err('SPIN ROUTE NOT FOUND (404) — spin not mounted in server.js or not deployed');
  } else if (spinRoute.success) {
    ok('Spin prizes loaded: ' + spinRoute.data.prizes.length + ' prizes');
    ok('Spins remaining: ' + spinRoute.data.spins_remaining);
    ok('VIP level: ' + spinRoute.data.vip_level);

    // Try a spin
    const spin = await r('POST', '/spin/spin', {}, token);
    if (spin.success) {
      ok('Spin result: ' + spin.data.prize.name + ' (' + spin.data.prize.prize_type + ')');
      ok('New balance: ' + spin.data.new_balance_usdt + ' USDT');
    } else {
      err('Spin: ' + spin.message);
    }
  } else {
    err('Spin prizes: ' + spinRoute.message + ' (status: ' + spinRoute._status + ')');
  }

  // 6. Tasks
  sec('Tasks');
  if (token) {
    const tasks = await r('GET', '/tasks', null, token);
    tasks.success ? ok('Tasks: ' + tasks.data.tasks.length + ' loaded') : err('Tasks: ' + tasks.message);
  }

  // 7. VIP
  sec('VIP System');
  if (token) {
    const vip = await r('GET', '/vip/levels', null, token);
    vip.success ? ok('VIP levels: ' + vip.data.length + ' tiers') : err('VIP: ' + vip.message);
  }

  // 8. Referral
  sec('Referral');
  if (token) {
    const ref = await r('GET', '/referral/info', null, token);
    ref.success ? ok('Referral link: ' + ref.data.referral_link) : err('Referral: ' + ref.message);
  }

  // 9. Notifications + polling
  sec('Notifications & Polling');
  if (token) {
    const notifs = await r('GET', '/notifications', null, token);
    notifs.success ? ok('Notifications: ' + notifs.data.unread_count + ' unread') : err('Notifs: ' + notifs.message);

    const poll = await r('GET', '/notifications/poll?since=' + encodeURIComponent(new Date(0).toISOString()), null, token);
    poll.success ? ok('Poll OK — balance: ' + poll.data.balance.usdt + ' USDT') : err('Poll: ' + poll.message);
  }

  // 10. Wallet
  sec('Wallet');
  if (token) {
    const bal = await r('GET', '/wallet/balance', null, token);
    bal.success ? ok('Balance: ' + bal.data.balance_usdt + ' USDT') : err('Balance: ' + bal.message);

    const pm = await r('GET', '/wallet/payment-info', null, token);
    pm.success ? ok('Payment methods: ' + pm.data.length + ' loaded') : err('Payment info: ' + pm.message);
  }

  // 11. Earnings chart
  sec('Earnings Chart');
  if (token) {
    const chart = await r('GET', '/user/earnings-chart?period=7', null, token);
    chart.success ? ok('Earnings chart OK — ' + chart.data.days.length + ' days, total: ' + chart.data.summary.total_usdt + ' USDT') : err('Chart: ' + chart.message);
  }

  // 12. Leaderboard
  sec('Leaderboard');
  if (token) {
    const lb = await r('GET', '/user/leaderboard?type=weekly', null, token);
    lb.success ? ok('Leaderboard OK — ' + lb.data.leaders.length + ' leaders') : err('Leaderboard: ' + lb.message);
  }

  // 13. Admin dashboard
  sec('Admin Dashboard');
  const dash = await r('GET', '/admin/dashboard', null, adminToken);
  dash.success
    ? ok('Dashboard OK — ' + dash.data.stats.total_users + ' users, pending deposits: ' + dash.data.stats.pending_deposits)
    : err('Dashboard: ' + dash.message);

  const blocked = await r('GET', '/admin/dashboard', null, token);
  blocked._status === 401 ? ok('User token blocked from admin (401)') : err('Expected 401, got ' + blocked._status);

  console.log('\n' + '═'.repeat(50));
  console.log('  Verification complete');
  console.log('═'.repeat(50) + '\n');
})().catch(e => console.error('Fatal:', e.message));
