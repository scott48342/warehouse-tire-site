import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const result = await pool.query(`
  SELECT modification_id, display_trim, bolt_pattern, offset_min_mm, offset_max_mm
  FROM vehicle_fitments 
  WHERE year = 2024 AND make = 'Nissan' AND model = 'Frontier'
  ORDER BY display_trim
`);

console.log('2024 Nissan Frontier fitments:');
for (const row of result.rows) {
  console.log(`  ${row.display_trim}: ${row.modification_id} | ${row.bolt_pattern} | offset ${row.offset_min_mm}-${row.offset_max_mm}`);
}

await pool.end();
