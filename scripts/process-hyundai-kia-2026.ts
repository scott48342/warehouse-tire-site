/**
 * Process 2026 Hyundai and Kia vehicles missing fitment data
 * Bolt patterns derived from prior model years and platform sharing:
 * - Hyundai Santa Cruz: 5x114.3, 67.1mm (shares Tucson platform)
 * - Hyundai Santa Fe: 5x114.3, 67.1mm
 * - Kia Carnival: 5x114.3, 67.1mm (shares Sedona/Sorento platform)
 * - Kia K5: 5x114.3, 67.1mm
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface FitmentSpec {
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
}

// Wheel width estimates based on tire width
function estimateWheelWidth(tireSize: string): number {
  const match = tireSize.match(/^(\d+)/);
  if (!match) return 7.5;
  const tireWidth = parseInt(match[1]);
  // Standard calculation: tire width / 25.4 - 0.5 to 1.5 inch
  if (tireWidth <= 205) return 6.5;
  if (tireWidth <= 225) return 7;
  if (tireWidth <= 235) return 7.5;
  if (tireWidth <= 245) return 8;
  if (tireWidth <= 255) return 8.5;
  return 9;
}

// Santa Cruz 2026 specs
const santaCruzSpecs: Record<string, FitmentSpec> = {
  'SE': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/60R18' },
  'SEL': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/60R18' },
  'SEL Premium': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '245/60R18' },
  'Limited': { wheelDiameter: 20, wheelWidth: 8, tireSize: '245/50R20' },
};

// Santa Fe 2026 specs
const santaFeSpecs: Record<string, FitmentSpec> = {
  'SE': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
  'SEL': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/60R18' },
  'XRT': { wheelDiameter: 18, wheelWidth: 8, tireSize: '245/60R18' },
  'Limited': { wheelDiameter: 20, wheelWidth: 8.5, tireSize: '255/45R20' },
  'Calligraphy': { wheelDiameter: 21, wheelWidth: 8.5, tireSize: '245/45R21' },
};

// Carnival 2026 specs
const carnivalSpecs: Record<string, FitmentSpec> = {
  'LX': { wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  'LX+': { wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  'LXS': { wheelDiameter: 17, wheelWidth: 7, tireSize: '235/65R17' },
  'EX': { wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/55R19' },
  'SX': { wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/55R19' },
  'SX Prestige': { wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/55R19' },
};

// K5 2026 specs
const k5Specs: Record<string, FitmentSpec> = {
  'LX': { wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/65R16' },
  'LXS': { wheelDiameter: 16, wheelWidth: 6.5, tireSize: '205/65R16' },
  'GT-Line': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/45R18' },
  'EX': { wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/45R18' },
  'GT': { wheelDiameter: 19, wheelWidth: 8, tireSize: '245/40R19' },
};

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function matchSpec(displayTrim: string, specs: Record<string, FitmentSpec>): FitmentSpec | null {
  const normalized = normalizeTrim(displayTrim);
  
  // Exact match
  for (const [trim, spec] of Object.entries(specs)) {
    if (normalizeTrim(trim) === normalized) return spec;
  }
  
  // Contains match
  for (const [trim, spec] of Object.entries(specs)) {
    const nt = normalizeTrim(trim);
    if (normalized.includes(nt) || nt.includes(normalized)) return spec;
  }
  
  return null;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  // Process Santa Cruz
  console.log('\n=== Processing Hyundai Santa Cruz ===');
  const santaCruzRecords = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(model) = 'santa cruz' AND bolt_pattern IS NULL
    ORDER BY year, display_trim
  `);
  
  let updated = 0;
  for (const record of santaCruzRecords.rows) {
    const spec = matchSpec(record.display_trim, santaCruzSpecs);
    if (!spec) {
      console.log(`  [SKIP] ${record.year} ${record.display_trim} - no match`);
      continue;
    }
    
    const oemWheelSizes = [{ diameter: spec.wheelDiameter, width: spec.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${spec.wheelDiameter}", ${spec.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = '5x114.3', 
            center_bore_mm = 67.1, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $3
      `, [JSON.stringify(oemWheelSizes), JSON.stringify([spec.tireSize]), record.id]);
    }
    updated++;
  }
  console.log(`  ✓ ${updated} Santa Cruz records`);
  
  // Process Santa Fe
  console.log('\n=== Processing Hyundai Santa Fe ===');
  const santaFeRecords = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(model) = 'santa fe' AND bolt_pattern IS NULL
    ORDER BY year, display_trim
  `);
  
  updated = 0;
  for (const record of santaFeRecords.rows) {
    const spec = matchSpec(record.display_trim, santaFeSpecs);
    if (!spec) {
      console.log(`  [SKIP] ${record.year} ${record.display_trim} - no match`);
      continue;
    }
    
    const oemWheelSizes = [{ diameter: spec.wheelDiameter, width: spec.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${spec.wheelDiameter}", ${spec.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = '5x114.3', 
            center_bore_mm = 67.1, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $3
      `, [JSON.stringify(oemWheelSizes), JSON.stringify([spec.tireSize]), record.id]);
    }
    updated++;
  }
  console.log(`  ✓ ${updated} Santa Fe records`);
  
  // Process Carnival
  console.log('\n=== Processing Kia Carnival ===');
  const carnivalRecords = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(model) = 'carnival' AND bolt_pattern IS NULL
    ORDER BY year, display_trim
  `);
  
  updated = 0;
  for (const record of carnivalRecords.rows) {
    const spec = matchSpec(record.display_trim, carnivalSpecs);
    if (!spec) {
      console.log(`  [SKIP] ${record.year} ${record.display_trim} - no match`);
      continue;
    }
    
    const oemWheelSizes = [{ diameter: spec.wheelDiameter, width: spec.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${spec.wheelDiameter}", ${spec.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = '5x114.3', 
            center_bore_mm = 67.1, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $3
      `, [JSON.stringify(oemWheelSizes), JSON.stringify([spec.tireSize]), record.id]);
    }
    updated++;
  }
  console.log(`  ✓ ${updated} Carnival records`);
  
  // Process K5
  console.log('\n=== Processing Kia K5 ===');
  const k5Records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE LOWER(model) = 'k5' AND bolt_pattern IS NULL
    ORDER BY year, display_trim
  `);
  
  updated = 0;
  for (const record of k5Records.rows) {
    const spec = matchSpec(record.display_trim, k5Specs);
    if (!spec) {
      console.log(`  [SKIP] ${record.year} ${record.display_trim} - no match`);
      continue;
    }
    
    const oemWheelSizes = [{ diameter: spec.wheelDiameter, width: spec.wheelWidth, offset: null, axle: 'square', isStock: true }];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.display_trim} → ${spec.wheelDiameter}", ${spec.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = '5x114.3', 
            center_bore_mm = 67.1, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $3
      `, [JSON.stringify(oemWheelSizes), JSON.stringify([spec.tireSize]), record.id]);
    }
    updated++;
  }
  console.log(`  ✓ ${updated} K5 records`);
  
  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
