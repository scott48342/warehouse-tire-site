/**
 * FUTURE_TRIM Correction: Lexus LX
 * 
 * Problem: Trim names from future generations were applied to older model years.
 * 
 * Lexus LX Generations:
 * - LX 450: 1996-1997 (Land Cruiser 80 series)
 * - LX 470: 1998-2007 (Land Cruiser 100 series)
 * - LX 570: 2008-2021 (Land Cruiser 200 series)
 * - LX 600: 2022+ (Land Cruiser 300 series, twin-turbo V6)
 * 
 * Future trims that didn't exist before 2022:
 * - LX 600
 * - F Sport
 * - Ultra Luxury
 * 
 * This script establishes a REUSABLE pattern for FUTURE_TRIM corrections.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// REUSABLE FUTURE_TRIM CORRECTION FRAMEWORK
// ============================================================

interface GenerationSpec {
  yearStart: number;
  yearEnd: number;
  validTrims: string[];  // Trims that actually existed in this generation
  correctTrim: string;   // What to rename invalid trims to
  specs: {
    bolt_pattern: string;
    center_bore_mm: number;
    oem_wheel_sizes: any[];
    oem_tire_sizes: string[];
  };
}

interface FutureTrimConfig {
  make: string;
  model: string;
  futureTrims: string[];  // Trims that are "future" (didn't exist in older years)
  firstValidYear: number; // Year when future trims became valid
  generations: GenerationSpec[];
}

// ============================================================
// LEXUS LX CONFIGURATION
// ============================================================

const LEXUS_LX_CONFIG: FutureTrimConfig = {
  make: 'Lexus',
  model: 'lx',
  futureTrims: ['LX 600', 'F Sport', 'Ultra Luxury'],
  firstValidYear: 2022,
  generations: [
    {
      yearStart: 1996,
      yearEnd: 1997,
      validTrims: ['LX 450', 'Base'],
      correctTrim: 'LX 450',
      specs: {
        bolt_pattern: '5x150',
        center_bore_mm: 108,
        oem_wheel_sizes: [
          { axle: 'front', width: 7, offset: 25, isStock: true, diameter: 16 }
        ],
        oem_tire_sizes: ['275/70R16']
      }
    },
    {
      yearStart: 1998,
      yearEnd: 2007,
      validTrims: ['LX 470', 'Base'],
      correctTrim: 'LX 470',
      specs: {
        bolt_pattern: '5x150',
        center_bore_mm: 110.1,
        oem_wheel_sizes: [
          { axle: 'front', width: 8, offset: 50, isStock: true, diameter: 17 },
          { axle: 'front', width: 8, offset: 50, isStock: true, diameter: 18 }
        ],
        oem_tire_sizes: ['275/60R17', '275/60R18']
      }
    },
    {
      yearStart: 2008,
      yearEnd: 2021,
      validTrims: ['LX 570', 'Base'],
      correctTrim: 'LX 570',
      specs: {
        bolt_pattern: '5x150',
        center_bore_mm: 110.1,
        oem_wheel_sizes: [
          { axle: 'front', width: 7.5, offset: null, isStock: true, diameter: 18 },
          { axle: 'front', width: 8.5, offset: null, isStock: true, diameter: 20 },
          { axle: 'front', width: 9, offset: null, isStock: true, diameter: 21 }
        ],
        oem_tire_sizes: ['285/60R18', '285/50R20', '285/45R21']
      }
    }
  ]
};

// ============================================================
// CORRECTION LOGIC (REUSABLE)
// ============================================================

async function correctFutureTrimRecords(config: FutureTrimConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FUTURE_TRIM Correction: ${config.make} ${config.model}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  
  // Get all needs_review records with FUTURE_TRIM errors
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim, 
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE make = $1
      AND model = $2
      AND certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    ORDER BY year, raw_trim
  `, [config.make, config.model]);
  
  console.log(`\nFound ${result.rows.length} records with FUTURE_TRIM contamination`);
  
  let corrected = 0;
  let skipped = 0;
  const corrections: { id: number; year: number; oldTrim: string; newTrim: string; action: string }[] = [];
  
  for (const record of result.rows) {
    const { id, year, raw_trim } = record;
    
    // Find the appropriate generation for this year
    const generation = config.generations.find(
      g => year >= g.yearStart && year <= g.yearEnd
    );
    
    if (!generation) {
      // Year is >= firstValidYear, trims are actually valid
      if (year >= config.firstValidYear) {
        // This shouldn't happen - these should be certified
        console.log(`  ⚠️ Year ${year} >= ${config.firstValidYear}, should be certified. Skipping.`);
        skipped++;
        continue;
      }
      console.log(`  ⚠️ No generation found for year ${year}. Skipping.`);
      skipped++;
      continue;
    }
    
    // Check if trim needs correction
    const trimNeedsCorrection = config.futureTrims.some(ft => 
      raw_trim?.includes(ft) || raw_trim === ft
    ) || !generation.validTrims.includes(raw_trim || 'Base');
    
    if (!trimNeedsCorrection && raw_trim !== null) {
      // Trim is already valid for this generation
      console.log(`  ⚠️ ${year} ${raw_trim} appears valid. Skipping.`);
      skipped++;
      continue;
    }
    
    // Determine the correct trim
    let newTrim: string;
    let action: string;
    
    if (raw_trim === null || raw_trim === 'null' || raw_trim?.includes(',')) {
      // Null trim or combined trim string - use generation's correct trim
      newTrim = generation.correctTrim;
      action = 'SET_GENERATION_TRIM';
    } else if (config.futureTrims.includes(raw_trim)) {
      // Direct future trim - map to generation's correct trim
      newTrim = generation.correctTrim;
      action = 'REPLACE_FUTURE_TRIM';
    } else {
      // Unexpected case
      newTrim = generation.correctTrim;
      action = 'FALLBACK_TO_GENERATION';
    }
    
    corrections.push({
      id,
      year,
      oldTrim: raw_trim || 'null',
      newTrim,
      action
    });
    
    if (!DRY_RUN) {
      // Backup original data if not already done
      const auditData = record.audit_original_data || {
        original_trim: raw_trim,
        original_wheels: record.oem_wheel_sizes,
        original_tires: record.oem_tire_sizes,
        captured_at: new Date().toISOString()
      };
      
      // Apply correction
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          raw_trim = $1,
          display_trim = $1,
          bolt_pattern = $2,
          center_bore_mm = $3,
          oem_wheel_sizes = $4,
          oem_tire_sizes = $5,
          certification_status = 'certified',
          certification_errors = '[]'::jsonb,
          audit_original_data = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        newTrim,
        generation.specs.bolt_pattern,
        generation.specs.center_bore_mm,
        JSON.stringify(generation.specs.oem_wheel_sizes),
        JSON.stringify(generation.specs.oem_tire_sizes),
        JSON.stringify(auditData),
        id
      ]);
    }
    
    corrected++;
  }
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('CORRECTION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total records: ${result.rows.length}`);
  console.log(`Corrected: ${corrected}`);
  console.log(`Skipped: ${skipped}`);
  
  // Group corrections by action
  const byAction: Record<string, typeof corrections> = {};
  for (const c of corrections) {
    if (!byAction[c.action]) byAction[c.action] = [];
    byAction[c.action].push(c);
  }
  
  console.log('\nCorrections by action:');
  for (const [action, list] of Object.entries(byAction)) {
    console.log(`  ${action}: ${list.length}`);
    // Sample
    for (const c of list.slice(0, 3)) {
      console.log(`    - ${c.year} "${c.oldTrim}" → "${c.newTrim}"`);
    }
    if (list.length > 3) {
      console.log(`    ... and ${list.length - 3} more`);
    }
  }
  
  // Verify results
  if (!DRY_RUN) {
    const verifyResult = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
      GROUP BY certification_status
    `, [config.make, config.model]);
    
    console.log(`\nPost-correction status for ${config.make} ${config.model}:`);
    for (const r of verifyResult.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
  }
  
  return { corrected, skipped, corrections };
}

// ============================================================
// DOCUMENT REUSABLE METHODOLOGY
// ============================================================

function documentMethodology() {
  console.log(`
================================================================================
REUSABLE FUTURE_TRIM CORRECTION METHODOLOGY
================================================================================

This script establishes a pattern for correcting FUTURE_TRIM contamination.

STEP 1: Define FutureTrimConfig
-------------------------------
{
  make: 'Make',
  model: 'model',
  futureTrims: ['Trim A', 'Trim B'],  // Trims that are "future"
  firstValidYear: 2022,                // Year when future trims became valid
  generations: [
    {
      yearStart: 1996,
      yearEnd: 2007,
      validTrims: ['Base', 'Sport'],   // Actually valid trims
      correctTrim: 'Base',              // What to rename invalid trims to
      specs: { ... }                    // OEM fitment specs
    },
    // More generations...
  ]
}

STEP 2: Apply correctFutureTrimRecords(config)
----------------------------------------------
- Finds all needs_review records with FUTURE_TRIM errors
- Maps each record to appropriate generation based on year
- Renames trim to generation's correct trim
- Applies correct OEM specs for that generation
- Preserves original data in audit_original_data
- Recertifies record

STEP 3: Verify results
----------------------
- Check certification_status counts
- Spot-check sample records

APPLICABLE TO:
--------------
- Escalade (Escalade-V, Sport Platinum didn't exist before certain years)
- Yukon/Tahoe (Denali Ultimate, AT4 didn't exist before certain years)
- Explorer (Platinum, ST didn't exist before certain years)
- Ranger (Raptor didn't exist before certain years)
- Any model where modern trim names were retroactively applied to older years
================================================================================
`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  try {
    documentMethodology();
    
    const results = await correctFutureTrimRecords(LEXUS_LX_CONFIG);
    
    console.log(`\n✅ Lexus LX FUTURE_TRIM correction complete!`);
    console.log(`   Records corrected: ${results.corrected}`);
    console.log(`   Records skipped: ${results.skipped}`);
    
    if (DRY_RUN) {
      console.log(`\n⚠️  DRY_RUN mode - no changes written. Run without --dry-run to apply.`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
