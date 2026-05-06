/**
 * Delete Challenger tier-a-import duplicates where better tiresize.com data exists
 * 
 * Targets:
 * - 2022-2023 Challenger GT
 * - 2022-2023 Challenger R/T Scat Pack Widebody
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

console.log('🗑️  Deleting Challenger tier-a-import duplicates...\n');

// First, verify the records we're deleting
const beforeDelete = await pool.query(`
  SELECT year, modification_id, display_trim, source, 
         jsonb_array_length(oem_wheel_sizes) as wheel_count
  FROM vehicle_fitments
  WHERE source = 'tier-a-import'
    AND make = 'Dodge' AND model = 'challenger'
    AND year IN (2022, 2023)
    AND (
      modification_id LIKE 'dodge-challenger-gt-%'
      OR modification_id LIKE 'dodge-challenger-scat-pack-widebody-%'
    )
  ORDER BY year DESC, display_trim
`);

console.log('Records to delete:');
for (const row of beforeDelete.rows) {
  console.log(`  ${row.year} ${row.display_trim} (${row.modification_id}) - ${row.wheel_count} wheel(s)`);
}

// Delete the records
const deleteResult = await pool.query(`
  DELETE FROM vehicle_fitments
  WHERE source = 'tier-a-import'
    AND make = 'Dodge' AND model = 'challenger'
    AND year IN (2022, 2023)
    AND (
      modification_id LIKE 'dodge-challenger-gt-%'
      OR modification_id LIKE 'dodge-challenger-scat-pack-widebody-%'
    )
  RETURNING year, modification_id, display_trim
`);

console.log(`\n✅ Deleted ${deleteResult.rowCount} records`);

// Verify the tiresize.com records remain
console.log('\n📊 Remaining tiresize.com records for these trims:');
const remaining = await pool.query(`
  SELECT year, modification_id, display_trim, source,
         jsonb_array_length(oem_wheel_sizes) as wheel_count,
         oem_wheel_sizes
  FROM vehicle_fitments
  WHERE source = 'tiresize.com'
    AND make = 'Dodge' AND model = 'Challenger'
    AND year IN (2022, 2023)
    AND (display_trim ILIKE '%GT%' OR display_trim ILIKE '%Scat Pack Widebody%')
  ORDER BY year DESC, display_trim
`);

for (const row of remaining.rows) {
  const wheels = row.oem_wheel_sizes || [];
  const frontWidth = wheels.find(w => w.axle === 'front')?.width;
  const rearWidth = wheels.find(w => w.axle === 'rear')?.width;
  console.log(`  ${row.year} ${row.display_trim} (${row.source})`);
  console.log(`    ${row.wheel_count} wheels: F=${frontWidth}" R=${rearWidth}"`);
}

await pool.end();
console.log('\n✅ Delete complete');
