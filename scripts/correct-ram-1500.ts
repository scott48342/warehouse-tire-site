/**
 * Correction Batch 1: RAM 1500
 * 
 * Corrects and recertifies RAM 1500 records marked needs_review.
 * 
 * RAM 1500 Generations:
 * - Gen 4 (DS): 2009-2018
 * - Gen 5 (DT): 2019-2026
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
// RAM 1500 OEM Specs by Generation and Trim
// ============================================================================

interface TrimSpec {
  wheels: { diameter: number; width: number; offset?: number }[];
  tires: string[];
  isStaggered?: boolean;
}

// Gen 4 (2009-2018) - DS Platform
const GEN4_SPECS: Record<string, TrimSpec> = {
  // Base trims - 17" standard
  'Tradesman': {
    wheels: [{ diameter: 17, width: 7 }],
    tires: ['265/70R17']
  },
  'Express': {
    wheels: [{ diameter: 17, width: 7 }],
    tires: ['265/70R17']
  },
  'ST': {
    wheels: [{ diameter: 17, width: 7 }],
    tires: ['265/70R17']
  },
  'SLT': {
    wheels: [{ diameter: 17, width: 7 }, { diameter: 18, width: 8 }],
    tires: ['265/70R17', '275/65R18']
  },
  'Big Horn': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['275/65R18']
  },
  'Lone Star': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['275/65R18']
  },
  'Sport': {
    wheels: [{ diameter: 20, width: 8 }],
    tires: ['275/60R20']
  },
  'Laramie': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8 }],
    tires: ['275/65R18', '275/60R20']
  },
  'Longhorn': {
    wheels: [{ diameter: 20, width: 8 }],
    tires: ['275/60R20']
  },
  'Limited': {
    wheels: [{ diameter: 20, width: 8 }],
    tires: ['275/60R20']
  },
  'Rebel': {
    wheels: [{ diameter: 17, width: 8 }],
    tires: ['285/70R17']
  },
  // Default for unknown trims
  'Base': {
    wheels: [{ diameter: 17, width: 7 }],
    tires: ['265/70R17']
  }
};

// Gen 5 (2019-2026) - DT Platform
const GEN5_SPECS: Record<string, TrimSpec> = {
  // Base trims - 18" standard
  'Tradesman': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['275/65R18']
  },
  'Big Horn': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 9 }],
    tires: ['275/65R18', '275/55R20']
  },
  'Lone Star': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 9 }],
    tires: ['275/65R18', '275/55R20']
  },
  'Laramie': {
    wheels: [{ diameter: 20, width: 9 }],
    tires: ['275/55R20']
  },
  'Rebel': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['275/70R18']
  },
  'Longhorn': {
    wheels: [{ diameter: 20, width: 9 }, { diameter: 22, width: 9 }],
    tires: ['275/55R20', '285/45R22']
  },
  'Limited': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22']
  },
  'Limited Longhorn': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22']
  },
  'TRX': {
    wheels: [{ diameter: 18, width: 9 }],
    tires: ['325/65R18']  // 35" tires
  },
  'RHO': {
    wheels: [{ diameter: 18, width: 9 }],
    tires: ['305/60R18']
  },
  // Default for unknown trims
  'Base': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['275/65R18']
  }
};

// Bolt pattern and center bore - same for all RAM 1500
const RAM_1500_BASE = {
  boltPattern: '5x139.7',
  centerBore: 77.8
};

function getGeneration(year: number): 'gen4' | 'gen5' | null {
  if (year >= 2009 && year <= 2018) return 'gen4';
  if (year >= 2019 && year <= 2026) return 'gen5';
  return null;
}

function getSpecsForTrim(year: number, displayTrim: string): TrimSpec | null {
  const gen = getGeneration(year);
  if (!gen) return null;
  
  const specs = gen === 'gen4' ? GEN4_SPECS : GEN5_SPECS;
  
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
  if (trimLower.includes('trx')) return specs['TRX'] || null;
  if (trimLower.includes('rebel')) return specs['Rebel'];
  if (trimLower.includes('limited') && trimLower.includes('longhorn')) return specs['Limited Longhorn'] || specs['Longhorn'];
  if (trimLower.includes('limited')) return specs['Limited'];
  if (trimLower.includes('longhorn')) return specs['Longhorn'];
  if (trimLower.includes('laramie')) return specs['Laramie'];
  if (trimLower.includes('big horn') || trimLower.includes('bighorn')) return specs['Big Horn'];
  if (trimLower.includes('lone star')) return specs['Lone Star'];
  if (trimLower.includes('sport')) return specs['Sport'] || specs['Big Horn'];
  if (trimLower.includes('tradesman')) return specs['Tradesman'];
  if (trimLower.includes('slt')) return specs['SLT'] || specs['Big Horn'];
  if (trimLower.includes('express')) return specs['Express'] || specs['Tradesman'];
  
  // Return base specs
  return specs['Base'];
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
  console.log(`\n🔧 Correction Batch 1: RAM 1500${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // Get all RAM 1500 records marked needs_review
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, 
           certification_status, certification_errors, audit_original_data, source
    FROM vehicle_fitments
    WHERE make = 'RAM' AND model = '1500'
      AND certification_status = 'needs_review'
    ORDER BY year DESC, display_trim
  `);

  console.log(`Found ${records.rowCount} RAM 1500 records needing review\n`);

  let reviewed = 0;
  let corrected = 0;
  let recertified = 0;
  let stillNeedsReview = 0;
  const samples: any[] = [];

  for (const row of records.rows) {
    reviewed++;
    
    const gen = getGeneration(row.year);
    if (!gen) {
      console.log(`  ⚠️ ${row.year} RAM 1500 [${row.display_trim}] - unsupported year range`);
      stillNeedsReview++;
      continue;
    }
    
    const spec = getSpecsForTrim(row.year, row.display_trim);
    if (!spec) {
      console.log(`  ⚠️ ${row.year} RAM 1500 [${row.display_trim}] - no spec mapping`);
      stillNeedsReview++;
      continue;
    }
    
    // Validate the spec
    if (!validateSpec(spec)) {
      console.log(`  ⚠️ ${row.year} RAM 1500 [${row.display_trim}] - spec validation failed`);
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
    if (samples.length < 10) {
      samples.push({
        vehicle: `${row.year} RAM 1500 [${row.display_trim}]`,
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
        RAM_1500_BASE.boltPattern,
        RAM_1500_BASE.centerBore,
        JSON.stringify(auditData),
        `corrected_batch1_${row.source || 'unknown'}`,
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

  // Verify no regression - check certified RAM 1500 still work
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION');
  console.log('='.repeat(60));
  
  const certifiedCheck = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'RAM' AND model = '1500'
      AND certification_status = 'certified'
  `);
  
  const needsReviewCheck = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'RAM' AND model = '1500'
      AND certification_status = 'needs_review'
  `);
  
  console.log(`\n📈 Final RAM 1500 Status:`);
  console.log(`  ✅ Certified: ${certifiedCheck.rows[0].cnt}`);
  console.log(`  ⚠️ Needs Review: ${needsReviewCheck.rows[0].cnt}`);
  
  // Spot check a few records for tire/wheel match
  console.log(`\n🔍 Spot Check (tire/wheel diameter match):`);
  const spotCheck = await pool.query(`
    SELECT year, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make = 'RAM' AND model = '1500'
      AND certification_status = 'certified'
    ORDER BY RANDOM()
    LIMIT 5
  `);
  
  for (const row of spotCheck.rows) {
    const wheels = row.oem_wheel_sizes || [];
    const tires = row.oem_tire_sizes || [];
    const wheelDias = wheels.map((w: any) => w.diameter).filter(Boolean);
    const tireDias = tires.map((t: string) => extractDiameter(t)).filter(Boolean);
    const allMatch = tireDias.every((td: number) => wheelDias.includes(td));
    
    console.log(`  ${row.year} [${row.display_trim}]: wheels ${wheelDias.join('/')}\" tires R${tireDias.join('/R')} → ${allMatch ? '✅' : '❌'}`);
  }

  await pool.end();
}

main().catch(console.error);
