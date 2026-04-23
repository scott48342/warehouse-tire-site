/**
 * Create drivetrain-specific records for vehicles with bolt pattern variants
 * - Suburban 1500 2WD (5x127) 
 * - Suburban 2500 (8x165.1)
 * - Update existing records to specify "1500 4WD"
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  let created = 0;
  let updated = 0;

  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== CREATING DRIVETRAIN VARIANTS ===\n');

    // Get existing Suburban records (1980-1991)
    const suburban = await client.query(`
      SELECT * FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' 
      AND LOWER(model) = 'suburban'
      AND year BETWEEN 1980 AND 1991
      ORDER BY year
    `);

    console.log(`Found ${suburban.rows.length} Suburban records (1980-1991)\n`);

    for (const row of suburban.rows) {
      console.log(`${row.year} Suburban:`);

      // 1. Update existing record to "1500 4WD"
      console.log(`  - Updating existing → "1500 4WD" (6x139.7, 108mm)`);
      if (!dryRun) {
        await client.query(`
          UPDATE vehicle_fitments 
          SET display_trim = '1500 4WD', center_bore_mm = 108.0
          WHERE id = $1
        `, [row.id]);
        updated++;
      }

      // 2. Create 1500 2WD variant
      console.log(`  - Creating "1500 2WD" (5x127, 78.1mm)`);
      if (!dryRun) {
        const modId2wd = `${row.year}-chevrolet-suburban-1500-2wd`;
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm,
            oem_wheel_sizes, oem_tire_sizes, source, quality_tier
          ) VALUES (
            $1, $2, $3, $4, '1500 2WD', '5x127', 78.1,
            $5::jsonb, $6::jsonb, 'drivetrain-split-cleanup', 'high'
          )
        `, [row.year, row.make, row.model, modId2wd,
            JSON.stringify(row.oem_wheel_sizes), 
            JSON.stringify(row.oem_tire_sizes)]);
        created++;
      }

      // 3. Create 2500 variant (8-lug)
      console.log(`  - Creating "2500" (8x165.1, 116.8mm)`);
      if (!dryRun) {
        // 2500 typically had larger tires
        const tires2500 = ['235/85R16', 'LT245/75R16'];
        const wheels2500 = ['16x6.5'];
        const modId2500 = `${row.year}-chevrolet-suburban-2500`;
        
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm,
            oem_wheel_sizes, oem_tire_sizes, source, quality_tier
          ) VALUES (
            $1, $2, $3, $4, '2500', '8x165.1', 116.8,
            $5::jsonb, $6::jsonb, 'drivetrain-split-cleanup', 'high'
          )
        `, [row.year, row.make, row.model, modId2500, JSON.stringify(wheels2500), JSON.stringify(tires2500)]);
        created++;
      }
    }

    // Also handle 1992-1999 GMT400 Suburban (same pattern split)
    console.log('\n--- Checking 1992-1999 Suburban (GMT400) ---');
    const suburban92 = await client.query(`
      SELECT DISTINCT year, display_trim, bolt_pattern 
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' 
      AND LOWER(model) = 'suburban'
      AND year BETWEEN 1992 AND 1999
      ORDER BY year
    `);
    console.log(`Found ${suburban92.rows.length} unique year/trim combos`);
    
    // Check if already has drivetrain variants
    const has2500 = suburban92.rows.some(r => r.display_trim?.includes('2500'));
    const has2WD = suburban92.rows.some(r => r.display_trim?.includes('2WD'));
    console.log(`Has 2500 entries: ${has2500}`);
    console.log(`Has 2WD entries: ${has2WD}`);

    console.log(`\n${dryRun ? '[DRY RUN] Would create' : 'Created'}: ${created} new records`);
    console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'}: ${updated} existing records`);

    // Final count
    const count = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban'
    `);
    console.log(`\nTotal Suburban records: ${count.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
