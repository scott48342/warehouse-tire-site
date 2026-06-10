import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });
const q = async (s, p) => (await pool.query(s, p)).rows;

// Equivalence classes: vehicles with identical product-search inputs
console.log('distinct (bolt, bore):', (await q(`SELECT COUNT(*)::int n FROM (SELECT DISTINCT bolt_pattern, center_bore_mm FROM vehicle_fitments WHERE certification_status='certified') x`))[0].n);
console.log('distinct (bolt, wheelsizes, tiresizes):', (await q(`SELECT COUNT(*)::int n FROM (SELECT DISTINCT bolt_pattern, oem_wheel_sizes::text, oem_tire_sizes::text FROM vehicle_fitments WHERE certification_status='certified') x`))[0].n);

// Sample a few rows to see JSON shapes
const sample = await q(`SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes::text ws, oem_tire_sizes::text ts FROM vehicle_fitments WHERE certification_status='certified' LIMIT 5`);
for (const r of sample) console.log(JSON.stringify(r));

// Parse individual tire sizes
const sizes = await q(`SELECT DISTINCT jsonb_array_elements_text(oem_tire_sizes::jsonb) sz FROM vehicle_fitments WHERE certification_status='certified' AND jsonb_typeof(oem_tire_sizes::jsonb)='array'`);
console.log('distinct individual tire sizes:', sizes.length);

const diams = await q(`SELECT DISTINCT bolt_pattern, jsonb_array_elements_text(oem_wheel_sizes::jsonb) ws FROM vehicle_fitments WHERE certification_status='certified' AND jsonb_typeof(oem_wheel_sizes::jsonb)='array'`);
console.log('distinct (bolt, wheel-size-entry):', diams.length);
console.log('wheel size entry samples:', diams.slice(0, 8).map(d => `${d.bolt_pattern}|${d.ws}`));

// Null/empty json handling
console.log('non-array tire json:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND (oem_tire_sizes IS NULL OR jsonb_typeof(oem_tire_sizes::jsonb) <> 'array' OR jsonb_array_length(oem_tire_sizes::jsonb)=0)`))[0].n);
console.log('non-array wheel json:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND (oem_wheel_sizes IS NULL OR jsonb_typeof(oem_wheel_sizes::jsonb) <> 'array' OR jsonb_array_length(oem_wheel_sizes::jsonb)=0)`))[0].n);
await pool.end();
