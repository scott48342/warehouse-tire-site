/**
 * FUTURE_TRIM Correction: Toyota Tacoma
 * 
 * Toyota Tacoma Generations:
 * - Gen 1: 1995-2004 (compact pickup)
 * - Gen 2: 2005-2015 (mid-size, redesigned)
 * - Gen 3: 2016-2023 (current style)
 * - Gen 4: 2024+ (all-new platform)
 * 
 * Future trims that didn't exist before certain years:
 * - TRD Off-Road: 2016+ (Gen 3+)
 * - TRD Sport: 2016+ (Gen 3+)
 * - TRD Pro: 2015+ (introduced late Gen 2)
 * - Trailhunter: 2024+ (Gen 4 only)
 * 
 * Valid Gen 1 trims (1995-2004): Base, SR, SR5, PreRunner, S-Runner, Limited, DLX
 * Valid Gen 2 trims (2005-2015): SR, SR5, PreRunner, X-Runner, Limited, TRD Pro (2015 only)
 * Valid Gen 3 trims (2016-2023): SR, SR5, TRD Sport, TRD Off-Road, TRD Pro, Limited
 * Valid Gen 4 trims (2024+): SR, SR5, TRD Sport, TRD Off-Road, TRD Pro, Limited, Trailhunter
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

interface GenerationSpec {
  yearStart: number;
  yearEnd: number;
  validTrims: string[];
  defaultTrim: string;
  specs: {
    bolt_pattern: string;
    center_bore_mm: number;
    wheelTireByTrim: Record<string, { wheels: any[]; tires: string[] }>;
  };
}

// Tacoma OEM specs by generation
const TACOMA_GENERATIONS: GenerationSpec[] = [
  {
    yearStart: 1995,
    yearEnd: 2004,
    validTrims: ['Base', 'DLX', 'SR', 'SR5', 'PreRunner', 'S-Runner', 'Limited'],
    defaultTrim: 'SR5',
    specs: {
      bolt_pattern: '6x139.7',
      center_bore_mm: 106.1,
      wheelTireByTrim: {
        'Base': {
          wheels: [{ axle: 'both', width: 6, offset: 30, isStock: true, diameter: 15 }],
          tires: ['225/75R15']
        },
        'DLX': {
          wheels: [{ axle: 'both', width: 6, offset: 30, isStock: true, diameter: 15 }],
          tires: ['225/75R15']
        },
        'SR': {
          wheels: [{ axle: 'both', width: 6, offset: 30, isStock: true, diameter: 15 }],
          tires: ['225/75R15']
        },
        'SR5': {
          wheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 15 }],
          tires: ['265/75R15']
        },
        'PreRunner': {
          wheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 15 }],
          tires: ['265/75R15']
        },
        'S-Runner': {
          wheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 16 }],
          tires: ['265/70R16']
        },
        'Limited': {
          wheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 16 }],
          tires: ['265/70R16']
        }
      }
    }
  },
  {
    yearStart: 2005,
    yearEnd: 2015,
    validTrims: ['SR', 'SR5', 'PreRunner', 'X-Runner', 'Limited', 'TRD Pro'],
    defaultTrim: 'SR5',
    specs: {
      bolt_pattern: '6x139.7',
      center_bore_mm: 106.1,
      wheelTireByTrim: {
        'SR': {
          wheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 }],
          tires: ['245/75R16']
        },
        'SR5': {
          wheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 }],
          tires: ['265/70R16']
        },
        'PreRunner': {
          wheels: [
            { axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 },
            { axle: 'both', width: 7.5, offset: 30, isStock: true, diameter: 17 }
          ],
          tires: ['265/70R16', '265/65R17']
        },
        'X-Runner': {
          wheels: [{ axle: 'both', width: 8, offset: 35, isStock: true, diameter: 18 }],
          tires: ['255/45R18']
        },
        'Limited': {
          wheels: [{ axle: 'both', width: 7.5, offset: 30, isStock: true, diameter: 18 }],
          tires: ['265/60R18']
        },
        'TRD Pro': {
          // TRD Pro only valid in 2015 for Gen 2
          wheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 }],
          tires: ['265/70R16']
        }
      }
    }
  }
];

// Mapping from future trims to appropriate generation trims
const TRIM_MAPPING: Record<string, Record<string, string>> = {
  // Gen 1 (1995-2004) - no TRD branded trims
  'gen1': {
    'TRD Off-Road': 'SR5',      // Map to SR5 as closest equivalent
    'TRD Sport': 'PreRunner',   // Map to PreRunner (sporty 2WD)
    'TRD Pro': 'SR5',           // Map to SR5
    'Base': 'SR5',              // Generic base → SR5
  },
  // Gen 2 (2005-2014) - TRD Pro only valid 2015
  'gen2_early': {
    'TRD Off-Road': 'SR5',      // Map to SR5
    'TRD Sport': 'PreRunner',   // Map to PreRunner
    'TRD Pro': 'SR5',           // TRD Pro didn't exist until 2015
    'Base': 'SR5',
  },
  // Gen 2 2015 - TRD Pro is valid
  'gen2_2015': {
    'TRD Off-Road': 'SR5',
    'TRD Sport': 'PreRunner',
    'Base': 'SR5',
  }
};

async function correctTacomaFutureTrim() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FUTURE_TRIM Correction: Toyota Tacoma`);
  console.log(`${'='.repeat(60)}`);
  console.log(`DRY_RUN: ${DRY_RUN}\n`);
  
  // Get all needs_review records with FUTURE_TRIM errors
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim, 
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE make = 'Toyota'
      AND model = 'tacoma'
      AND certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    ORDER BY year, raw_trim
  `);
  
  console.log(`Found ${result.rows.length} records with FUTURE_TRIM contamination\n`);
  
  let corrected = 0;
  let skipped = 0;
  let stillNeedsReview = 0;
  const corrections: { id: number; year: number; oldTrim: string; newTrim: string; action: string }[] = [];
  const beforeAfter: { before: any; after: any }[] = [];
  
  for (const record of result.rows) {
    const { id, year, raw_trim } = record;
    
    // Find the appropriate generation
    const generation = TACOMA_GENERATIONS.find(
      g => year >= g.yearStart && year <= g.yearEnd
    );
    
    if (!generation) {
      // Year is >= 2016, these should already have valid trims
      console.log(`  ⚠️ Year ${year} is Gen 3/4, should have valid trims. Skipping.`);
      skipped++;
      continue;
    }
    
    // Determine which trim mapping to use
    let mappingKey: string;
    if (year <= 2004) {
      mappingKey = 'gen1';
    } else if (year <= 2014) {
      mappingKey = 'gen2_early';
    } else {
      mappingKey = 'gen2_2015';
    }
    
    const trimMapping = TRIM_MAPPING[mappingKey];
    
    // Check if this trim needs correction
    const currentTrim = raw_trim || 'Base';
    let newTrim: string;
    let action: string;
    
    if (trimMapping[currentTrim]) {
      // Direct mapping available
      newTrim = trimMapping[currentTrim];
      action = 'MAPPED_FUTURE_TRIM';
    } else if (!generation.validTrims.includes(currentTrim)) {
      // Trim not valid for this generation, use default
      newTrim = generation.defaultTrim;
      action = 'DEFAULT_TRIM';
    } else {
      // Trim is actually valid, shouldn't be marked as FUTURE_TRIM
      console.log(`  ⚠️ ${year} "${currentTrim}" appears valid. Leaving as needs_review.`);
      stillNeedsReview++;
      continue;
    }
    
    // Get specs for the new trim
    const trimSpecs = generation.specs.wheelTireByTrim[newTrim] || 
                      generation.specs.wheelTireByTrim[generation.defaultTrim];
    
    if (!trimSpecs) {
      console.log(`  ⚠️ No specs for ${newTrim} in ${year}. Leaving as needs_review.`);
      stillNeedsReview++;
      continue;
    }
    
    // Validate tire/wheel diameter match
    const wheelDiameters = trimSpecs.wheels.map(w => w.diameter);
    const tireDiameters = trimSpecs.tires.map(t => {
      const match = t.match(/R(\d+)/);
      return match ? parseInt(match[1]) : null;
    }).filter(d => d !== null);
    
    const diameterMismatch = tireDiameters.some(td => !wheelDiameters.includes(td));
    if (diameterMismatch) {
      console.log(`  ⚠️ Diameter mismatch for ${year} ${newTrim}. Leaving as needs_review.`);
      stillNeedsReview++;
      continue;
    }
    
    corrections.push({
      id,
      year,
      oldTrim: currentTrim,
      newTrim,
      action
    });
    
    // Store before/after for first few
    if (beforeAfter.length < 5) {
      beforeAfter.push({
        before: {
          year,
          trim: currentTrim,
          wheels: record.oem_wheel_sizes,
          tires: record.oem_tire_sizes
        },
        after: {
          year,
          trim: newTrim,
          wheels: trimSpecs.wheels,
          tires: trimSpecs.tires
        }
      });
    }
    
    if (!DRY_RUN) {
      // Backup original data
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
        JSON.stringify(trimSpecs.wheels),
        JSON.stringify(trimSpecs.tires),
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
  console.log(`Still needs_review: ${stillNeedsReview}`);
  
  // Group corrections by action
  const byAction: Record<string, typeof corrections> = {};
  for (const c of corrections) {
    if (!byAction[c.action]) byAction[c.action] = [];
    byAction[c.action].push(c);
  }
  
  console.log('\nCorrections by action:');
  for (const [action, list] of Object.entries(byAction)) {
    console.log(`  ${action}: ${list.length}`);
    for (const c of list.slice(0, 3)) {
      console.log(`    - ${c.year} "${c.oldTrim}" → "${c.newTrim}"`);
    }
    if (list.length > 3) {
      console.log(`    ... and ${list.length - 3} more`);
    }
  }
  
  // Before/After examples
  console.log('\n=== BEFORE/AFTER EXAMPLES ===');
  for (const ba of beforeAfter) {
    console.log(`\n${ba.before.year} "${ba.before.trim}" → "${ba.after.trim}":`);
    console.log(`  Before wheels: ${JSON.stringify(ba.before.wheels)?.substring(0, 80)}`);
    console.log(`  After wheels: ${JSON.stringify(ba.after.wheels)?.substring(0, 80)}`);
    console.log(`  Before tires: ${JSON.stringify(ba.before.tires)}`);
    console.log(`  After tires: ${JSON.stringify(ba.after.tires)}`);
  }
  
  // Verify results
  if (!DRY_RUN) {
    const verifyResult = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE make = 'Toyota' AND model = 'tacoma'
      GROUP BY certification_status
    `);
    
    console.log(`\nPost-correction status for Toyota Tacoma:`);
    for (const r of verifyResult.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
    
    // Overall counts
    const overall = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY certification_status
    `);
    
    console.log(`\nOverall certification status:`);
    for (const r of overall.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
  }
  
  return { corrected, skipped, stillNeedsReview, corrections };
}

async function main() {
  try {
    const results = await correctTacomaFutureTrim();
    
    console.log(`\n✅ Toyota Tacoma FUTURE_TRIM correction complete!`);
    console.log(`   Records corrected: ${results.corrected}`);
    console.log(`   Records skipped: ${results.skipped}`);
    console.log(`   Still needs_review: ${results.stillNeedsReview}`);
    
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
