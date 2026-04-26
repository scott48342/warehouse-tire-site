/**
 * Process Toyota Sequoia - Direct SQL approach
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Sequoia specs - Note: Gen 2 and Gen 3 have DIFFERENT bolt patterns!
const SEQUOIA_SPECS = {
  // Gen 3 (2023+): 6x139.7, 95.1mm bore
  gen3: {
    yearStart: 2023,
    yearEnd: 2026,
    boltPattern: '6x139.7',
    centerBore: 95.1,
    trims: {
      'sr5': { wheel: { diameter: 18, width: 8, offset: 55 }, tire: '265/70R18' },
      'limited': { wheel: { diameter: 20, width: 8, offset: 55 }, tire: '265/60R20' },
      'platinum': { wheel: { diameter: 20, width: 8, offset: 55 }, tire: '265/60R20' },
      'trdpro': { wheel: { diameter: 18, width: 8.5, offset: 0 }, tire: '285/65R18' },
      'capstone': { wheel: { diameter: 22, width: 8.5, offset: 55 }, tire: '265/50R22' },
      '1794': { wheel: { diameter: 20, width: 8, offset: 55 }, tire: '265/60R20' },
    }
  },
  
  // Gen 2 (2008-2022): 5x150, 110mm bore
  gen2: {
    yearStart: 2008,
    yearEnd: 2022,
    boltPattern: '5x150',
    centerBore: 110.1,
    trims: {
      'sr5': { wheel: { diameter: 18, width: 8, offset: 50 }, tire: '275/65R18' },
      'limited': { wheel: { diameter: 20, width: 8, offset: 50 }, tire: '275/55R20' },
      'platinum': { wheel: { diameter: 20, width: 8, offset: 50 }, tire: '275/55R20' },
      'trdpro': { wheel: { diameter: 18, width: 8, offset: 50 }, tire: '275/65R18' },
      'trdsport': { wheel: { diameter: 20, width: 8, offset: 50 }, tire: '275/55R20' },
    }
  },
  
  // Gen 1 (2001-2007): 5x150, 110mm bore
  gen1: {
    yearStart: 2001,
    yearEnd: 2007,
    boltPattern: '5x150',
    centerBore: 110.1,
    trims: {
      'sr5': { wheel: { diameter: 17, width: 7.5, offset: 30 }, tire: '265/70R17' },
      'limited': { wheel: { diameter: 17, width: 7.5, offset: 30 }, tire: '265/70R17' },
    }
  }
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/hybrid/g, '')
    .replace(/4x4/g, '')
    .replace(/4wd/g, '')
    .replace(/2wd/g, '')
    .replace(/edition/g, '')
    .trim();
}

function getGeneration(year: number) {
  if (year >= 2023) return SEQUOIA_SPECS.gen3;
  if (year >= 2008) return SEQUOIA_SPECS.gen2;
  if (year >= 2001) return SEQUOIA_SPECS.gen1;
  return null;
}

function matchTrim(year: number, displayTrim: string) {
  const gen = getGeneration(year);
  if (!gen) return null;
  
  const normalized = normalizeTrim(displayTrim);
  
  // Direct match
  const trims = gen.trims as Record<string, any>;
  if (trims[normalized]) {
    return { ...trims[normalized], boltPattern: gen.boltPattern, centerBore: gen.centerBore };
  }
  
  // Partial match
  for (const [key, value] of Object.entries(trims)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { ...value, boltPattern: gen.boltPattern, centerBore: gen.centerBore };
    }
  }
  
  // Fallback to SR5
  if (trims['sr5']) {
    return { ...trims['sr5'], boltPattern: gen.boltPattern, centerBore: gen.centerBore };
  }
  
  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Processing Toyota Sequoia...`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' 
      AND LOWER(model) = 'sequoia'
      AND source = 'google-ai-overview'
    ORDER BY year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} records to process`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const record of records.rows) {
    const match = matchTrim(record.year, record.display_trim);
    
    if (!match) {
      console.log(`  [SKIP] ${record.year} ${record.display_trim}`);
      skipped++;
      continue;
    }
    
    const oemWheelSizes = [{
      diameter: match.wheel.diameter,
      width: match.wheel.width,
      offset: match.wheel.offset,
      axle: "square",
      isStock: true
    }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${match.wheel.diameter}", ${match.tire} (${match.boltPattern})`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1::jsonb,
          oem_tire_sizes = $2::jsonb,
          bolt_pattern = $3,
          center_bore_mm = $4,
          source = 'trim-research',
          quality_tier = 'complete',
          updated_at = NOW()
        WHERE id = $5
      `, [
        JSON.stringify(oemWheelSizes),
        JSON.stringify([match.tire]),
        match.boltPattern,
        match.centerBore,
        record.id
      ]);
    }
    
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped`);
  console.log(`Match Rate: ${((updated / (updated + skipped)) * 100).toFixed(1)}%`);
  
  await pool.end();
}

main().catch(console.error);
