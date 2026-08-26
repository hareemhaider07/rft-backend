// Check if spin route is accessible
// Run: node scripts/check-spin-route.js
const BASE = 'https://rft-backend-production.up.railway.app/api';

fetch(BASE + '/spin/prizes', {
  headers: { 'Authorization': 'Bearer fake_token_to_test_route' }
})
.then(r => { console.log('HTTP Status:', r.status); return r.json(); })
.then(d => console.log('Response:', JSON.stringify(d)))
.catch(e => console.log('Error:', e.message));
