import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const res = await pool.query(`
  SELECT make, model, MIN(year) year_from, MAX(year) year_to, COUNT(*) cnt,
         bolt_pattern, center_bore_mm,
         (SELECT oem_wheel_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_wheel_sizes != '[]'::jsonb LIMIT 1) wheels,
         (SELECT oem_tire_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_tire_sizes != '[]'::jsonb LIMIT 1) tires
  FROM vehicle_fitments vf
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('toyota','lexus','honda','acura','nissan','infiniti','mazda','subaru',
                        'hyundai','kia','mitsubishi','isuzu','daewoo','suzuki','genesis',
                        'tesla','rivian','lucid','karma')
  GROUP BY make, model, bolt_pattern, center_bore_mm
  ORDER BY make, model, year_from
`);

console.log(JSON.stringify(res.rows, null, 2));
console.log(`\nTotal groups: ${res.rows.length}`);

// Summary by make
const byMake = {};
for (const row of res.rows) {
  if (!byMake[row.make]) byMake[row.make] = { groups: 0, records: 0 };
  byMake[row.make].groups++;
  byMake[row.make].records += parseInt(row.cnt);
}
console.log('\nSummary by make:');
for (const [make, data] of Object.entries(byMake)) {
  console.log(`  ${make}: ${data.groups} models, ${data.records} records`);
}

await pool.end();
