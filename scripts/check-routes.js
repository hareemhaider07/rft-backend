// Quick check — tests which routes exist on the live server
// No auth needed — just checks if endpoints return 401 (exists) vs 404 (missing)
const BASE = 'https://rft-backend-production.up.railway.app/api';

const routes = [
  ['GET',  '/spin/prizes'],
  ['GET',  '/spin/history'],
  ['GET',  '/user/leaderboard'],
  ['GET',  '/user/earnings-chart'],
  ['GET',  '/notifications/poll'],
  ['GET',  '/vip/levels'],
  ['GET',  '/referral/info'],
  ['GET',  '/wallet/payment-info'],
];

(async () => {
  console.log('Checking live routes...\n');
  for (const [method, path] of routes) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { 'Authorization': 'Bearer test', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      const status = res.status;
      const icon = status === 401 ? '✅' : status === 404 ? '❌ NOT FOUND' : '⚠️ ' + status;
      console.log(`  ${icon}  ${method} ${path}`);
    } catch (e) {
      console.log(`  ⏱️  TIMEOUT  ${method} ${path}`);
    }
  }
  console.log('\n401 = route exists (auth required) ✅');
  console.log('404 = route NOT deployed ❌\n');
})();
