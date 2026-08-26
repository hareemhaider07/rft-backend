// Debug spin prizes endpoint
// Run: node scripts/debug-spin.js
const BASE = 'https://rft-backend-production.up.railway.app/api';

// First login to get a token
fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email_or_phone: 'test@rft.com', password: 'Test1234' })
})
.then(r => r.json())
.then(async login => {
  const token = login.data?.accessToken || login.data?.access_token;
  if (!token) { console.log('LOGIN FAILED:', JSON.stringify(login)); return; }
  console.log('Login OK, token:', token.slice(0, 20) + '...');

  // Test spin prizes
  const prizes = await fetch(BASE + '/spin/prizes', {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(r => r.json());
  console.log('\nSPIN PRIZES RESPONSE:');
  console.log(JSON.stringify(prizes, null, 2));
})
.catch(e => console.log('ERROR:', e.message));
