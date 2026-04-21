import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const result = await pool.query(`
  SELECT make, COUNT(*) as missing
  FROM vehicle_fitments
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  GROUP BY make
  ORDER BY missing DESC
`);

console.log('Missing by make:');
result.rows.forEach(r => console.log(`  ${r.make}: ${r.missing}`));

// Also show models for top makes
console.log('\n--- Top missing models ---');
const topMakes = result.rows.slice(0, 5).map(r => r.make);
for (const make of topMakes) {
  const models = await pool.query(`
    SELECT model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      AND make = $1
    GROUP BY model
    ORDER BY cnt DESC
    LIMIT 5
  `, [make]);
  console.log(`\n${make}:`);
  models.rows.forEach(m => console.log(`  ${m.model}: ${m.cnt}`));
}

pool.end();
