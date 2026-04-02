const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('='.repeat(60));
  console.log('1. MERGE RAM DUPLICATES');
  console.log('='.repeat(60));

  // Merge ram-1500 → 1500, ram-2500 → 2500, ram-3500 → 3500
  const ramMerges = [
    { from: 'ram-1500', to: '1500' },
    { from: 'ram-2500', to: '2500' },
    { from: 'ram-3500', to: '3500' },
  ];

  for (const { from, to } of ramMerges) {
    // Get records from the "from" model that don't exist in "to"
    const dupes = await pool.query(`
      SELECT f.* FROM vehicle_fitments f
      WHERE f.make = 'ram' AND f.model = $1
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_fitments t 
        WHERE t.make = 'ram' AND t.model = $2 
        AND t.year = f.year AND t.display_trim = f.display_trim
      )
    `, [from, to]);

    if (dupes.rows.length > 0) {
      // Insert unique records into the target model
      for (const row of dupes.rows) {
        const modId = genModId('ram', to, row.display_trim, row.year);
        await pool.query(`
          INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
          VALUES ($1, $2, 'ram', $3, $4, $5, $6, $7, 'merge_consolidation', NOW(), NOW())
        `, [modId, row.year, to, row.display_trim, row.raw_trim || row.display_trim, row.bolt_pattern, JSON.stringify(row.oem_wheel_sizes || [])]);
      }
      console.log(`  ${from} → ${to}: merged ${dupes.rows.length} unique records`);
    }

    // Delete the old model entries
    const deleted = await pool.query(`DELETE FROM vehicle_fitments WHERE make = 'ram' AND model = $1`, [from]);
    console.log(`  Deleted ${deleted.rowCount} records from ram/${from}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('2. FILL MERCEDES C-CLASS GAPS (2008-2014, 2026)');
  console.log('='.repeat(60));

  // Mercedes C-Class gaps: 2008-2014, 2026
  const cClassTrims = {
    w204: { years: [2008, 2009, 2010, 2011, 2012, 2013, 2014], bolt_pattern: '5x112',
      trims: [
        { display_trim: 'C300', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
        { display_trim: 'C350', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
        { display_trim: 'C63 AMG', oem_wheel_sizes: [{ diameter: 18, width: 8.5 }, { diameter: 18, width: 9 }] },
      ]},
    w206: { years: [2026], bolt_pattern: '5x112',
      trims: [
        { display_trim: 'C300', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
        { display_trim: 'C43 AMG', oem_wheel_sizes: [{ diameter: 19, width: 8 }, { diameter: 19, width: 9 }] },
        { display_trim: 'C63 AMG', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
      ]}
  };

  let cAdded = 0;
  for (const [gen, config] of Object.entries(cClassTrims)) {
    for (const year of config.years) {
      for (const trim of config.trims) {
        const exists = await pool.query(
          `SELECT 1 FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'c-class' AND year = $1 AND display_trim = $2`,
          [year, trim.display_trim]
        );
        if (exists.rows.length === 0) {
          const modId = genModId('mercedes', 'c-class', trim.display_trim, year);
          await pool.query(`
            INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
            VALUES ($1, $2, 'mercedes', 'c-class', $3, $3, $4, $5, 'generation_inherit', NOW(), NOW())
          `, [modId, year, trim.display_trim, config.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
          cAdded++;
        }
      }
    }
  }
  console.log(`  Added ${cAdded} C-Class trims\n`);

  console.log('='.repeat(60));
  console.log('3. FILL MERCEDES E-CLASS 2026');
  console.log('='.repeat(60));

  const eClass2026 = [
    { display_trim: 'E300', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    { display_trim: 'E350', oem_wheel_sizes: [{ diameter: 18, width: 8 }] },
    { display_trim: 'E450', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }] },
    { display_trim: 'E53 AMG', oem_wheel_sizes: [{ diameter: 20, width: 9 }, { diameter: 20, width: 10 }] },
    { display_trim: 'E63 AMG', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
  ];

  let eAdded = 0;
  for (const trim of eClass2026) {
    const exists = await pool.query(
      `SELECT 1 FROM vehicle_fitments WHERE make = 'mercedes' AND model = 'e-class' AND year = 2026 AND display_trim = $1`,
      [trim.display_trim]
    );
    if (exists.rows.length === 0) {
      const modId = genModId('mercedes', 'e-class', trim.display_trim, 2026);
      await pool.query(`
        INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
        VALUES ($1, 2026, 'mercedes', 'e-class', $2, $2, '5x112', $3, 'generation_inherit', NOW(), NOW())
      `, [modId, trim.display_trim, JSON.stringify(trim.oem_wheel_sizes)]);
      eAdded++;
    }
  }
  console.log(`  Added ${eAdded} E-Class 2026 trims\n`);

  console.log('='.repeat(60));
  console.log('4. FILL BMW M3/M5 GAPS');
  console.log('='.repeat(60));

  // BMW M3 2019 (G80 was actually 2021+, but 2019 was F80)
  const m3_2019 = [
    { display_trim: 'M3', oem_wheel_sizes: [{ diameter: 18, width: 9 }, { diameter: 18, width: 10 }] },
    { display_trim: 'M3 Competition', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
    { display_trim: 'M3 CS', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
  ];

  let m3Added = 0;
  for (const trim of m3_2019) {
    const exists = await pool.query(
      `SELECT 1 FROM vehicle_fitments WHERE make = 'bmw' AND model = 'm3' AND year = 2019 AND display_trim = $1`,
      [trim.display_trim]
    );
    if (exists.rows.length === 0) {
      const modId = genModId('bmw', 'm3', trim.display_trim, 2019);
      await pool.query(`
        INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
        VALUES ($1, 2019, 'bmw', 'm3', $2, $2, '5x120', $3, 'generation_inherit', NOW(), NOW())
      `, [modId, trim.display_trim, JSON.stringify(trim.oem_wheel_sizes)]);
      m3Added++;
    }
  }
  console.log(`  Added ${m3Added} M3 2019 trims`);

  // BMW M5 2005, 2012, 2017
  const m5Gaps = [
    { year: 2005, trims: [{ display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 8.5 }, { diameter: 19, width: 9.5 }] }] },
    { year: 2012, trims: [
      { display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
      { display_trim: 'M5 Competition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
    ]},
    { year: 2017, trims: [
      { display_trim: 'M5', oem_wheel_sizes: [{ diameter: 19, width: 9 }, { diameter: 19, width: 10 }] },
      { display_trim: 'M5 Competition', oem_wheel_sizes: [{ diameter: 20, width: 9.5 }, { diameter: 20, width: 10.5 }] },
    ]},
  ];

  let m5Added = 0;
  for (const gap of m5Gaps) {
    for (const trim of gap.trims) {
      const exists = await pool.query(
        `SELECT 1 FROM vehicle_fitments WHERE make = 'bmw' AND model = 'm5' AND year = $1 AND display_trim = $2`,
        [gap.year, trim.display_trim]
      );
      if (exists.rows.length === 0) {
        const modId = genModId('bmw', 'm5', trim.display_trim, gap.year);
        await pool.query(`
          INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
          VALUES ($1, $2, 'bmw', 'm5', $3, $3, '5x120', $4, 'generation_inherit', NOW(), NOW())
        `, [modId, gap.year, trim.display_trim, JSON.stringify(trim.oem_wheel_sizes)]);
        m5Added++;
      }
    }
  }
  console.log(`  Added ${m5Added} M5 gap trims\n`);

  console.log('─'.repeat(60));
  console.log('DONE!');
  
  await pool.end();
}

main().catch(console.error);
