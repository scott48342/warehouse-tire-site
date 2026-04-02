const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  const models = [
    { make: 'chrysler', model: '300' },
    { make: 'chrysler', model: '300c' },
    { make: 'ford', model: 'mustang' },
    { make: 'chevrolet', model: 'camaro' },
    { make: 'dodge', model: 'challenger' },
    { make: 'dodge', model: 'charger' },
  ];
  
  console.log('='.repeat(70));
  console.log('SPECIAL FOCUS VALIDATION');
  console.log('='.repeat(70));
  
  for (const m of models) {
    const res = await pool.query(
      `SELECT COUNT(*) as cnt, COUNT(DISTINCT year) as years, COUNT(DISTINCT display_trim) as trims 
       FROM vehicle_fitments WHERE make = $1 AND model = $2`,
      [m.make, m.model]
    );
    const r = res.rows[0];
    
    // Years with multi-trim (Class A)
    const multi = await pool.query(
      `SELECT year, COUNT(*) as cnt FROM vehicle_fitments 
       WHERE make = $1 AND model = $2 GROUP BY year HAVING COUNT(*) > 1`,
      [m.make, m.model]
    );
    
    // Years with single trim only (potential gaps)
    const single = await pool.query(
      `SELECT year, COUNT(*) as cnt FROM vehicle_fitments 
       WHERE make = $1 AND model = $2 GROUP BY year HAVING COUNT(*) = 1`,
      [m.make, m.model]
    );
    
    console.log(`\n${m.make.toUpperCase()} ${m.model.toUpperCase()}`);
    console.log(`  Total: ${r.cnt} records, ${r.years} years, ${r.trims} unique trims`);
    console.log(`  ✅ Multi-trim years: ${multi.rows.length}`);
    console.log(`  ⚠️  Single-trim years: ${single.rows.length}`);
    
    if (single.rows.length > 0 && single.rows.length <= 10) {
      const singleYears = single.rows.map(x => x.year).sort((a,b) => b-a).join(', ');
      console.log(`     Single: ${singleYears}`);
    }
  }
  
  await pool.end();
}
main();
