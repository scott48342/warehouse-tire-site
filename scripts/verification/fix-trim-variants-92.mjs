/**
 * Create drivetrain variants for 1992-1999 Suburban (GMT400)
 * Also handle: K2500, C2500, K1500 vs C1500
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
    console.log(dryRun ? '=== DRY RUN ===' : '=== CREATING DRIVETRAIN VARIANTS (1992-1999) ===\n');

    // Get 1992-1999 Suburban records without drivetrain designations
    const suburban = await client.query(`
      SELECT * FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' 
      AND LOWER(model) = 'suburban'
      AND year BETWEEN 1992 AND 1999
      ORDER BY year, display_trim
    `);

    console.log(`Found ${suburban.rows.length} Suburban 1992-1999 records to process\n`);

    // Group by year to avoid duplicates
    const byYear = {};
    suburban.rows.forEach(r => {
      if (!byYear[r.year]) byYear[r.year] = r;
    });

    for (const [year, row] of Object.entries(byYear)) {
      console.log(`${year} Suburban:`);

      // 1. Update existing to clean trim + "1500 4WD"
      // GMT400 Suburban (1992-1999) had: Base, LS, LT
      console.log(`  - Updating existing → "1500 4WD" (6x139.7, 108mm)`);
      if (!dryRun) {
        await client.query(`
          UPDATE vehicle_fitments 
          SET display_trim = '1500 4WD', bolt_pattern = '6x139.7', center_bore_mm = 108.0
          WHERE id = $1
        `, [row.id]);
        updated++;
      }

      // 2. Create 1500 2WD variant
      const modId2wd = `${year}-chevrolet-suburban-1500-2wd`;
      console.log(`  - Creating "1500 2WD" (5x127, 78.1mm)`);
      if (!dryRun) {
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
      const modId2500 = `${year}-chevrolet-suburban-2500`;
      console.log(`  - Creating "2500" (8x165.1, 116.8mm)`);
      if (!dryRun) {
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, display_trim, bolt_pattern, center_bore_mm,
            oem_wheel_sizes, oem_tire_sizes, source, quality_tier
          ) VALUES (
            $1, $2, $3, $4, '2500', '8x165.1', 116.8,
            $5::jsonb, $6::jsonb, 'drivetrain-split-cleanup', 'high'
          )
        `, [row.year, row.make, row.model, modId2500,
            JSON.stringify(['16x6.5']), 
            JSON.stringify(['LT245/75R16', '235/85R16'])]);
        created++;
      }
    }

    // Delete duplicate 1992-1999 records with bad trim names
    console.log('\n--- Cleaning up duplicate/bad trim names ---');
    if (!dryRun) {
      const deleteResult = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(make) = 'chevrolet' 
        AND LOWER(model) = 'suburban'
        AND year BETWEEN 1992 AND 1999
        AND display_trim LIKE '%Premier%'
      `);
      console.log(`Deleted ${deleteResult.rowCount} records with inherited modern trims`);
    }

    console.log(`\n${dryRun ? '[DRY RUN] Would create' : 'Created'}: ${created} new records`);
    console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'}: ${updated} existing records`);

    // Final count
    const count = await client.query(`
      SELECT display_trim, COUNT(*)::int as count 
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban'
      GROUP BY display_trim
      ORDER BY display_trim
    `);
    console.log('\n=== Suburban trims now ===');
    count.rows.forEach(r => console.log(`  ${r.display_trim}: ${r.count}`));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
