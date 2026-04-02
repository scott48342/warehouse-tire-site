import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Simple count check
  const q1 = await pool.query(`SELECT COUNT(*) as c FROM catalog_makes`);
  console.log('catalog_makes:', q1.rows[0].c);
  
  const q2 = await pool.query(`SELECT COUNT(*) as c FROM catalog_models`);
  console.log('catalog_models:', q2.rows[0].c);
  
  const q3 = await pool.query(`SELECT COUNT(*) as c FROM vehicle_fitments`);
  console.log('vehicle_fitments:', q3.rows[0].c);
  
  // Ford Mustang in catalog
  const q4 = await pool.query(`SELECT slug, name, years FROM catalog_models WHERE make_slug = 'ford' AND slug LIKE '%mustang%' LIMIT 5`);
  console.log('\nFord Mustang in catalog_models:', q4.rows.length);
  for (const r of q4.rows) {
    console.log(`  ${r.slug}: ${JSON.stringify(r.years).substring(0, 100)}`);
  }
  
  // Ford Mustang in vehicle_fitments  
  const q5 = await pool.query(`SELECT DISTINCT year, model FROM vehicle_fitments WHERE LOWER(make) = 'ford' AND model LIKE '%mustang%'`);
  console.log('\nFord Mustang in vehicle_fitments:', q5.rows.length);
  for (const r of q5.rows) {
    console.log(`  ${r.year} ${r.model}`);
  }

  await pool.end();
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
