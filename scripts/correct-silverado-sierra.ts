/**
 * Correction Batch 2: Chevrolet Silverado 1500 + GMC Sierra 1500
 * 
 * Corrects and recertifies Silverado/Sierra 1500 records marked needs_review.
 * 
 * Generations:
 * - GMT800: 1999-2006 (Sierra), 1999-2007 (Silverado Classic)
 * - GMT900: 2007-2013
 * - K2XX: 2014-2018
 * - T1XX: 2019-2024 (if any need review)
 * 
 * OEM Specs researched from manufacturer data.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// Silverado/Sierra 1500 OEM Specs by Generation and Trim
// ============================================================================

interface TrimSpec {
  wheels: { diameter: number; width: number; offset?: number }[];
  tires: string[];
}

// GMT800 (1999-2006/2007) - older trucks, mostly 16" standard
const GMT800_SPECS: Record<string, TrimSpec> = {
  'WT': {
    wheels: [{ diameter: 16, width: 6.5 }],
    tires: ['245/75R16']
  },
  'Base': {
    wheels: [{ diameter: 16, width: 6.5 }],
    tires: ['245/75R16']
  },
  'LS': {
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.5 }],
    tires: ['245/75R16', '265/70R17']
  },
  'LT': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17']
  },
  'SL': {
    wheels: [{ diameter: 16, width: 6.5 }],
    tires: ['245/75R16']
  },
  'SLE': {
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.5 }],
    tires: ['245/75R16', '265/70R17']
  },
  'SLT': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17']
  },
  'Z71': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17']
  },
  'SS': {
    wheels: [{ diameter: 20, width: 8 }],
    tires: ['275/55R20']
  },
  'Denali': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17']
  }
};

// GMT900 (2007-2013) - transition to larger wheels
const GMT900_SPECS: Record<string, TrimSpec> = {
  'WT': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['245/70R17']
  },
  'Base': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['245/70R17']
  },
  'LS': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['245/70R17']
  },
  'LT': {
    wheels: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8 }],
    tires: ['245/70R17', '265/65R18']
  },
  'LTZ': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/55R20']
  },
  'SL': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['245/70R17']
  },
  'SLE': {
    wheels: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8 }],
    tires: ['245/70R17', '265/65R18']
  },
  'SLT': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/55R20']
  },
  'Z71': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['265/65R18']
  },
  'Denali': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20']
  },
  'Hybrid': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['245/70R17']
  }
};

// K2XX (2014-2018) - modern platform
const K2XX_SPECS: Record<string, TrimSpec> = {
  'WT': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['255/70R17']
  },
  'Base': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['255/70R17']
  },
  'LS': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['255/70R17']
  },
  'Custom': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20']
  },
  'LT': {
    wheels: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8 }],
    tires: ['255/70R17', '265/65R18']
  },
  'LTZ': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/55R20']
  },
  'High Country': {
    wheels: [{ diameter: 20, width: 8.5 }, { diameter: 22, width: 9 }],
    tires: ['275/55R20', '275/50R22']
  },
  'SL': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['255/70R17']
  },
  'SLE': {
    wheels: [{ diameter: 17, width: 7.5 }, { diameter: 18, width: 8 }],
    tires: ['255/70R17', '265/65R18']
  },
  'SLT': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/55R20']
  },
  'Z71': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['265/65R18']
  },
  'All Terrain': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['265/65R18']
  },
  'Denali': {
    wheels: [{ diameter: 20, width: 8.5 }, { diameter: 22, width: 9 }],
    tires: ['275/55R20', '275/50R22']
  },
  'Elevation': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20']
  }
};

// T1XX (2019-2024) - current gen
const T1XX_SPECS: Record<string, TrimSpec> = {
  'WT': {
    wheels: [{ diameter: 17, width: 8 }],
    tires: ['255/70R17']
  },
  'Custom': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/60R20']
  },
  'Custom Trail Boss': {
    wheels: [{ diameter: 18, width: 8.5 }],
    tires: ['275/65R18']
  },
  'LT': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/60R20']
  },
  'RST': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/60R20']
  },
  'LT Trail Boss': {
    wheels: [{ diameter: 18, width: 8.5 }],
    tires: ['275/65R18']
  },
  'LTZ': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/60R20']
  },
  'High Country': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22']
  },
  'ZR2': {
    wheels: [{ diameter: 18, width: 8.5 }],
    tires: ['275/70R18']
  },
  'SLE': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['265/65R18', '275/60R20']
  },
  'Elevation': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/60R20']
  },
  'AT4': {
    wheels: [{ diameter: 18, width: 8.5 }],
    tires: ['275/65R18']
  },
  'SLT': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/60R20']
  },
  'Denali': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22']
  },
  'Denali Ultimate': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22']
  },
  'Base': {
    wheels: [{ diameter: 17, width: 8 }],
    tires: ['255/70R17']
  }
};

// Bolt pattern and center bore - same for all GM 1500 trucks
const GM_1500_BASE = {
  boltPattern: '6x139.7',
  centerBore: 78.1
};

function getGeneration(year: number): 'gmt800' | 'gmt900' | 'k2xx' | 't1xx' | null {
  if (year >= 1999 && year <= 2006) return 'gmt800';
  if (year === 2007) return 'gmt900'; // Silverado had Classic and New in 2007
  if (year >= 2008 && year <= 2013) return 'gmt900';
  if (year >= 2014 && year <= 2018) return 'k2xx';
  if (year >= 2019 && year <= 2026) return 't1xx';
  return null;
}

function getSpecsForTrim(year: number, displayTrim: string): TrimSpec | null {
  const gen = getGeneration(year);
  if (!gen) return null;
  
  const specs = gen === 'gmt800' ? GMT800_SPECS 
    : gen === 'gmt900' ? GMT900_SPECS 
    : gen === 'k2xx' ? K2XX_SPECS 
    : T1XX_SPECS;
  
  // Try exact match first
  if (specs[displayTrim]) return specs[displayTrim];
  
  // Try partial match
  const trimLower = displayTrim.toLowerCase();
  for (const [key, value] of Object.entries(specs)) {
    if (trimLower.includes(key.toLowerCase()) || key.toLowerCase().includes(trimLower)) {
      return value;
    }
  }
  
  // Check for specific keywords
  if (trimLower.includes('denali ultimate')) return specs['Denali Ultimate'] || specs['Denali'];
  if (trimLower.includes('denali')) return specs['Denali'];
  if (trimLower.includes('high country')) return specs['High Country'];
  if (trimLower.includes('zr2')) return specs['ZR2'] || specs['Z71'];
  if (trimLower.includes('at4')) return specs['AT4'] || specs['Z71'];
  if (trimLower.includes('trail boss')) return specs['LT Trail Boss'] || specs['Custom Trail Boss'] || specs['Z71'];
  if (trimLower.includes('z71') || trimLower.includes('all terrain')) return specs['Z71'] || specs['All Terrain'];
  if (trimLower.includes('rst')) return specs['RST'] || specs['Custom'];
  if (trimLower.includes('elevation')) return specs['Elevation'] || specs['Custom'];
  if (trimLower.includes('ltz')) return specs['LTZ'];
  if (trimLower.includes('slt')) return specs['SLT'];
  if (trimLower.includes('custom')) return specs['Custom'];
  if (trimLower.includes('lt') && !trimLower.includes('slt')) return specs['LT'];
  if (trimLower.includes('sle')) return specs['SLE'];
  if (trimLower.includes('ls')) return specs['LS'];
  if (trimLower.includes('sl') && !trimLower.includes('sle') && !trimLower.includes('slt')) return specs['SL'];
  if (trimLower.includes('wt') || trimLower.includes('work truck')) return specs['WT'];
  if (trimLower.includes('ss')) return specs['SS'] || specs['Custom'];
  if (trimLower.includes('hybrid')) return specs['Hybrid'] || specs['LS'];
  
  // Return base specs
  return specs['Base'] || specs['WT'];
}

function extractDiameter(tireSize: string): number | null {
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function validateSpec(spec: TrimSpec): boolean {
  // Every tire diameter must match a wheel diameter
  const wheelDiameters = spec.wheels.map(w => w.diameter);
  const tireDiameters = spec.tires.map(t => extractDiameter(t)).filter(Boolean) as number[];
  
  return tireDiameters.every(td => wheelDiameters.includes(td));
}

async function main() {
  console.log(`\n🔧 Correction Batch 2: Silverado/Sierra 1500${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // Get all Silverado/Sierra 1500 records marked needs_review
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, 
           certification_status, certification_errors, audit_original_data, source
    FROM vehicle_fitments
    WHERE ((make = 'Chevrolet' AND model ILIKE '%silverado%1500%')
       OR (make = 'GMC' AND model ILIKE '%sierra%1500%'))
      AND certification_status = 'needs_review'
    ORDER BY year DESC, make, display_trim
  `);

  console.log(`Found ${records.rowCount} Silverado/Sierra 1500 records needing review\n`);

  // Group by generation for reporting
  const byGen: Record<string, number> = { gmt800: 0, gmt900: 0, k2xx: 0, t1xx: 0 };
  for (const row of records.rows) {
    const gen = getGeneration(row.year);
    if (gen) byGen[gen]++;
  }
  console.log(`By generation: GMT800=${byGen.gmt800}, GMT900=${byGen.gmt900}, K2XX=${byGen.k2xx}, T1XX=${byGen.t1xx}\n`);

  let reviewed = 0;
  let corrected = 0;
  let recertified = 0;
  let stillNeedsReview = 0;
  const samples: any[] = [];

  for (const row of records.rows) {
    reviewed++;
    
    const gen = getGeneration(row.year);
    if (!gen) {
      console.log(`  ⚠️ ${row.year} ${row.make} ${row.model} [${row.display_trim}] - unsupported year`);
      stillNeedsReview++;
      continue;
    }
    
    const spec = getSpecsForTrim(row.year, row.display_trim);
    if (!spec) {
      console.log(`  ⚠️ ${row.year} ${row.make} ${row.model} [${row.display_trim}] - no spec mapping`);
      stillNeedsReview++;
      continue;
    }
    
    // Validate the spec
    if (!validateSpec(spec)) {
      console.log(`  ⚠️ ${row.year} ${row.make} ${row.model} [${row.display_trim}] - spec validation failed`);
      stillNeedsReview++;
      continue;
    }
    
    // Build corrected data
    const newWheelSizes = spec.wheels.map(w => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset || null,
      position: 'both',
      isStock: true
    }));
    
    const newTireSizes = spec.tires;
    
    // Capture sample for output
    if (samples.length < 12) {
      samples.push({
        vehicle: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`,
        generation: gen.toUpperCase(),
        before: {
          wheels: row.oem_wheel_sizes,
          tires: row.oem_tire_sizes
        },
        after: {
          wheels: newWheelSizes,
          tires: newTireSizes
        }
      });
    }
    
    if (!DRY_RUN) {
      // Preserve original data if not already saved
      const auditData = row.audit_original_data || {
        oem_wheel_sizes: row.oem_wheel_sizes,
        oem_tire_sizes: row.oem_tire_sizes,
        original_source: row.source,
        quarantine_date: new Date().toISOString()
      };
      
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1,
          oem_tire_sizes = $2,
          bolt_pattern = $3,
          center_bore_mm = $4,
          certification_status = 'certified',
          certification_errors = '[]'::jsonb,
          audit_original_data = $5,
          source = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        JSON.stringify(newWheelSizes),
        JSON.stringify(newTireSizes),
        GM_1500_BASE.boltPattern,
        GM_1500_BASE.centerBore,
        JSON.stringify(auditData),
        `corrected_batch2_${row.source || 'unknown'}`,
        row.id
      ]);
    }
    
    corrected++;
    recertified++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('CORRECTION RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n📊 Summary:`);
  console.log(`  Records reviewed: ${reviewed}`);
  console.log(`  Records corrected: ${corrected}`);
  console.log(`  Records recertified: ${recertified}`);
  console.log(`  Still needs review: ${stillNeedsReview}`);
  
  console.log(`\n📋 Sample corrections:`);
  for (const s of samples) {
    console.log(`\n  ${s.vehicle} (${s.generation})`);
    console.log(`    Before wheels: ${JSON.stringify(s.before.wheels)?.substring(0, 60)}...`);
    console.log(`    Before tires:  ${JSON.stringify(s.before.tires)}`);
    console.log(`    After wheels:  ${JSON.stringify(s.after.wheels)}`);
    console.log(`    After tires:   ${JSON.stringify(s.after.tires)}`);
  }

  // Validation
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION');
  console.log('='.repeat(60));
  
  // Check final counts for Silverado
  const silveradoCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Chevrolet' AND model ILIKE '%silverado%1500%'
      AND certification_status = 'certified'
  `);
  const silveradoReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Chevrolet' AND model ILIKE '%silverado%1500%'
      AND certification_status = 'needs_review'
  `);
  
  // Check final counts for Sierra
  const sierraCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'GMC' AND model ILIKE '%sierra%1500%'
      AND certification_status = 'certified'
  `);
  const sierraReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'GMC' AND model ILIKE '%sierra%1500%'
      AND certification_status = 'needs_review'
  `);
  
  console.log(`\n📈 Final Status:`);
  console.log(`  Chevrolet Silverado 1500:`);
  console.log(`    ✅ Certified: ${silveradoCertified.rows[0].cnt}`);
  console.log(`    ⚠️ Needs Review: ${silveradoReview.rows[0].cnt}`);
  console.log(`  GMC Sierra 1500:`);
  console.log(`    ✅ Certified: ${sierraCertified.rows[0].cnt}`);
  console.log(`    ⚠️ Needs Review: ${sierraReview.rows[0].cnt}`);
  
  // Global counts
  const globalCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE certification_status = 'certified' OR certification_status IS NULL
  `);
  const globalReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
  `);
  
  console.log(`\n📈 Global Status:`);
  console.log(`  ✅ Certified: ${globalCertified.rows[0].cnt}`);
  console.log(`  ⚠️ Needs Review: ${globalReview.rows[0].cnt}`);
  
  // Spot check
  console.log(`\n🔍 Spot Check (tire/wheel diameter match):`);
  const spotCheck = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE ((make = 'Chevrolet' AND model ILIKE '%silverado%1500%')
       OR (make = 'GMC' AND model ILIKE '%sierra%1500%'))
      AND certification_status = 'certified'
    ORDER BY RANDOM()
    LIMIT 6
  `);
  
  for (const row of spotCheck.rows) {
    const wheels = row.oem_wheel_sizes || [];
    const tires = row.oem_tire_sizes || [];
    const wheelDias = wheels.map((w: any) => w.diameter).filter(Boolean);
    const tireDias = tires.map((t: string) => extractDiameter(t)).filter(Boolean);
    const allMatch = tireDias.every((td: number) => wheelDias.includes(td));
    
    console.log(`  ${row.year} ${row.make} [${row.display_trim}]: wheels ${wheelDias.join('/')}\" tires R${tireDias.join('/R')} → ${allMatch ? '✅' : '❌'}`);
  }

  await pool.end();
}

main().catch(console.error);
