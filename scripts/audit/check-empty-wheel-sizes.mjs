import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Find records with tire sizes but empty wheel sizes
const { rows: emptyWheels } = await pool.query(`
  SELECT 
    source,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes IS NULL) as empty_wheels,
    COUNT(*) FILTER (WHERE oem_tire_sizes != '[]'::jsonb AND oem_tire_sizes IS NOT NULL) as has_tires
  FROM vehicle_fitments
  WHERE year >= 2000
  GROUP BY source
  ORDER BY count DESC
`);

console.log("Records by source (2000+):");
console.log("─".repeat(70));
for (const row of emptyWheels) {
  console.log(`${row.source.padEnd(25)} Total: ${row.count.toString().padStart(6)}  Empty wheels: ${row.empty_wheels.toString().padStart(6)}  Has tires: ${row.has_tires}`);
}

// Find specific examples with tire sizes but no wheel sizes
const { rows: examples } = await pool.query(`
  SELECT year, make, model, source, 
         oem_tire_sizes,
         oem_wheel_sizes
  FROM vehicle_fitments
  WHERE year >= 2015
    AND (oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes IS NULL)
    AND oem_tire_sizes != '[]'::jsonb
    AND oem_tire_sizes IS NOT NULL
  ORDER BY year DESC, make, model
  LIMIT 20
`);

console.log("\n\nExamples with tire sizes but NO wheel sizes (2015+):");
console.log("─".repeat(70));
for (const row of examples) {
  const tires = row.oem_tire_sizes?.slice(0, 3).join(', ') || 'none';
  console.log(`${row.year} ${row.make} ${row.model} (${row.source})`);
  console.log(`   Tires: ${tires}`);
}

// Count total affected
const { rows: [totals] } = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE (oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes IS NULL)
                      AND oem_tire_sizes != '[]'::jsonb) as missing_wheels_has_tires
  FROM vehicle_fitments
  WHERE year >= 2000
`);

console.log("\n\nSUMMARY (2000+):");
console.log(`Total records: ${totals.total}`);
console.log(`Has tires but NO wheel sizes: ${totals.missing_wheels_has_tires}`);
console.log(`Percentage affected: ${((totals.missing_wheels_has_tires / totals.total) * 100).toFixed(1)}%`);

await pool.end();
