import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });

const q = async (s, p) => (await pool.query(s, p)).rows;

console.log('certified records:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified'`))[0].n);
const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='vehicle_fitments' ORDER BY ordinal_position`);
console.log('columns:', cols.map(c => c.column_name).join(', '));
console.log('non-certified:', (await q(`SELECT certification_status, COUNT(*)::int n FROM vehicle_fitments GROUP BY 1 ORDER BY 2 DESC`)));

console.log('distinct oem tire size strings:', (await q(`SELECT COUNT(DISTINCT oem_tire_sizes)::int n FROM vehicle_fitments WHERE certification_status='certified'`))[0].n);
console.log('distinct bolt patterns:', (await q(`SELECT COUNT(DISTINCT bolt_pattern)::int n FROM vehicle_fitments WHERE certification_status='certified'`))[0].n);
console.log('missing bolt:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND (bolt_pattern IS NULL OR bolt_pattern='')`))[0].n);
console.log('missing tire sizes:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND (oem_tire_sizes IS NULL OR oem_tire_sizes='' OR oem_tire_sizes='[]')`))[0].n);
console.log('missing center bore:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND center_bore_mm IS NULL`))[0].n);
console.log('missing wheel sizes:', (await q(`SELECT COUNT(*)::int n FROM vehicle_fitments WHERE certification_status='certified' AND (oem_wheel_sizes IS NULL OR oem_wheel_sizes='' OR oem_wheel_sizes='[]')`))[0].n);


await pool.end();
