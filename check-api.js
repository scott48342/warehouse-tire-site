const https = require('https');
const http = require('http');

// Make request to local API to check wheel data
const url = 'http://localhost:3001/api/wheels/fitment-search?year=2023&make=Ford&model=F-150&debug=1&pageSize=5';

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Total results:', json.totalCount || 0);
      console.log('\nFirst 3 wheels:');
      (json.results || []).slice(0, 3).forEach((w, i) => {
        console.log(`\n${i+1}. ${w.brand} ${w.model}`);
        console.log(`   Size: ${w.diameter}"x${w.width}" offset ${w.offset}`);
        console.log(`   fitmentGuidance:`, w.fitmentGuidance || 'NULL');
      });
    } catch (e) {
      console.log('Raw response:', data.slice(0, 500));
    }
  });
}).on('error', e => {
  console.error('Request failed:', e.message);
});
