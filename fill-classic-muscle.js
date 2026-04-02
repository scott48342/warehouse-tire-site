/**
 * CLASSIC MUSCLE CAR FILL
 * Mustang, Challenger, Charger, Chevelle, Nova, Firebird, GTO
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORD MUSTANG (1964-1999)
// ═══════════════════════════════════════════════════════════════════════════
const MUSTANG = {
  gen1_early: { 
    years: [1964, 1965, 1966, 1967, 1968], 
    bolt_pattern: '4x108',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5 }] },
      { display_trim: 'GT', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: 'Shelby GT350', oem_wheel_sizes: [{ diameter: 15, width: 6 }] },
      { display_trim: 'Shelby GT500', oem_wheel_sizes: [{ diameter: 15, width: 6 }] },
    ]
  },
  gen1_late: { 
    years: [1969, 1970], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'GT', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Mach 1', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Boss 302', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Boss 429', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Shelby GT350', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Shelby GT500', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen1_71: { 
    years: [1971, 1972, 1973], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Grande', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Mach 1', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Boss 351', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen2: { 
    years: [1974, 1975, 1976, 1977, 1978], 
    bolt_pattern: '4x108',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 13, width: 5 }] },
      { display_trim: 'Ghia', oem_wheel_sizes: [{ diameter: 13, width: 5 }] },
      { display_trim: 'Mach 1', oem_wheel_sizes: [{ diameter: 13, width: 5.5 }] },
      { display_trim: 'Cobra II', oem_wheel_sizes: [{ diameter: 13, width: 5.5 }] },
      { display_trim: 'King Cobra', oem_wheel_sizes: [{ diameter: 13, width: 5.5 }] },
    ]
  },
  fox_early: { 
    years: [1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986], 
    bolt_pattern: '4x108',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: 'LX', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: 'GT', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'SVO', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
    ]
  },
  fox_late: { 
    years: [1987, 1988, 1989, 1990, 1991, 1992, 1993], 
    bolt_pattern: '4x108',
    trims: [
      { display_trim: 'LX', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'LX 5.0', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'GT', oem_wheel_sizes: [{ diameter: 16, width: 7 }] },
      { display_trim: 'Cobra', oem_wheel_sizes: [{ diameter: 17, width: 7.5 }] },
      { display_trim: 'Cobra R', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
    ]
  },
  sn95: { 
    years: [1994, 1995, 1996, 1997, 1998, 1999], 
    bolt_pattern: '4x108',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'GTS', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'GT', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'Cobra', oem_wheel_sizes: [{ diameter: 17, width: 8 }] },
      { display_trim: 'Cobra R', oem_wheel_sizes: [{ diameter: 18, width: 9 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DODGE CHALLENGER (1970-1974)
// ═══════════════════════════════════════════════════════════════════════════
const CHALLENGER = {
  gen1: { 
    years: [1970, 1971, 1972, 1973, 1974], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'R/T', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'R/T SE', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'T/A', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '440 Six Pack', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Hemi', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DODGE CHARGER (1966-1987)
// ═══════════════════════════════════════════════════════════════════════════
const CHARGER = {
  gen1: { 
    years: [1966, 1967], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: '383', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: '426 Hemi', oem_wheel_sizes: [{ diameter: 15, width: 6 }] },
    ]
  },
  gen2: { 
    years: [1968, 1969, 1970], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'R/T', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '500', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Daytona', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: '440 Six Pack', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Hemi', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen3: { 
    years: [1971, 1972, 1973, 1974], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'R/T', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Super Bee', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen4: { 
    years: [1975, 1976, 1977, 1978], 
    bolt_pattern: '5x114.3',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Daytona', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen5: { 
    years: [1981, 1982, 1983, 1984, 1985, 1986, 1987], 
    bolt_pattern: '5x100',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 13, width: 5 }] },
      { display_trim: '2.2', oem_wheel_sizes: [{ diameter: 14, width: 5.5 }] },
      { display_trim: 'Shelby', oem_wheel_sizes: [{ diameter: 15, width: 6 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CHEVROLET CHEVELLE (1964-1977)
// ═══════════════════════════════════════════════════════════════════════════
const CHEVELLE = {
  gen1: { 
    years: [1964, 1965, 1966, 1967], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5 }] },
      { display_trim: '300', oem_wheel_sizes: [{ diameter: 14, width: 5 }] },
      { display_trim: 'Malibu', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SS 396', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen2: { 
    years: [1968, 1969, 1970, 1971, 1972], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: '300', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Malibu', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'SS 396', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'SS 454', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen3: { 
    years: [1973, 1974, 1975, 1976, 1977], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Malibu', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Malibu Classic', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Laguna', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Laguna S-3', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CHEVROLET NOVA (1962-1979, 1985-1988)
// ═══════════════════════════════════════════════════════════════════════════
const NOVA = {
  gen1: { 
    years: [1962, 1963, 1964, 1965, 1966, 1967], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 5 }] },
      { display_trim: '400', oem_wheel_sizes: [{ diameter: 14, width: 5 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
    ]
  },
  gen2: { 
    years: [1968, 1969, 1970, 1971, 1972, 1973, 1974], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Custom', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'SS 396', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen3: { 
    years: [1975, 1976, 1977, 1978, 1979], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Custom', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Concours', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Rally', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen4: { 
    years: [1985, 1986, 1987, 1988], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Custom', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'SS', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PONTIAC FIREBIRD TRIMS (add to existing single-trim records)
// ═══════════════════════════════════════════════════════════════════════════
const FIREBIRD = {
  gen1: { 
    years: [1967, 1968, 1969], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Sprint', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: '400', oem_wheel_sizes: [{ diameter: 14, width: 7 }] },
      { display_trim: 'Trans Am', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Ram Air', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
    ]
  },
  gen2: { 
    years: [1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Esprit', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Formula', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Trans Am', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Trans Am SE', oem_wheel_sizes: [{ diameter: 15, width: 8 }] },
    ]
  },
  gen3: { 
    years: [1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'SE', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Trans Am', oem_wheel_sizes: [{ diameter: 16, width: 8 }] },
      { display_trim: 'Trans Am GTA', oem_wheel_sizes: [{ diameter: 16, width: 8 }] },
      { display_trim: 'Formula', oem_wheel_sizes: [{ diameter: 16, width: 8 }] },
    ]
  },
  gen4: { 
    years: [1993, 1994, 1995, 1996, 1997, 1998, 1999], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 16, width: 7.5 }] },
      { display_trim: 'Formula', oem_wheel_sizes: [{ diameter: 16, width: 8 }] },
      { display_trim: 'Trans Am', oem_wheel_sizes: [{ diameter: 17, width: 9 }] },
      { display_trim: 'Trans Am WS6', oem_wheel_sizes: [{ diameter: 17, width: 9 }] },
      { display_trim: 'Firehawk', oem_wheel_sizes: [{ diameter: 17, width: 9 }] },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PONTIAC GTO (1964-1974, 2004-2006)
// ═══════════════════════════════════════════════════════════════════════════
const GTO = {
  gen1: { 
    years: [1964, 1965, 1966, 1967], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
      { display_trim: 'Tri-Power', oem_wheel_sizes: [{ diameter: 14, width: 6 }] },
    ]
  },
  gen2: { 
    years: [1968, 1969, 1970, 1971, 1972], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 7 }] },
      { display_trim: 'Ram Air', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Ram Air III', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Ram Air IV', oem_wheel_sizes: [{ diameter: 15, width: 7 }] },
      { display_trim: 'Judge', oem_wheel_sizes: [{ diameter: 14, width: 7 }] },
    ]
  },
  gen3: { 
    years: [1973, 1974], 
    bolt_pattern: '5x120.65',
    trims: [
      { display_trim: 'Base', oem_wheel_sizes: [{ diameter: 14, width: 7 }] },
    ]
  },
};

async function fillVehicle(pool, make, model, generations) {
  const existing = await pool.query(`SELECT year, display_trim FROM vehicle_fitments WHERE make = $1 AND model = $2`, [make, model]);
  const existingSet = new Set(existing.rows.map(r => `${r.year}|${r.display_trim}`));
  
  console.log(`${make.toUpperCase()} ${model.toUpperCase()} (existing: ${existing.rows.length})`);

  let added = 0;
  for (const [genName, gen] of Object.entries(generations)) {
    for (const year of gen.years) {
      for (const trim of gen.trims) {
        const key = `${year}|${trim.display_trim}`;
        if (existingSet.has(key)) continue;

        const modId = genModId(make, model, trim.display_trim, year);
        await pool.query(`
          INSERT INTO vehicle_fitments (modification_id, year, make, model, display_trim, raw_trim, bolt_pattern, oem_wheel_sizes, source, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'generation_inherit', NOW(), NOW())
        `, [modId, year, make, model, trim.display_trim, trim.display_trim, gen.bolt_pattern, JSON.stringify(trim.oem_wheel_sizes)]);
        added++;
      }
    }
  }
  console.log(`  +${added}\n`);
  return added;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('═'.repeat(70));
  console.log('CLASSIC MUSCLE CAR FILL');
  console.log('═'.repeat(70) + '\n');

  let total = 0;
  
  total += await fillVehicle(pool, 'ford', 'mustang', MUSTANG);
  total += await fillVehicle(pool, 'dodge', 'challenger', CHALLENGER);
  total += await fillVehicle(pool, 'dodge', 'charger', CHARGER);
  total += await fillVehicle(pool, 'chevrolet', 'chevelle', CHEVELLE);
  total += await fillVehicle(pool, 'chevrolet', 'nova', NOVA);
  total += await fillVehicle(pool, 'pontiac', 'firebird', FIREBIRD);
  total += await fillVehicle(pool, 'pontiac', 'gto', GTO);

  console.log('─'.repeat(70));
  console.log(`TOTAL: ${total} records added`);
  
  await pool.end();
}

main().catch(console.error);
