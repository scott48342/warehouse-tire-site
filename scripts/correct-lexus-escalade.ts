/**
 * Correction Batch 3: Lexus LX + Cadillac Escalade
 * 
 * Corrects and recertifies Lexus LX and Cadillac Escalade records marked needs_review.
 * 
 * Lexus LX Generations:
 * - LX 450 (J80): 1996-1997
 * - LX 470 (J100): 1998-2007
 * - LX 570 (J200): 2008-2021
 * - LX 600 (J300): 2022-present
 * 
 * Cadillac Escalade Generations:
 * - Gen 1 (GMT400): 1999-2000
 * - Gen 2 (GMT800): 2002-2006
 * - Gen 3 (GMT900): 2007-2014
 * - Gen 4 (K2XL): 2015-2020
 * - Gen 5 (T1XX): 2021-present
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
// Lexus LX OEM Specs by Generation
// ============================================================================

interface TrimSpec {
  wheels: { diameter: number; width: number; offset?: number }[];
  tires: string[];
  boltPattern: string;
  centerBore: number;
}

// LX 450 (1996-1997) - J80 Platform
const LX450_SPEC: TrimSpec = {
  wheels: [{ diameter: 16, width: 8 }],
  tires: ['275/70R16'],
  boltPattern: '6x139.7',
  centerBore: 106.1
};

// LX 470 (1998-2007) - J100 Platform
const LX470_SPEC: TrimSpec = {
  wheels: [{ diameter: 18, width: 8 }],
  tires: ['275/60R18'],
  boltPattern: '5x150',
  centerBore: 110.1
};

// LX 570 (2008-2021) - J200 Platform
const LX570_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 8.5 }],
    tires: ['285/60R18', '275/50R20'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'Sport Package': {
    wheels: [{ diameter: 21, width: 8.5 }],
    tires: ['275/50R21'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'Luxury': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/50R20'],
    boltPattern: '5x150',
    centerBore: 110.1
  }
};

// LX 600 (2022-present) - J300 Platform
const LX600_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['265/55R20'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'Premium': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['265/55R20'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'Luxury': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['265/55R20'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'F Sport': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['265/45R22'],
    boltPattern: '5x150',
    centerBore: 110.1
  },
  'Ultra Luxury': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['265/45R22'],
    boltPattern: '5x150',
    centerBore: 110.1
  }
};

// ============================================================================
// Cadillac Escalade OEM Specs by Generation
// ============================================================================

// Gen 1 (1999-2000) - GMT400
const ESCALADE_GEN1_SPEC: TrimSpec = {
  wheels: [{ diameter: 16, width: 7 }],
  tires: ['265/70R16'],
  boltPattern: '6x139.7',
  centerBore: 78.1
};

// Gen 2 (2002-2006) - GMT800
const ESCALADE_GEN2_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'ESV': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'EXT': {
    wheels: [{ diameter: 17, width: 7.5 }],
    tires: ['265/70R17'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Platinum': {
    wheels: [{ diameter: 20, width: 8 }],
    tires: ['275/55R20'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  }
};

// Gen 3 (2007-2014) - GMT900
const ESCALADE_GEN3_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 18, width: 8 }],
    tires: ['265/65R18'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Luxury': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Premium': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Platinum': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'ESV': {
    wheels: [{ diameter: 18, width: 8 }, { diameter: 22, width: 9 }],
    tires: ['265/65R18', '285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Hybrid': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  }
};

// Gen 4 (2015-2020) - K2XL
const ESCALADE_GEN4_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Luxury': {
    wheels: [{ diameter: 20, width: 8.5 }],
    tires: ['275/55R20'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Premium': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Premium Luxury': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Platinum': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'ESV': {
    wheels: [{ diameter: 20, width: 8.5 }, { diameter: 22, width: 9 }],
    tires: ['275/55R20', '285/45R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  }
};

// Gen 5 (2021-present) - T1XX
const ESCALADE_GEN5_SPECS: Record<string, TrimSpec> = {
  'Base': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Luxury': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Premium Luxury': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Premium Luxury Platinum': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Sport': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Sport Platinum': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'V': {
    wheels: [{ diameter: 22, width: 9 }],
    tires: ['275/50R22'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'ESV': {
    wheels: [{ diameter: 22, width: 9 }, { diameter: 24, width: 9 }],
    tires: ['275/50R22', '285/40R24'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  },
  'Platinum': {
    wheels: [{ diameter: 22, width: 9 }, { diameter: 24, width: 9 }],
    tires: ['275/50R22', '285/40R24'],
    boltPattern: '6x139.7',
    centerBore: 78.1
  }
};

function getLexusLXSpec(year: number, model: string, displayTrim: string): TrimSpec | null {
  const modelLower = model.toLowerCase();
  const trimLower = displayTrim.toLowerCase();
  
  // LX 450
  if (year >= 1996 && year <= 1997) {
    return LX450_SPEC;
  }
  
  // LX 470
  if (year >= 1998 && year <= 2007) {
    return LX470_SPEC;
  }
  
  // LX 570
  if (year >= 2008 && year <= 2021) {
    if (trimLower.includes('sport')) return LX570_SPECS['Sport Package'];
    if (trimLower.includes('luxury')) return LX570_SPECS['Luxury'];
    return LX570_SPECS['Base'];
  }
  
  // LX 600
  if (year >= 2022) {
    if (trimLower.includes('ultra')) return LX600_SPECS['Ultra Luxury'];
    if (trimLower.includes('f sport') || trimLower.includes('f-sport')) return LX600_SPECS['F Sport'];
    if (trimLower.includes('luxury')) return LX600_SPECS['Luxury'];
    if (trimLower.includes('premium')) return LX600_SPECS['Premium'];
    return LX600_SPECS['Base'];
  }
  
  return null;
}

function getEscaladeSpec(year: number, displayTrim: string): TrimSpec | null {
  const trimLower = displayTrim.toLowerCase();
  
  // Gen 1 (1999-2000)
  if (year >= 1999 && year <= 2000) {
    return ESCALADE_GEN1_SPEC;
  }
  
  // Gen 2 (2002-2006)
  if (year >= 2002 && year <= 2006) {
    if (trimLower.includes('platinum')) return ESCALADE_GEN2_SPECS['Platinum'];
    if (trimLower.includes('ext')) return ESCALADE_GEN2_SPECS['EXT'];
    if (trimLower.includes('esv')) return ESCALADE_GEN2_SPECS['ESV'];
    return ESCALADE_GEN2_SPECS['Base'];
  }
  
  // Gen 3 (2007-2014)
  if (year >= 2007 && year <= 2014) {
    if (trimLower.includes('platinum')) return ESCALADE_GEN3_SPECS['Platinum'];
    if (trimLower.includes('premium')) return ESCALADE_GEN3_SPECS['Premium'];
    if (trimLower.includes('hybrid')) return ESCALADE_GEN3_SPECS['Hybrid'];
    if (trimLower.includes('esv')) return ESCALADE_GEN3_SPECS['ESV'];
    if (trimLower.includes('luxury')) return ESCALADE_GEN3_SPECS['Luxury'];
    return ESCALADE_GEN3_SPECS['Base'];
  }
  
  // Gen 4 (2015-2020)
  if (year >= 2015 && year <= 2020) {
    if (trimLower.includes('platinum')) return ESCALADE_GEN4_SPECS['Platinum'];
    if (trimLower.includes('premium luxury')) return ESCALADE_GEN4_SPECS['Premium Luxury'];
    if (trimLower.includes('premium')) return ESCALADE_GEN4_SPECS['Premium'];
    if (trimLower.includes('esv')) return ESCALADE_GEN4_SPECS['ESV'];
    if (trimLower.includes('luxury')) return ESCALADE_GEN4_SPECS['Luxury'];
    return ESCALADE_GEN4_SPECS['Base'];
  }
  
  // Gen 5 (2021-present)
  if (year >= 2021) {
    if (trimLower.includes('v') && !trimLower.includes('esv')) return ESCALADE_GEN5_SPECS['V'];
    if (trimLower.includes('sport platinum')) return ESCALADE_GEN5_SPECS['Sport Platinum'];
    if (trimLower.includes('sport')) return ESCALADE_GEN5_SPECS['Sport'];
    if (trimLower.includes('premium luxury platinum')) return ESCALADE_GEN5_SPECS['Premium Luxury Platinum'];
    if (trimLower.includes('platinum')) return ESCALADE_GEN5_SPECS['Platinum'];
    if (trimLower.includes('premium luxury')) return ESCALADE_GEN5_SPECS['Premium Luxury'];
    if (trimLower.includes('esv')) return ESCALADE_GEN5_SPECS['ESV'];
    if (trimLower.includes('luxury')) return ESCALADE_GEN5_SPECS['Luxury'];
    return ESCALADE_GEN5_SPECS['Base'];
  }
  
  return null;
}

function extractDiameter(tireSize: string): number | null {
  const match = tireSize.match(/R(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function validateSpec(spec: TrimSpec): boolean {
  const wheelDiameters = spec.wheels.map(w => w.diameter);
  const tireDiameters = spec.tires.map(t => extractDiameter(t)).filter(Boolean) as number[];
  return tireDiameters.every(td => wheelDiameters.includes(td));
}

async function main() {
  console.log(`\n🔧 Correction Batch 3: Lexus LX + Cadillac Escalade${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // Get all Lexus LX and Cadillac Escalade records marked needs_review
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes, 
           certification_status, certification_errors, audit_original_data, source
    FROM vehicle_fitments
    WHERE ((make = 'Lexus' AND model ILIKE '%lx%')
       OR (make = 'Cadillac' AND model ILIKE '%escalade%'))
      AND certification_status = 'needs_review'
    ORDER BY make, year DESC, display_trim
  `);

  console.log(`Found ${records.rowCount} Lexus LX / Cadillac Escalade records needing review\n`);

  let reviewed = 0;
  let corrected = 0;
  let recertified = 0;
  let stillNeedsReview = 0;
  const samples: any[] = [];
  
  const byVehicle: Record<string, number> = {};

  for (const row of records.rows) {
    reviewed++;
    
    const vehicleKey = `${row.make} ${row.model}`;
    byVehicle[vehicleKey] = (byVehicle[vehicleKey] || 0) + 1;
    
    let spec: TrimSpec | null = null;
    
    if (row.make === 'Lexus') {
      spec = getLexusLXSpec(row.year, row.model, row.display_trim);
    } else if (row.make === 'Cadillac') {
      spec = getEscaladeSpec(row.year, row.display_trim);
    }
    
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
        spec.boltPattern,
        spec.centerBore,
        JSON.stringify(auditData),
        `corrected_batch3_${row.source || 'unknown'}`,
        row.id
      ]);
    }
    
    corrected++;
    recertified++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('CORRECTION RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n📊 By Vehicle:`);
  for (const [vehicle, count] of Object.entries(byVehicle).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${vehicle}: ${count}`);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Records reviewed: ${reviewed}`);
  console.log(`  Records corrected: ${corrected}`);
  console.log(`  Records recertified: ${recertified}`);
  console.log(`  Still needs review: ${stillNeedsReview}`);
  
  console.log(`\n📋 Sample corrections:`);
  for (const s of samples) {
    console.log(`\n  ${s.vehicle}`);
    console.log(`    Before wheels: ${JSON.stringify(s.before.wheels)?.substring(0, 60)}...`);
    console.log(`    Before tires:  ${JSON.stringify(s.before.tires)}`);
    console.log(`    After wheels:  ${JSON.stringify(s.after.wheels)}`);
    console.log(`    After tires:   ${JSON.stringify(s.after.tires)}`);
  }

  // Validation
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION');
  console.log('='.repeat(60));
  
  // Check final counts
  const lexusCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Lexus' AND model ILIKE '%lx%'
      AND (certification_status = 'certified' OR certification_status IS NULL)
  `);
  const lexusReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Lexus' AND model ILIKE '%lx%'
      AND certification_status = 'needs_review'
  `);
  
  const escaladeCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Cadillac' AND model ILIKE '%escalade%'
      AND (certification_status = 'certified' OR certification_status IS NULL)
  `);
  const escaladeReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE make = 'Cadillac' AND model ILIKE '%escalade%'
      AND certification_status = 'needs_review'
  `);
  
  console.log(`\n📈 Final Status:`);
  console.log(`  Lexus LX:`);
  console.log(`    ✅ Certified: ${lexusCertified.rows[0].cnt}`);
  console.log(`    ⚠️ Needs Review: ${lexusReview.rows[0].cnt}`);
  console.log(`  Cadillac Escalade:`);
  console.log(`    ✅ Certified: ${escaladeCertified.rows[0].cnt}`);
  console.log(`    ⚠️ Needs Review: ${escaladeReview.rows[0].cnt}`);
  
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
    WHERE ((make = 'Lexus' AND model ILIKE '%lx%')
       OR (make = 'Cadillac' AND model ILIKE '%escalade%'))
      AND (certification_status = 'certified' OR certification_status IS NULL)
    ORDER BY RANDOM()
    LIMIT 6
  `);
  
  for (const row of spotCheck.rows) {
    const wheels = row.oem_wheel_sizes || [];
    const tires = row.oem_tire_sizes || [];
    const wheelDias = wheels.map((w: any) => w.diameter).filter(Boolean);
    const tireDias = tires.map((t: string) => extractDiameter(t)).filter(Boolean);
    const allMatch = tireDias.length === 0 || tireDias.every((td: number) => wheelDias.includes(td));
    
    console.log(`  ${row.year} ${row.make} [${row.display_trim}]: wheels ${wheelDias.join('/')}\" tires R${tireDias.join('/R') || 'none'} → ${allMatch ? '✅' : '❌'}`);
  }

  await pool.end();
}

main().catch(console.error);
