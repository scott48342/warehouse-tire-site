/**
 * Fix bolt pattern / hub bore issues from flagged records
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Known corrections from flagged records
const HUB_BORE_FIXES = [
  // Colorado Gen 1 (2004-2012): 100.3mm hub bore, not 78.1mm
  { make: 'chevrolet', model: 'colorado', yearMin: 2004, yearMax: 2012, correctBore: 100.3 },
  // Cavalier Gen 2 (1988-2005): 57.1mm, not 56.1mm
  { make: 'chevrolet', model: 'cavalier', yearMin: 1988, yearMax: 2005, correctBore: 57.1 },
  // Corvette C8 (2020+): 66.9mm, not 67.1mm
  { make: 'chevrolet', model: 'corvette', yearMin: 2020, yearMax: 2025, correctBore: 66.9 },
  // Caprice (1991-1996 B-body): 78.3mm, not 78.1mm
  { make: 'chevrolet', model: 'caprice', yearMin: 1991, yearMax: 1996, correctBore: 78.3 },
  // Nomad Tri-Five (1955-1957): 70.3mm
  { make: 'chevrolet', model: 'nomad', yearMin: 1955, yearMax: 1957, correctBore: 70.3 },
  // K1500 GMT400 (1988-1999): 108mm
  { make: 'chevrolet', model: 'k1500', yearMin: 1988, yearMax: 1999, correctBore: 108.0 },
  // K10 (1973-1987): 108mm
  { make: 'chevrolet', model: 'k10', yearMin: 1973, yearMax: 1987, correctBore: 108.0 },
  // Tracker (1989-2004): 84.0mm
  { make: 'chevrolet', model: 'tracker', yearMin: 1989, yearMax: 2004, correctBore: 84.0 },
  // Equinox Gen 2 (2010-2017): 70.3mm (5x120 platform)
  { make: 'chevrolet', model: 'equinox', yearMin: 2010, yearMax: 2017, correctBore: 70.3 },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  let totalFixed = 0;

  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== FIXING HUB BORE VALUES ===\n');

    for (const fix of HUB_BORE_FIXES) {
      const result = await client.query(`
        SELECT COUNT(*)::int as count 
        FROM vehicle_fitments 
        WHERE LOWER(make) = $1 
        AND LOWER(model) = $2 
        AND year BETWEEN $3 AND $4
        AND (center_bore_mm IS NULL OR center_bore_mm != $5)
      `, [fix.make, fix.model, fix.yearMin, fix.yearMax, fix.correctBore]);

      const count = result.rows[0].count;
      if (count > 0) {
        console.log(`${fix.make} ${fix.model} (${fix.yearMin}-${fix.yearMax}): ${count} records → ${fix.correctBore}mm`);
        
        if (!dryRun) {
          const updateResult = await client.query(`
            UPDATE vehicle_fitments 
            SET center_bore_mm = $5
            WHERE LOWER(make) = $1 
            AND LOWER(model) = $2 
            AND year BETWEEN $3 AND $4
          `, [fix.make, fix.model, fix.yearMin, fix.yearMax, fix.correctBore]);
          totalFixed += updateResult.rowCount;
          console.log(`   Updated: ${updateResult.rowCount}`);
        }
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] Would fix' : 'Total fixed'}: ${totalFixed} records`);

    // Summary check
    const summary = await client.query(`
      SELECT COUNT(*)::int as total,
             COUNT(CASE WHEN center_bore_mm IS NOT NULL THEN 1 END)::int as with_bore
      FROM vehicle_fitments
    `);
    console.log(`\nDB Status: ${summary.rows[0].with_bore}/${summary.rows[0].total} records have hub bore`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
