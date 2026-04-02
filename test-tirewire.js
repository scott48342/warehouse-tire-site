require('dotenv').config({ path: '.env.local' });
const { searchTiresTirewire } = require('./src/lib/tirewire/client.ts');

(async () => {
  console.log('Testing Tirewire API for 195/60R15...');
  try {
    const results = await searchTiresTirewire('195/60R15');
    console.log('Results count:', results.length);
    for (const r of results) {
      console.log('  Provider:', r.provider);
      console.log('    Tires:', r.tires.length);
      console.log('    Unmapped:', r.unmappedCount);
      console.log('    Message:', r.message || 'none');
    }
    if (results.length > 0 && results[0].tires.length > 0) {
      console.log('\nFirst tire:');
      console.log(JSON.stringify(results[0].tires[0], null, 2));
    }
  } catch (e) {
    console.error('Error:', e);
  }
})();
