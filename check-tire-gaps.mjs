import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const result = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text != '' AND oem_tire_sizes::text != '[]') as with_tires,
    COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]') as without_tires
  FROM vehicle_fitments
`);

const { total, with_tires, without_tires } = result.rows[0];
console.log('Total fitments:', total);
console.log('With tire sizes:', with_tires);
console.log('Missing tire sizes:', without_tires);
console.log('Coverage %:', ((Number(with_tires) / Number(total)) * 100).toFixed(1) + '%');

// Sample some vehicles missing tire data
const samples = await pool.query(`
  SELECT DISTINCT year, make, model, display_trim
  FROM vehicle_fitments
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]'
  ORDER BY make, model, year
  LIMIT 30
`);

console.log('\nSample vehicles missing tire sizes:');
samples.rows.forEach(s => console.log(`  ${s.year} ${s.make} ${s.model} ${s.display_trim || '(base)'}`));

await pool.end();
