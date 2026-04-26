import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  const total = await pool.query("SELECT COUNT(*) as count FROM vehicle_fitments WHERE LOWER(make) = 'toyota'");
  const complete = await pool.query("SELECT COUNT(*) as count FROM vehicle_fitments WHERE LOWER(make) = 'toyota' AND quality_tier = 'complete'");
  const missing = await pool.query("SELECT COUNT(*) as count FROM vehicle_fitments WHERE LOWER(make) = 'toyota' AND (oem_wheel_sizes IS NULL OR oem_tire_sizes IS NULL)");
  
  console.log('=== TOYOTA FITMENT VERIFICATION ===');
  console.log('Total Toyota records:', total.rows[0].count);
  console.log('Records marked complete:', complete.rows[0].count);
  console.log('Records missing data:', missing.rows[0].count);
  console.log('Coverage:', ((Number(complete.rows[0].count) / Number(total.rows[0].count)) * 100).toFixed(1) + '%');
  
  await pool.end();
}
verify().catch(console.error);
