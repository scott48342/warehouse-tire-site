/**
 * Cleanup invalid fitment records
 * - Phantom Silverado models pre-1999
 * - Non-existent year/trim combos
 * - Non-US models
 * - Discontinued vehicles
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
  let totalDeleted = 0;

  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== EXECUTING CLEANUP ===\n');

    // 1. Phantom Silverado models pre-1999 (should be C/K series)
    const silverado = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(model) LIKE '%silverado%' AND year < 1999
    `);
    console.log(`1. Phantom Silverado pre-1999: ${silverado.rows[0].count} records`);
    if (!dryRun && silverado.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(model) LIKE '%silverado%' AND year < 1999
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    // 2. Non-US models (Aveo U-VA)
    const aveoUva = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(model) LIKE '%aveo-u-va%' OR LOWER(model) LIKE '%aveo u-va%'
    `);
    console.log(`2. Non-US Aveo U-VA: ${aveoUva.rows[0].count} records`);
    if (!dryRun && aveoUva.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(model) LIKE '%aveo-u-va%' OR LOWER(model) LIKE '%aveo u-va%'
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    // 3. Blazer 2006-2018 (production gap - Trailblazer replaced it)
    const blazerGap = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'blazer' 
      AND year BETWEEN 2006 AND 2018
    `);
    console.log(`3. Blazer 2006-2018 gap: ${blazerGap.rows[0].count} records`);
    if (!dryRun && blazerGap.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'blazer' 
        AND year BETWEEN 2006 AND 2018
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    // 4. Discontinued Bolt EV/EUV 2024-2025
    const bolt = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' 
      AND (LOWER(model) LIKE '%bolt-ev%' OR LOWER(model) LIKE '%bolt-euv%' 
           OR LOWER(model) = 'bolt ev' OR LOWER(model) = 'bolt euv')
      AND year >= 2024
    `);
    console.log(`4. Discontinued Bolt 2024+: ${bolt.rows[0].count} records`);
    if (!dryRun && bolt.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(make) = 'chevrolet' 
        AND (LOWER(model) LIKE '%bolt-ev%' OR LOWER(model) LIKE '%bolt-euv%'
             OR LOWER(model) = 'bolt ev' OR LOWER(model) = 'bolt euv')
        AND year >= 2024
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    // 5. 2004 Equinox (didn't exist until 2005)
    const equinox04 = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'equinox' AND year = 2004
    `);
    console.log(`5. 2004 Equinox (non-existent): ${equinox04.rows[0].count} records`);
    if (!dryRun && equinox04.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'equinox' AND year = 2004
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    // 6. 2009 Caprice (not sold in US until 2011 PPV)
    const caprice09 = await client.query(`
      SELECT COUNT(*)::int as count FROM vehicle_fitments 
      WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'caprice' AND year = 2009
    `);
    console.log(`6. 2009 Caprice (non-US): ${caprice09.rows[0].count} records`);
    if (!dryRun && caprice09.rows[0].count > 0) {
      const result = await client.query(`
        DELETE FROM vehicle_fitments 
        WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'caprice' AND year = 2009
      `);
      totalDeleted += result.rowCount;
      console.log(`   DELETED: ${result.rowCount}`);
    }

    console.log(`\n${dryRun ? '[DRY RUN] Would delete' : 'Total deleted'}: ${totalDeleted} records`);

    // Show remaining count
    const remaining = await client.query(`SELECT COUNT(*)::int as count FROM vehicle_fitments`);
    console.log(`\nRemaining records in DB: ${remaining.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
