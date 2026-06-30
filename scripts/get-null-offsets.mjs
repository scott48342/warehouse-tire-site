import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';

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
  AND LOWER(make) IN ('ford','lincoln','mercury','jeep','ram','dodge','chrysler','plymouth')
GROUP BY make, model, bolt_pattern, center_bore_mm
ORDER BY make, model, year_from
`);

console.log(JSON.stringify(res.rows, null, 2));
await pool.end();
