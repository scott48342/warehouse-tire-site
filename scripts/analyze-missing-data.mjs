import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

console.log('=== MISSING DATA ANALYSIS ===\n');

// Missing by source
console.log('--- Missing Tires by Source ---');
const bySource = await pool.query(`
  SELECT source, COUNT(*) as count
  FROM vehicle_fitments
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  GROUP BY source
  ORDER BY count DESC
  LIMIT 15
`);
bySource.rows.forEach(r => console.log(`  ${r.source}: ${r.count}`));

// What sources have good wheel data?
console.log('\n--- Sources with GOOD wheel data (has oem_wheel_sizes) ---');
const goodWheels = await pool.query(`
  SELECT source, COUNT(*) as count,
    AVG(jsonb_array_length(COALESCE(oem_wheel_sizes, '[]'::jsonb))) as avg_wheel_count
  FROM vehicle_fitments
  WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text != '[]'
  GROUP BY source
  ORDER BY count DESC
  LIMIT 15
`);
goodWheels.rows.forEach(r => console.log(`  ${r.source}: ${r.count} (avg ${parseFloat(r.avg_wheel_count).toFixed(1)} wheel specs/record)`));

// Sample records with wheel data
console.log('\n--- Sample records WITH wheel data ---');
const samples = await pool.query(`
  SELECT year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, source
  FROM vehicle_fitments
  WHERE oem_wheel_sizes IS NOT NULL 
    AND oem_wheel_sizes::text != '[]'
    AND jsonb_array_length(oem_wheel_sizes) > 0
  ORDER BY random()
  LIMIT 5
`);
samples.rows.forEach(r => {
  console.log(`\n  ${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
  console.log(`    Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
  console.log(`    Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log(`    Source: ${r.source}`);
});

// Check catalog-gap-fill records specifically
console.log('\n\n--- CATALOG-GAP-FILL Records ---');
const gapFill = await pool.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_tires,
    SUM(CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN 1 ELSE 0 END) as missing_wheels
  FROM vehicle_fitments
  WHERE source = 'catalog-gap-fill'
`);
const g = gapFill.rows[0];
console.log(`  Total: ${g.total}`);
console.log(`  Missing tires: ${g.missing_tires} (${(g.missing_tires/g.total*100).toFixed(1)}%)`);
console.log(`  Missing wheels: ${g.missing_wheels} (${(g.missing_wheels/g.total*100).toFixed(1)}%)`);

// Sample catalog-gap-fill
console.log('\n  Sample catalog-gap-fill records:');
const gapSamples = await pool.query(`
  SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, oem_tire_sizes
  FROM vehicle_fitments
  WHERE source = 'catalog-gap-fill'
  ORDER BY random()
  LIMIT 10
`);
gapSamples.rows.forEach(r => {
  const tires = r.oem_tire_sizes || [];
  console.log(`    ${r.year} ${r.make} ${r.model}: ${r.bolt_pattern}, ${r.center_bore_mm}mm | tires: ${tires.length > 0 ? tires.join(', ') : 'NONE'}`);
});

pool.end();
