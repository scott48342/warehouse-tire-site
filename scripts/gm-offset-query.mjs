import pg from 'pg';
import { readFileSync } from 'fs';

const envContent = readFileSync('C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match[1];

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const result = await pool.query(`
  SELECT make, model, MIN(year) year_from, MAX(year) year_to, COUNT(*) cnt,
         bolt_pattern, center_bore_mm,
         (SELECT oem_wheel_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_wheel_sizes != '[]'::jsonb LIMIT 1) wheels,
         (SELECT oem_tire_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_tire_sizes != '[]'::jsonb LIMIT 1) tires
  FROM vehicle_fitments vf
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('chevrolet','gmc','buick','cadillac','pontiac','oldsmobile',
                        'amc','saturn','international','saab','volvo','mitsubishi','isuzu',
                        'daewoo','suzuki','karma','lucid','rivian','smart','fiat',
                        'ferrari','mclaren','lotus','aston martin','rolls-royce','alfa romeo')
  GROUP BY make, model, bolt_pattern, center_bore_mm
  ORDER BY make, model, year_from
`);

console.log(JSON.stringify(result.rows, null, 2));
await pool.end();
