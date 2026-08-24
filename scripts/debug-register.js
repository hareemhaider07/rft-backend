// Run: node scripts/debug-register.js
// Tests register and shows FULL error response
const s = Date.now();
console.log('Testing register...');
fetch('https://rft-backend-production.up.railway.app/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Debug User',
    email: 'd' + s + '@test.com',
    phone: '031' + s.toString().slice(-8),
    password: 'Test1234'
  })
})
.then(r => { console.log('HTTP Status:', r.status); return r.json(); })
.then(d => { console.log('FULL RESPONSE:\n' + JSON.stringify(d, null, 2)); process.exit(0); })
.catch(e => { console.log('FETCH ERROR:', e.message); process.exit(1); });
