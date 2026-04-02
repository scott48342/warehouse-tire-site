/**
 * PRIORITY 2: Recent Tier A Quick Wins
 * - Challenger 2024-2026
 * - Charger 2024-2026
 * 
 * Note: 2024+ are the new Hornet-based models with different trims
 * Charger 2024+ is the new EV/PHEV platform
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// 2024 Challenger (final year of LC platform)
const CHALLENGER_2024 = [
  { display_trim: 'SXT', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
  { display_trim: 'GT', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 19, width: 7.5 }, { diameter: 20, width: 8.0 }] },
  { display_trim: 'R/T', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
  { display_trim: 'R/T Scat Pack', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
  { display_trim: 'R/T Scat Pack Widebody', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 11.0, staggered: true }] },
  { display_trim: 'SRT Hellcat', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }] },
  { display_trim: 'SRT Hellcat Widebody', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 11.0, staggered: true }] },
  { display_trim: 'SRT Demon 170', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 18, width: 11.0 }] }, // Drag-spec
];

// 2024+ Charger (new STLA platform - EV/Hurricane)
const CHARGER_2024_NEW = [
  { display_trim: 'Daytona R/T', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 19, width: 8.0 }, { diameter: 20, width: 9.0 }] },
  { display_trim: 'Daytona Scat Pack', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
  { display_trim: 'Sixpack', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 21, width: 9.5 }] }, // Hurricane I6
];

// 2025-2026 Challenger - discontinued, but keeping for legacy data
// Actually, Challenger was discontinued after 2023. Let me check what we have.
// For 2025-2026, only the Charger exists on new platform

const CHARGER_2025_2026 = [
  { display_trim: 'Daytona R/T', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 19, width: 8.0 }, { diameter: 20, width: 9.0 }] },
  { display_trim: 'Daytona Scat Pack', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
  { display_trim: 'Sixpack', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 21, width: 9.5 }] },
  { display_trim: 'Sixpack Stage 2', bolt_pattern: '5x115', oem_wheel_sizes: [{ diameter: 21, width: 10.0 }] },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('PRIORITY 2: RECENT TIER A (2024-2026)');
  console.log('='.repeat(80));

  // Get existing
  const existing = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE make = 'dodge' AND model IN ('challenger', 'charger') AND year >= 2024
  `);
  
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.model}|${r.display_trim}`));
  console.log(`Existing 2024+ records: ${existing.rows.length}`);

  let added = 0, skipped = 0;

  // 2024 Challenger (final year)
  console.log('\n2024 Challenger (final production year):');
  for (const trim of CHALLENGER_2024) {
    const key = `2024|challenger|${trim.display_trim}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
    
    const modId = genModId('dodge', 'challenger', trim.display_trim, 2024);
    await pool.query(`
      INSERT INTO vehicle_fitments (
        modification_id, year, make, model, display_trim, raw_trim,
        bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
      ) VALUES ($1, 2024, 'dodge', 'challenger', $2, $3, $4, $5, 'tier-a-import', NOW(), NOW())
    `, [modId, trim.display_trim, trim.display_trim, trim.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
    
    console.log(`  ✅ ${trim.display_trim}`);
    added++;
  }

  // 2024 Charger (new platform debut)
  console.log('\n2024 Charger (new STLA platform):');
  for (const trim of CHARGER_2024_NEW) {
    const key = `2024|charger|${trim.display_trim}`;
    if (existingSet.has(key)) {
      skipped++;
      continue;
    }
    
    const modId = genModId('dodge', 'charger', trim.display_trim, 2024);
    await pool.query(`
      INSERT INTO vehicle_fitments (
        modification_id, year, make, model, display_trim, raw_trim,
        bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
      ) VALUES ($1, 2024, 'dodge', 'charger', $2, $3, $4, $5, 'tier-a-import', NOW(), NOW())
    `, [modId, trim.display_trim, trim.display_trim, trim.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
    
    console.log(`  ✅ ${trim.display_trim}`);
    added++;
  }

  // 2025-2026 Charger
  for (const year of [2025, 2026]) {
    console.log(`\n${year} Charger:`);
    for (const trim of CHARGER_2025_2026) {
      const key = `${year}|charger|${trim.display_trim}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      const modId = genModId('dodge', 'charger', trim.display_trim, year);
      await pool.query(`
        INSERT INTO vehicle_fitments (
          modification_id, year, make, model, display_trim, raw_trim,
          bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, 'dodge', 'charger', $3, $4, $5, $6, 'tier-a-import', NOW(), NOW())
      `, [modId, year, trim.display_trim, trim.display_trim, trim.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
      
      console.log(`  ✅ ${trim.display_trim}`);
      added++;
    }
  }

  // Note: Challenger discontinued after 2023, but some DBs have 2024 data for final special editions
  // 2025-2026 Challenger should NOT exist - let's verify and remove if present
  console.log('\n⚠️ Checking for erroneous 2025-2026 Challenger records...');
  const erroneousChallenger = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = 'dodge' AND model = 'challenger' AND year > 2024
  `);
  if (erroneousChallenger.rows.length > 0) {
    console.log(`  Found ${erroneousChallenger.rows.length} erroneous records (Challenger discontinued 2024)`);
    // Don't delete automatically - flag for manual review
    for (const r of erroneousChallenger.rows) {
      console.log(`    ${r.year}: ${r.display_trim} (should be removed)`);
    }
  } else {
    console.log('  ✅ No erroneous Challenger records found');
  }

  // Results
  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));
  console.log(`Added: ${added}`);
  console.log(`Skipped: ${skipped}`);

  // Verify coverage
  const verify = await pool.query(`
    SELECT year, model, COUNT(*) as trims
    FROM vehicle_fitments
    WHERE make = 'dodge' AND model IN ('challenger', 'charger') AND year >= 2024
    GROUP BY year, model
    ORDER BY model, year
  `);
  console.log('\nCoverage 2024+:');
  for (const r of verify.rows) {
    console.log(`  ${r.year} ${r.model}: ${r.trims} trims`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
