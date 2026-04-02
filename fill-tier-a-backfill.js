/**
 * PRIORITY 3: Tier A Backfill (Generation-Based)
 * 
 * CAMARO Generations:
 * - Gen 1: 1967-1969 (F-body)
 * - Gen 2: 1970-1981 (F-body)
 * - Gen 3: 1982-1992 (F-body)
 * - Gen 4: 1993-2002 (F-body)
 * - Gen 5: 2010-2015 (Zeta) - GAP
 * - Gen 6: 2016-2024 (Alpha) - COVERED
 * 
 * CHALLENGER Generations:
 * - Gen 1: 1970-1974 (E-body) - classic
 * - Gen 2: 1978-1983 (Mitsubishi) - skip
 * - Gen 3: 2008-2024 (LC) - partial coverage
 * 
 * CHARGER Generations:
 * - Gen 1: 1966-1978 (B-body) - classic
 * - Gen 2: 1983-1987 (L-body) - skip
 * - Gen 3: 2006-2023 (LX) - partial coverage
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// CAMARO GENERATIONS
const CAMARO_GENS = {
  // Gen 5: 2010-2015 (Zeta platform)
  gen5: {
    years: [2010, 2011, 2012, 2013, 2014, 2015],
    bolt_pattern: '5x120',
    trims: [
      { display_trim: 'LS', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
      { display_trim: 'LT', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 19, width: 8.0 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }, { diameter: 20, width: 9.0, rear: true }] },
      { display_trim: 'ZL1', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }, { diameter: 20, width: 11.0, rear: true }] },
      { display_trim: '1LE', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }] },
      { display_trim: 'Z/28', oem_wheel_sizes: [{ diameter: 19, width: 11.0 }] }, // 2014-2015 only
    ],
  },
  // Gen 4: 1998-2002 (F-body late)
  gen4_late: {
    years: [1998, 1999, 2000, 2001, 2002],
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }, { diameter: 17, width: 9.0 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 17, width: 9.0 }] },
    ],
  },
  // Gen 4: 1993-1997 (F-body early)
  gen4_early: {
    years: [1993, 1994, 1995, 1996, 1997],
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'Z28', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }] },
    ],
  },
};

// CHALLENGER pre-2015 (LC platform first gen)
const CHALLENGER_PRE2015 = {
  years: [2008, 2009, 2010, 2011, 2012, 2013, 2014],
  bolt_pattern: '5x115',
  trims: [
    { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
    { display_trim: 'SXT', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    { display_trim: 'R/T', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.0 }] },
    { display_trim: 'R/T Classic', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
    { display_trim: 'SRT8', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
  ],
};

// CHARGER pre-2015 (LX platform first gen)
const CHARGER_PRE2015 = {
  years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
  bolt_pattern: '5x115',
  trims: [
    { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
    { display_trim: 'SXT', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    { display_trim: 'R/T', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.0 }] },
    { display_trim: 'Daytona R/T', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] }, // 2006-2009
    { display_trim: 'SRT8', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] },
    { display_trim: 'SRT8 Super Bee', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] }, // Limited editions
  ],
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('PRIORITY 3: TIER A BACKFILL (Generation-Based)');
  console.log('='.repeat(80));

  // Get existing
  const existing = await pool.query(`
    SELECT year, make, model, display_trim
    FROM vehicle_fitments
    WHERE (make = 'chevrolet' AND model = 'camaro')
       OR (make = 'dodge' AND model IN ('challenger', 'charger'))
  `);
  
  const existingSet = new Set(existing.rows.map(r => `${r.make}|${r.model}|${r.year}|${r.display_trim}`));
  console.log(`Existing Tier A records: ${existing.rows.length}\n`);

  let added = 0, skipped = 0;

  // CAMARO BACKFILL
  console.log('═'.repeat(60));
  console.log('CAMARO BACKFILL');
  console.log('═'.repeat(60));
  
  for (const [genName, gen] of Object.entries(CAMARO_GENS)) {
    console.log(`\n${genName} (${gen.years[0]}-${gen.years[gen.years.length-1]}):`);
    
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        // Z/28 only for 2014-2015
        if (trim.display_trim === 'Z/28' && year < 2014) continue;
        
        const key = `chevrolet|camaro|${year}|${trim.display_trim}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }
        
        const modId = genModId('chevrolet', 'camaro', trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (
            modification_id, year, make, model, display_trim, raw_trim,
            bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, 'chevrolet', 'camaro', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
        `, [modId, year, trim.display_trim, trim.display_trim, gen.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
        
        added++;
      }
      process.stdout.write('.');
    }
    console.log(` +${gen.years.length * gen.trims.length} max`);
  }

  // CHALLENGER BACKFILL
  console.log('\n' + '═'.repeat(60));
  console.log('CHALLENGER BACKFILL (2008-2014)');
  console.log('═'.repeat(60));
  
  for (const year of CHALLENGER_PRE2015.years) {
    for (const trim of CHALLENGER_PRE2015.trims) {
      const key = `dodge|challenger|${year}|${trim.display_trim}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      const modId = genModId('dodge', 'challenger', trim.display_trim, year);
      await pool.query(`
        INSERT INTO vehicle_fitments (
          modification_id, year, make, model, display_trim, raw_trim,
          bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, 'dodge', 'challenger', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
      `, [modId, year, trim.display_trim, trim.display_trim, CHALLENGER_PRE2015.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
      
      added++;
    }
    process.stdout.write('.');
  }
  console.log(' done');

  // CHARGER BACKFILL
  console.log('\n' + '═'.repeat(60));
  console.log('CHARGER BACKFILL (2006-2014)');
  console.log('═'.repeat(60));
  
  for (const year of CHARGER_PRE2015.years) {
    for (const trim of CHARGER_PRE2015.trims) {
      const key = `dodge|charger|${year}|${trim.display_trim}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      
      const modId = genModId('dodge', 'charger', trim.display_trim, year);
      await pool.query(`
        INSERT INTO vehicle_fitments (
          modification_id, year, make, model, display_trim, raw_trim,
          bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, 'dodge', 'charger', $3, $4, $5, $6, 'generation_inherit', NOW(), NOW())
      `, [modId, year, trim.display_trim, trim.display_trim, CHARGER_PRE2015.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
      
      added++;
    }
    process.stdout.write('.');
  }
  console.log(' done');

  // Results
  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));
  console.log(`Added: ${added}`);
  console.log(`Skipped (existed): ${skipped}`);

  // Verify
  const verify = await pool.query(`
    SELECT make, model, COUNT(*) as records, COUNT(DISTINCT year) as years, COUNT(DISTINCT display_trim) as trims
    FROM vehicle_fitments
    WHERE (make = 'chevrolet' AND model = 'camaro')
       OR (make = 'dodge' AND model IN ('challenger', 'charger'))
    GROUP BY make, model
    ORDER BY make, model
  `);
  console.log('\nFinal coverage:');
  for (const r of verify.rows) {
    console.log(`  ${r.make} ${r.model}: ${r.records} records, ${r.years} years, ${r.trims} trims`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
