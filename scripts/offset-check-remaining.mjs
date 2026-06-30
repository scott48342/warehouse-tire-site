import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check remaining nulls for all assigned makes
const res = await pool.query(`
  SELECT make, model, year, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, offset_min_mm, offset_max_mm
  FROM vehicle_fitments
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('toyota','lexus','honda','acura','nissan','infiniti','mazda','subaru',
                        'hyundai','kia','mitsubishi','isuzu','daewoo','suzuki','genesis',
                        'tesla','rivian','lucid','karma')
  ORDER BY make, model, year
`);

console.log('Remaining null offset records:');
for (const row of res.rows) {
  console.log(`  ${row.make} ${row.model} ${row.year} | ${row.bolt_pattern} | wheels: ${JSON.stringify(row.oem_wheel_sizes)}`);
}
console.log(`\nTotal: ${res.rows.length}`);

await pool.end();
