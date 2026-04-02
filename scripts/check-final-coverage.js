const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Check silverado and sierra (with both naming conventions)
  const checks = [
    ['chevrolet', 'silverado-1500'],
    ['chevrolet', 'silverado 1500'],
    ['gmc', 'sierra-1500'],
    ['gmc', 'sierra 1500'],
    ['jeep', 'grand-cherokee'],
    ['jeep', 'grand cherokee'],
    ['jeep', 'liberty'],
    ['toyota', 'land-cruiser'],
    ['toyota', 'land cruiser'],
    ['toyota', 'fj-cruiser'],
    ['ford', 'fiesta'],
    ['honda', 'insight'],
    ['hyundai', 'ioniq'],
    ['chevrolet', 'blazer'],
    ['chevrolet', 'trailblazer'],
    ['cadillac', 'escalade'],
  ];
  
  console.log('=== HIGH VOLUME VEHICLE COVERAGE ===\n');
  
  for (const [make, model] of checks) {
    const res = await pool.query(
      `SELECT MIN(year) as min_yr, MAX(year) as max_yr, COUNT(DISTINCT year) as cnt, 
              array_agg(DISTINCT year ORDER BY year) as years
       FROM vehicle_fitments WHERE make = $1 AND model = $2`,
      [make, model]
    );
    const row = res.rows[0];
    if (row.cnt && row.cnt > 0) {
      console.log(`${make} ${model}: ${row.min_yr}-${row.max_yr} (${row.cnt} years)`);
    } else {
      console.log(`${make} ${model}: NOT FOUND`);
    }
  }
  
  // Total stats
  const total = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  const makes = await pool.query('SELECT COUNT(DISTINCT make) as cnt FROM vehicle_fitments');
  const models = await pool.query('SELECT COUNT(DISTINCT make || model) as cnt FROM vehicle_fitments');
  
  console.log('\n=== TOTALS ===');
  console.log(`Total records: ${total.rows[0].cnt}`);
  console.log(`Unique makes: ${makes.rows[0].cnt}`);
  console.log(`Unique make+models: ${models.rows[0].cnt}`);
  
  await pool.end();
}

check();
