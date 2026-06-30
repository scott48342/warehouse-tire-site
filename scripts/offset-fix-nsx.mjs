import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Acura NSX Gen 1 (1991-1993): front ET50 / rear ET50 → car range ET50 → [35,55]
// Acura NSX Gen 1 (1994-1999): front ET55 / rear ET55 → car range ET55 → [40,55]
// Acura NSX Gen 2 (2018): 5x120 staggered, OEM ~ET45 (researched) → car range → [30,55]

const fixes = [
  { yearFrom: 1991, yearTo: 1993, oemOffset: 50, min: 35, max: 55, note: 'Gen1 early, ET50 front/rear' },
  { yearFrom: 1994, yearTo: 1999, oemOffset: 55, min: 40, max: 55, note: 'Gen1 late, ET55 front/rear' },
  { yearFrom: 2018, yearTo: 2018, oemOffset: 45, min: 30, max: 55, note: 'Gen2 2018, 5x120, ET45 researched' },
];

let totalUpdated = 0;
for (const fix of fixes) {
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET offset_min_mm = $1,
        offset_max_mm = $2,
        thread_size = COALESCE(thread_size, 'M12x1.5'),
        updated_at = NOW()
    WHERE LOWER(make) = 'acura'
      AND LOWER(model) = 'nsx'
      AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
      AND year BETWEEN $3 AND $4
  `, [fix.min, fix.max, fix.yearFrom, fix.yearTo]);

  console.log(`✅ Acura NSX ${fix.yearFrom}-${fix.yearTo}: ET${fix.oemOffset} → [${fix.min}, ${fix.max}] (${result.rowCount} rows) — ${fix.note}`);
  totalUpdated += result.rowCount;
}

console.log(`\nTotal additional rows updated: ${totalUpdated}`);

// Final verification
const verify = await pool.query(`
  SELECT COUNT(*) remaining
  FROM vehicle_fitments
  WHERE (offset_min_mm IS NULL OR offset_max_mm IS NULL)
    AND LOWER(make) IN ('toyota','lexus','honda','acura','nissan','infiniti','mazda','subaru',
                        'hyundai','kia','mitsubishi','isuzu','daewoo','suzuki','genesis',
                        'tesla','rivian','lucid','karma')
`);
console.log(`\nFinal remaining nulls (all assigned makes): ${verify.rows[0].remaining}`);

// Append to existing log
const logPath = join(__dirname, 'offset-research-japanese.json');
const log = JSON.parse(readFileSync(logPath, 'utf8'));
log.nsx_fix = {
  timestamp: new Date().toISOString(),
  rowsUpdated: totalUpdated,
  fixes,
  finalRemainingNulls: parseInt(verify.rows[0].remaining)
};
log.summary.updated += totalUpdated;
log.totalRemainingNulls = parseInt(verify.rows[0].remaining);
writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log('Log updated.');

await pool.end();
