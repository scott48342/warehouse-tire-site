// Debug script to check fitment data
import 'dotenv/config';
import pg from 'pg';

const connStr = process.env.POSTGRES_URL;

// Match the SSL config from db.ts
const sslConfig = connStr?.includes('sslmode=require') 
  ? { rejectUnauthorized: false } 
  : undefined;

const pool = new pg.Pool({
  connectionString: connStr,
  ssl: sslConfig,
});

async function main() {
  const year = process.argv[2] || '2024';
  const make = process.argv[3] || 'Ford';
  const model = process.argv[4] || 'Mustang';
  
  console.log(`\n=== Checking fitment data for ${year} ${make} ${model} ===\n`);
  
  const { rows } = await pool.query(`
    SELECT 
      modification_id,
      display_trim,
      oem_tire_sizes,
      certification_status
    FROM vehicle_fitments 
    WHERE year = $1 
      AND lower(make) = lower($2)
      AND lower(model) LIKE '%' || lower($3) || '%'
    ORDER BY display_trim
    LIMIT 20
  `, [year, make, model]);
  
  console.log(`Found ${rows.length} fitment records:\n`);
  
  for (const row of rows) {
    console.log(`modificationId: "${row.modification_id}"`);
    console.log(`displayTrim:    "${row.display_trim}"`);
    console.log(`tireSizes:      ${JSON.stringify(row.oem_tire_sizes)}`);
    console.log(`certification:  ${row.certification_status}`);
    console.log('---');
  }
  
  await pool.end();
}

main().catch(console.error);
