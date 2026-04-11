import http from 'node:http';

const url = 'http://localhost:3001/api/wheels/fitment-search?year=2024&make=Ford&model=F-150&debug=1&pageSize=50';

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('API Status:', res.statusCode);
      console.log('Total results:', json.totalCount || 0);
      console.log('\nFitment info:');
      console.log('  boltPattern:', json.fitment?.boltPattern);
      console.log('  vehicleType:', json.fitment?.vehicleType);
      console.log('  staggeredInfo:', json.fitment?.staggeredInfo);
      
      // Look for XD wheels
      const xdWheels = (json.results || []).filter(w => 
        (w.brand || '').toLowerCase().includes('xd') || 
        (w.model || '').toLowerCase().includes('xd860') ||
        (w.model || '').toLowerCase().includes('legacy')
      );
      
      console.log('\nXD/Legacy wheels in results:', xdWheels.length);
      
      // Show first few wheels with their guidance
      console.log('\nFirst 10 wheels with guidance status:');
      (json.results || []).slice(0, 10).forEach((w, i) => {
        console.log(`${i+1}. ${w.brand} ${w.model}`);
        console.log(`   Size: ${w.diameter}"x${w.width}" offset ${w.offset}`);
        if (w.fitmentGuidance) {
          console.log(`   ✅ Guidance: ${w.fitmentGuidance.levelLabel} / ${w.fitmentGuidance.buildLabel}`);
        } else {
          console.log(`   ❌ No guidance!`);
        }
      });
      
      // Show XD wheels with guidance
      if (xdWheels.length > 0) {
        console.log('\n--- XD/Legacy wheels ---');
        xdWheels.slice(0, 5).forEach((w, i) => {
          console.log(`${i+1}. ${w.brand} ${w.model}`);
          console.log(`   Size: ${w.diameter}"x${w.width}" offset ${w.offset}`);
          if (w.fitmentGuidance) {
            console.log(`   ✅ Guidance: ${w.fitmentGuidance.levelLabel} / ${w.fitmentGuidance.buildLabel}`);
          } else {
            console.log(`   ❌ No guidance!`);
          }
        });
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw response:', data.slice(0, 1000));
    }
  });
}).on('error', e => {
  console.error('Request failed:', e.message);
  console.log('\nIs the dev server running on port 3001?');
  console.log('Try: cd "C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site" && npm run dev');
});
