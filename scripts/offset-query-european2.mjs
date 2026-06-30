import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const pool = new pg.Pool({ connectionString: env.POSTGRES_URL });

const { rows } = await pool.query(`
  SELECT make, model, MIN(year) year_from, MAX(year) year_to, COUNT(*) cnt,
         bolt_pattern, center_bore_mm,
         (SELECT oem_wheel_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_wheel_sizes != '[]'::jsonb LIMIT 1) wheels,
         (SELECT oem_tire_sizes::text FROM vehicle_fitments v2 
          WHERE v2.make=vf.make AND v2.model=vf.model AND v2.oem_tire_sizes != '[]'::jsonb LIMIT 1) tires
  FROM vehicle_fitments vf
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('mercedes-benz','mercedes','mercedes-benz vans','bmw','audi','porsche',
                        'volkswagen','jaguar','land rover','maserati','alfa romeo','ferrari',
                        'aston martin','lotus','mclaren','rolls-royce','fiat','volvo','saab','smart')
  GROUP BY make, model, bolt_pattern, center_bore_mm
  ORDER BY make, model, year_from
`);

writeFileSync(resolve(__dirname, 'european-vehicles-raw.json'), JSON.stringify(rows, null, 2));
process.stdout.write(`Written ${rows.length} groups\n`);
await pool.end();
