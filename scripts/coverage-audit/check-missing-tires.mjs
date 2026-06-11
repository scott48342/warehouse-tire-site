/**
 * Investigate vehicles with missing_oem_tire_size root cause
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf-8');
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: m[1], ssl: { rejectUnauthorized: false }, max: 4 });

// Load audit results
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json')));
const missing = results.filter(r => r.root_cause === 'missing_oem_tire_size');

console.log('Total missing_oem_tire_size:', missing.length);

// Get sample IDs
const sampleIds = missing.slice(0, 30).map(r => r.id);

// Query the actual database records
const res = await pool.query(`
  SELECT id, year, make, model, display_trim, raw_trim,
         oem_tire_sizes::text AS tire_sizes_raw,
         oem_wheel_sizes::text AS wheel_sizes_raw,
         bolt_pattern, center_bore_mm,
         source, certification_status, quality_tier
  FROM vehicle_fitments
  WHERE id = ANY($1)
`, [sampleIds]);

console.log('\n=== Sample Database Records ===');
for (const row of res.rows.slice(0, 15)) {
  console.log(JSON.stringify({
    id: row.id,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.display_trim || row.raw_trim,
    tire_sizes_raw: row.tire_sizes_raw,
    wheel_sizes_raw: row.wheel_sizes_raw?.substring(0, 150),
    bolt_pattern: row.bolt_pattern,
    source: row.source,
    quality_tier: row.quality_tier
  }));
}

// Count total vehicles with empty/null oem_tire_sizes
const emptyRes = await pool.query(`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null')
`);
console.log('\n\n=== Certified vehicles with empty oem_tire_sizes ===');
console.log('Count:', emptyRes.rows[0].cnt);

// Breakdown by source
const bySourceRes = await pool.query(`
  SELECT source, COUNT(*) as cnt FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null')
  GROUP BY source
  ORDER BY cnt DESC
`);
console.log('\nBy source:');
for (const row of bySourceRes.rows) {
  console.log('  ' + (row.source || 'NULL') + ': ' + row.cnt);
}

// Breakdown by quality_tier
const byTierRes = await pool.query(`
  SELECT quality_tier, COUNT(*) as cnt FROM vehicle_fitments 
  WHERE certification_status = 'certified'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null')
  GROUP BY quality_tier
  ORDER BY cnt DESC
`);
console.log('\nBy quality_tier:');
for (const row of byTierRes.rows) {
  console.log('  ' + (row.quality_tier || 'NULL') + ': ' + row.cnt);
}

// Get some 2018 BMW M4 records specifically
const m4Res = await pool.query(`
  SELECT id, year, make, model, display_trim,
         oem_tire_sizes::text AS tire_sizes_raw,
         oem_wheel_sizes::text AS wheel_sizes_raw,
         source, quality_tier
  FROM vehicle_fitments
  WHERE year = 2018 AND make = 'BMW' AND model = 'M4'
  LIMIT 5
`);
console.log('\n\n=== 2018 BMW M4 Records ===');
for (const row of m4Res.rows) {
  console.log(JSON.stringify({
    trim: row.display_trim,
    tire_sizes_raw: row.tire_sizes_raw,
    wheel_sizes_raw: row.wheel_sizes_raw?.substring(0, 100),
    source: row.source,
    quality_tier: row.quality_tier
  }));
}

// Check if wheel_sizes has tire info embedded
const wheelCheckRes = await pool.query(`
  SELECT id, year, make, model, display_trim,
         oem_tire_sizes::text AS tire_sizes_raw,
         oem_wheel_sizes::text AS wheel_sizes_raw
  FROM vehicle_fitments
  WHERE certification_status = 'certified'
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null')
    AND oem_wheel_sizes IS NOT NULL
  LIMIT 10
`);
console.log('\n\n=== Check wheel_sizes structure for tire info ===');
for (const row of wheelCheckRes.rows) {
  console.log('\n' + row.year + ' ' + row.make + ' ' + row.model + ' ' + row.display_trim);
  console.log('  tire_sizes:', row.tire_sizes_raw);
  console.log('  wheel_sizes:', row.wheel_sizes_raw);
}

await pool.end();
