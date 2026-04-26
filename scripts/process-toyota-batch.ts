/**
 * Batch process remaining Toyota models
 * Simple direct SQL approach
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Model definitions with specs
const MODELS: Record<string, {
  boltPattern: string;
  centerBore: number;
  defaultWheel: { diameter: number; width: number; offset: number };
  defaultTire: string;
  trims?: Record<string, { wheel: any; tire: string }>;
}> = {
  // Toyota 86 / GR86 - Staggered RWD sports car
  '86': {
    boltPattern: '5x100',
    centerBore: 56.1,
    defaultWheel: { diameter: 17, width: 7, offset: 48 },
    defaultTire: '215/45R17',
    trims: {
      'base': { wheel: { diameter: 17, width: 7, offset: 48 }, tire: '215/45R17' },
      'gt': { wheel: { diameter: 17, width: 7, offset: 48 }, tire: '215/45R17' },
      'premium': { wheel: { diameter: 17, width: 7, offset: 48 }, tire: '215/45R17' },
    }
  },
  
  // GR86 (2022+)
  'gr86': {
    boltPattern: '5x100',
    centerBore: 56.1,
    defaultWheel: { diameter: 18, width: 7.5, offset: 48 },
    defaultTire: '215/40R18',
    trims: {
      'base': { wheel: { diameter: 18, width: 7.5, offset: 48 }, tire: '215/40R18' },
      'premium': { wheel: { diameter: 18, width: 7.5, offset: 48 }, tire: '215/40R18' },
    }
  },
  
  // GR Corolla - Hot hatch
  'gr corolla': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 18, width: 8, offset: 45 },
    defaultTire: '235/40R18',
    trims: {
      'core': { wheel: { diameter: 18, width: 8, offset: 45 }, tire: '235/40R18' },
      'circuit': { wheel: { diameter: 18, width: 8, offset: 45 }, tire: '235/40R18' },
      'morizo': { wheel: { diameter: 18, width: 8, offset: 45 }, tire: '235/40R18' },
      'premium': { wheel: { diameter: 18, width: 8, offset: 45 }, tire: '235/40R18' },
    }
  },
  
  // Grand Highlander
  'grand highlander': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 20, width: 8, offset: 35 },
    defaultTire: '255/50R20',
    trims: {
      'le': { wheel: { diameter: 18, width: 8, offset: 35 }, tire: '235/65R18' },
      'xle': { wheel: { diameter: 20, width: 8, offset: 35 }, tire: '255/50R20' },
      'limited': { wheel: { diameter: 21, width: 8.5, offset: 35 }, tire: '255/45R21' },
      'platinum': { wheel: { diameter: 21, width: 8.5, offset: 35 }, tire: '255/45R21' },
    }
  },
  
  // FJ Cruiser
  'fj cruiser': {
    boltPattern: '6x139.7',
    centerBore: 106.1,
    defaultWheel: { diameter: 17, width: 7.5, offset: 15 },
    defaultTire: '265/70R17',
    trims: {
      'base': { wheel: { diameter: 16, width: 7.5, offset: 15 }, tire: '265/75R16' },
      'trail': { wheel: { diameter: 16, width: 7.5, offset: 15 }, tire: '265/75R16' },
    }
  },
  
  // Land Cruiser (multiple generations)
  'land cruiser': {
    boltPattern: '5x150',
    centerBore: 110.1,
    defaultWheel: { diameter: 18, width: 8, offset: 56 },
    defaultTire: '265/70R18',
    trims: {
      'base': { wheel: { diameter: 18, width: 8, offset: 56 }, tire: '265/70R18' },
      '1958': { wheel: { diameter: 18, width: 8, offset: 56 }, tire: '265/65R18' },
      'first edition': { wheel: { diameter: 18, width: 8, offset: 56 }, tire: '265/65R18' },
    }
  },
  
  // Tundra
  'tundra': {
    boltPattern: '5x150',
    centerBore: 110.1,
    defaultWheel: { diameter: 18, width: 8, offset: 50 },
    defaultTire: '275/65R18',
    trims: {
      'sr': { wheel: { diameter: 18, width: 8, offset: 50 }, tire: '275/65R18' },
      'sr5': { wheel: { diameter: 18, width: 8, offset: 50 }, tire: '275/65R18' },
      'limited': { wheel: { diameter: 20, width: 8, offset: 60 }, tire: '275/55R20' },
      'platinum': { wheel: { diameter: 20, width: 8, offset: 60 }, tire: '275/55R20' },
      '1794': { wheel: { diameter: 20, width: 8, offset: 60 }, tire: '275/55R20' },
      'trdpro': { wheel: { diameter: 18, width: 8.5, offset: 0 }, tire: '285/65R18' },
      'capstone': { wheel: { diameter: 22, width: 8.5, offset: 60 }, tire: '275/50R22' },
    }
  },
  
  // Avalon
  'avalon': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 18, width: 8, offset: 45 },
    defaultTire: '235/45R18',
    trims: {
      'xle': { wheel: { diameter: 17, width: 7.5, offset: 45 }, tire: '215/55R17' },
      'limited': { wheel: { diameter: 18, width: 8, offset: 45 }, tire: '235/45R18' },
      'touring': { wheel: { diameter: 19, width: 8, offset: 45 }, tire: '235/40R19' },
      'trd': { wheel: { diameter: 19, width: 8.5, offset: 45 }, tire: '235/40R19' },
    }
  },
  
  // Mirai (hydrogen fuel cell)
  'mirai': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 19, width: 8, offset: 50 },
    defaultTire: '235/50R19',
    trims: {
      'xle': { wheel: { diameter: 19, width: 8, offset: 50 }, tire: '235/50R19' },
      'limited': { wheel: { diameter: 20, width: 8, offset: 50 }, tire: '245/45R20' },
    }
  },
  
  // Solara (older coupe/convertible)
  'solara': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 16, width: 6.5, offset: 45 },
    defaultTire: '215/60R16',
    trims: {
      'se': { wheel: { diameter: 16, width: 6.5, offset: 45 }, tire: '215/60R16' },
      'sle': { wheel: { diameter: 17, width: 7, offset: 45 }, tire: '215/55R17' },
    }
  },
  
  // Prius variants
  'prius': {
    boltPattern: '5x100',
    centerBore: 54.1,
    defaultWheel: { diameter: 15, width: 6.5, offset: 40 },
    defaultTire: '195/65R15',
  },
  'prius prime': {
    boltPattern: '5x100',
    centerBore: 54.1,
    defaultWheel: { diameter: 17, width: 7, offset: 40 },
    defaultTire: '215/50R17',
  },
  'prius v': {
    boltPattern: '5x114.3',
    centerBore: 60.1,
    defaultWheel: { diameter: 17, width: 7, offset: 45 },
    defaultTire: '215/50R17',
  },
  'prius plug-in': {
    boltPattern: '5x100',
    centerBore: 54.1,
    defaultWheel: { diameter: 15, width: 6.5, offset: 40 },
    defaultTire: '195/65R15',
  },
  
  // MR2 Spyder
  'mr2 spyder': {
    boltPattern: '4x100',
    centerBore: 54.1,
    defaultWheel: { diameter: 15, width: 6, offset: 45 },
    defaultTire: '185/55R15',
  },
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/hybrid/g, '')
    .replace(/awd/g, '')
    .replace(/fwd/g, '')
    .replace(/4wd/g, '')
    .replace(/edition/g, '')
    .trim();
}

async function processModel(modelName: string, specs: typeof MODELS[string], dryRun: boolean) {
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(make) = 'toyota' 
      AND LOWER(model) = LOWER($1)
      AND source = 'google-ai-overview'
    ORDER BY year, display_trim
  `, [modelName]);
  
  if (records.rows.length === 0) return { updated: 0, skipped: 0 };
  
  console.log(`\n${modelName}: ${records.rows.length} records`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const record of records.rows) {
    const normalized = normalizeTrim(record.display_trim);
    
    // Try to find matching trim
    let wheel = specs.defaultWheel;
    let tire = specs.defaultTire;
    
    if (specs.trims) {
      for (const [key, value] of Object.entries(specs.trims)) {
        if (normalized.includes(key.replace(/\s/g, '')) || key.replace(/\s/g, '').includes(normalized)) {
          wheel = value.wheel;
          tire = value.tire;
          break;
        }
      }
    }
    
    const oemWheelSizes = [{
      diameter: wheel.diameter,
      width: wheel.width,
      offset: wheel.offset,
      axle: "square",
      isStock: true
    }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${wheel.diameter}", ${tire}`);
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
        JSON.stringify([tire]),
        specs.boltPattern,
        specs.centerBore,
        record.id
      ]);
    }
    
    updated++;
  }
  
  console.log(`  ✓ ${updated} updated`);
  return { updated, skipped };
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log(`Processing ${Object.keys(MODELS).length} Toyota models...`);
  
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const [modelName, specs] of Object.entries(MODELS)) {
    const result = await processModel(modelName, specs, dryRun);
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }
  
  console.log(`\n========================================`);
  console.log(`Total: ✓ ${totalUpdated} updated, ⚠ ${totalSkipped} skipped`);
  
  await pool.end();
}

main().catch(console.error);
