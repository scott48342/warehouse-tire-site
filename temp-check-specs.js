const pg = require('pg');
const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

(async () => {
  const res = await pool.query(`
    SELECT split_part(pattern_key, ':', 1) as brand, COUNT(*) as cnt 
    FROM tire_pattern_specs 
    GROUP BY split_part(pattern_key, ':', 1)
    ORDER BY cnt DESC
  `);
  console.log('=== Patterns per brand ===');
  res.rows.forEach(r => console.log(r.brand + ': ' + r.cnt));
  console.log('\nTotal:', res.rows.reduce((s,r) => s + parseInt(r.cnt), 0), 'patterns across', res.rows.length, 'brands');
  await pool.end();
})();
