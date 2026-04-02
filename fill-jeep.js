/**
 * JEEP GRAND CHEROKEE TRIM FILL (1993-2026)
 * 
 * ZJ: 1993-1998
 * WJ: 1999-2004
 * WK: 2005-2010
 * WK2: 2011-2021
 * WL: 2022-2026
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

const GRAND_CHEROKEE = {
  // ZJ: 1993-1998
  zj: {
    years: [1993, 1994, 1995, 1996, 1997, 1998],
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }, { diameter: 16, width: 7.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Orvis', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] }, // Special edition
      { display_trim: '5.9 Limited', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] }, // 1998 V8
    ],
  },
  // WJ: 1999-2004
  wj: {
    years: [1999, 2000, 2001, 2002, 2003, 2004],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Overland', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }, // 2002+
    ],
  },
  // WK: 2005-2010
  wk: {
    years: [2005, 2006, 2007, 2008, 2009, 2010],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8.0 }] },
      { display_trim: 'Overland', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'SRT8', oem_wheel_sizes: [{ diameter: 20, width: 9.0 }] }, // 2006-2010
    ],
  },
  // WK2: 2011-2021
  wk2: {
    years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] },
      { display_trim: 'Altitude', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Overland', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }, { diameter: 20, width: 8.0 }] },
      { display_trim: 'Summit', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'SRT', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }] }, // 2012+
      { display_trim: 'Trackhawk', oem_wheel_sizes: [{ diameter: 20, width: 10.0 }] }, // 2018+
      { display_trim: 'Trailhawk', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] }, // 2017+
    ],
  },
  // WL: 2022-2026
  wl: {
    years: [2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Laredo', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Altitude', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Limited', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: 'Overland', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] },
      { display_trim: 'Summit', oem_wheel_sizes: [{ diameter: 21, width: 8.5 }] },
      { display_trim: 'Summit Reserve', oem_wheel_sizes: [{ diameter: 21, width: 8.5 }] },
      { display_trim: 'Trailhawk', oem_wheel_sizes: [{ diameter: 18, width: 8.0 }] },
      { display_trim: '4xe', oem_wheel_sizes: [{ diameter: 20, width: 8.0 }] }, // Plug-in hybrid
    ],
  },
};

// Also add Wrangler since it's a key Jeep
const WRANGLER = {
  // TJ: 1997-2006
  tj: {
    years: [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006],
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
      { display_trim: 'Sahara', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Rubicon', oem_wheel_sizes: [{ diameter: 16, width: 8.0 }] }, // 2003+
    ],
  },
  // JK: 2007-2018
  jk: {
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 16, width: 7.0 }] },
      { display_trim: 'Sport S', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Sahara', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
      { display_trim: 'Rubicon', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Rubicon Hard Rock', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }, // 2015+
    ],
  },
  // JL: 2018-2026
  jl: {
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    bolt_pattern: '5x127',
    trims: [
      { display_trim: 'Sport', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Sport S', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Willys', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Sahara', oem_wheel_sizes: [{ diameter: 18, width: 7.5 }] },
      { display_trim: 'Rubicon', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Rubicon 392', oem_wheel_sizes: [{ diameter: 17, width: 8.0 }] }, // 2021+
      { display_trim: '4xe', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] }, // 2021+
    ],
  },
};

async function fillVehicle(pool, make, model, generations) {
  const existing = await pool.query(`
    SELECT year, display_trim FROM vehicle_fitments
    WHERE make = $1 AND model = $2
  `, [make, model]);
  
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${make.toUpperCase()} ${model.toUpperCase()}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Existing: ${existing.rows.length}`);

  let added = 0, skipped = 0;

  for (const [genName, gen] of Object.entries(generations)) {
    let genAdded = 0;
    
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        // Year-specific
        if (trim.display_trim === '5.9 Limited' && year !== 1998) continue;
        if (trim.display_trim === 'Overland' && genName === 'wj' && year < 2002) continue;
        if (trim.display_trim === 'SRT8' && year < 2006) continue;
        if (trim.display_trim === 'SRT' && year < 2012) continue;
        if (trim.display_trim === 'Trackhawk' && year < 2018) continue;
        if (trim.display_trim === 'Trailhawk' && genName === 'wk2' && year < 2017) continue;
        if (trim.display_trim === 'Rubicon' && genName === 'tj' && year < 2003) continue;
        if (trim.display_trim === 'Rubicon Hard Rock' && year < 2015) continue;
        if (trim.display_trim === 'Rubicon 392' && year < 2021) continue;
        if (trim.display_trim === '4xe' && year < 2021) continue;

        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const modId = genModId(make, model, trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (
            modification_id, year, make, model, display_trim, raw_trim,
            bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generation_inherit', NOW(), NOW())
        `, [modId, year, make, model, trim.display_trim, trim.display_trim, gen.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);

        genAdded++;
        added++;
      }
    }
    console.log(`  ${genName}: +${genAdded}`);
  }

  console.log(`Total: +${added}, skipped: ${skipped}`);
  return added;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(70));
  console.log('JEEP TRIM FILL');
  console.log('='.repeat(70));

  let totalAdded = 0;

  totalAdded += await fillVehicle(pool, 'jeep', 'grand-cherokee', GRAND_CHEROKEE);
  totalAdded += await fillVehicle(pool, 'jeep', 'wrangler', WRANGLER);

  console.log('\n' + '─'.repeat(60));
  console.log(`TOTAL: ${totalAdded} records added`);

  await pool.end();
}

main().catch(console.error);
