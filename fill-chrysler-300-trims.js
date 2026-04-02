/**
 * PRIORITY 1: Chrysler 300/300C Trim Expansion
 * 
 * Generations (LX Platform):
 * - Gen 1: 2005-2010 (300C, 300, SRT8)
 * - Gen 2: 2011-2023 (300, 300C, 300S, SRT8 until 2014)
 * - Gen 3: 2024+ (if applicable)
 * 
 * Bolt pattern: 5x115 across all years
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// Generation 1: 2005-2010
const GEN1_TRIMS = {
  '300': [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
    { display_trim: 'Touring', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }] },
    { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
  ],
  '300c': [
    { display_trim: 'RWD', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },  // Keep existing
    { display_trim: 'AWD', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },  // Keep existing
    { display_trim: 'SRT8', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] }, // Keep existing
  ],
};

// Generation 2: 2011-2023
const GEN2_TRIMS = {
  '300': [
    { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }] },
    { display_trim: 'Touring', oem_wheel_sizes: [{ diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }] },
    { display_trim: 'Touring L', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 19, width: 7.5 }] },
    { display_trim: '300S', oem_wheel_sizes: [{ diameter: 19, width: 7.5 }, { diameter: 20, width: 8.0 }] },
    { display_trim: '300C', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.0 }] },
  ],
  '300c': [
    { display_trim: 'RWD', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.0 }] },
    { display_trim: 'AWD', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.0 }] },
    { display_trim: 'Platinum', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
    { display_trim: 'John Varvatos', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] }, // Limited editions 2013-2014
  ],
};

// SRT8 years (separate model in some DBs)
const SRT8_YEARS = {
  '300': [2012, 2013, 2014],  // 300 SRT8 trim
  '300c': [2005, 2006, 2007, 2008, 2009, 2010], // 300C SRT8
};

// Generation 3: 2024-2026 (500e-based, if different)
const GEN3_TRIMS = {
  '300': [
    { display_trim: 'Touring', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
    { display_trim: 'Touring L', oem_wheel_sizes: [{ diameter: 19, width: 7.5 }] },
    { display_trim: '300S', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
    { display_trim: '300C', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
  ],
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('CHRYSLER 300/300C TRIM EXPANSION');
  console.log('='.repeat(80));

  // Get existing records to avoid duplicates
  const existing = await pool.query(`
    SELECT year, make, model, display_trim, modification_id
    FROM vehicle_fitments
    WHERE make = 'chrysler' AND (model = '300' OR model = '300c')
  `);
  
  const existingSet = new Set(
    existing.rows.map(r => `${r.year}|${r.model}|${r.display_trim}`)
  );
  console.log(`Existing records: ${existing.rows.length}`);

  let added = 0, skipped = 0;

  // Process each generation
  const batches = [
    { years: [2005, 2006, 2007, 2008, 2009, 2010], trims: GEN1_TRIMS, gen: 'Gen1' },
    { years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], trims: GEN2_TRIMS, gen: 'Gen2' },
    { years: [2024, 2025, 2026], trims: GEN3_TRIMS, gen: 'Gen3' },
  ];

  for (const batch of batches) {
    console.log(`\n${batch.gen} (${batch.years[0]}-${batch.years[batch.years.length-1]}):`);
    
    for (const model of ['300', '300c']) {
      const trims = batch.trims[model];
      if (!trims) continue;

      for (const year of batch.years) {
        for (const trim of trims) {
          const key = `${year}|${model}|${trim.display_trim}`;
          
          if (existingSet.has(key)) {
            skipped++;
            continue;
          }

          const modId = genModId('chrysler', model, trim.display_trim, year);
          
          await pool.query(`
            INSERT INTO vehicle_fitments (
              modification_id, year, make, model, display_trim, raw_trim,
              bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
            ) VALUES ($1, $2, 'chrysler', $3, $4, $5, '5x115', $6, 'tier-a-import', NOW(), NOW())
          `, [
            modId, year, model, trim.display_trim, trim.display_trim,
            JSON.stringify(trim.oem_wheel_sizes)
          ]);
          
          existingSet.add(key);
          added++;
        }
      }
    }
    console.log(`  Added: ${added}, Skipped: ${skipped}`);
  }

  // Add SRT8 variants for applicable years
  console.log('\nAdding SRT8 variants...');
  const srt8Trim = { display_trim: 'SRT8', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] };
  
  for (const [model, years] of Object.entries(SRT8_YEARS)) {
    for (const year of years) {
      const key = `${year}|${model}|SRT8`;
      if (existingSet.has(key)) continue;
      
      const modId = genModId('chrysler', model, 'SRT8', year);
      await pool.query(`
        INSERT INTO vehicle_fitments (
          modification_id, year, make, model, display_trim, raw_trim,
          bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, 'chrysler', $3, 'SRT8', 'SRT8', '5x115', $4, 'tier-a-import', NOW(), NOW())
      `, [modId, year, model, JSON.stringify(srt8Trim.oem_wheel_sizes)]);
      
      added++;
    }
  }

  // Final count
  const finalCount = await pool.query(`
    SELECT model, COUNT(*) as cnt, COUNT(DISTINCT year) as years, COUNT(DISTINCT display_trim) as trims
    FROM vehicle_fitments
    WHERE make = 'chrysler' AND (model = '300' OR model = '300c')
    GROUP BY model
  `);

  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS');
  console.log('─'.repeat(60));
  console.log(`Total added: ${added}`);
  console.log(`Total skipped (already existed): ${skipped}`);
  console.log('\nFinal coverage:');
  for (const r of finalCount.rows) {
    console.log(`  ${r.model}: ${r.cnt} records, ${r.years} years, ${r.trims} unique trims`);
  }

  // Sample verification
  console.log('\nSample: 2020 Chrysler 300 trims:');
  const sample = await pool.query(`
    SELECT display_trim FROM vehicle_fitments
    WHERE year = 2020 AND make = 'chrysler' AND model = '300'
    ORDER BY display_trim
  `);
  for (const r of sample.rows) {
    console.log(`  • ${r.display_trim}`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
