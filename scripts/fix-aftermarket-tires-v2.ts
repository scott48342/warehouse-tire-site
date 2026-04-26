/**
 * AFTERMARKET_TIRES Correction Lane v2
 * 
 * Handles two cases:
 * 1. Partial contamination: Filter out non-matching tires
 * 2. Total contamination: Apply era-appropriate OEM tire sizes based on wheel diameter
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
// ERA-APPROPRIATE OEM TIRE SIZE LOOKUP
// ============================================================

// Common OEM tire sizes by wheel diameter and era
// These are typical factory sizes - not exhaustive but covers most cases
const OEM_TIRE_LOOKUP: Record<number, Record<string, string[]>> = {
  13: {
    'pre-1980': ['175/80R13', '185/80R13'],
    '1980-1990': ['175/70R13', '185/70R13', '175/80R13'],
    '1990+': ['175/70R13', '185/70R13']
  },
  14: {
    'pre-1980': ['195/75R14', '205/75R14', '215/75R14', 'FR78-14', 'GR78-14'],
    '1980-1990': ['185/75R14', '195/75R14', '205/70R14', '195/70R14'],
    '1990+': ['185/65R14', '195/65R14', '185/70R14', '195/70R14', '205/70R14']
  },
  15: {
    'pre-1980': ['215/75R15', '225/75R15', 'GR78-15', 'HR78-15', 'LR78-15'],
    '1980-1990': ['195/75R15', '205/75R15', '215/75R15', '205/70R15', '215/70R15', '225/70R15'],
    '1990-2000': ['195/65R15', '205/65R15', '205/70R15', '215/65R15', '225/60R15'],
    '2000+': ['195/65R15', '205/65R15', '215/60R15', '225/60R15']
  },
  16: {
    'pre-1990': ['205/70R16', '215/70R16', '225/70R16', '245/75R16'],
    '1990-2000': ['205/60R16', '205/65R16', '215/55R16', '225/55R16', '225/60R16'],
    '2000+': ['205/55R16', '215/55R16', '215/60R16', '225/60R16', '235/60R16']
  },
  17: {
    'pre-2000': ['215/55R17', '225/55R17', '235/55R17', '245/55R17'],
    '2000-2010': ['215/50R17', '225/50R17', '225/55R17', '235/55R17', '245/65R17', '265/70R17'],
    '2010+': ['215/55R17', '225/50R17', '225/55R17', '235/55R17', '245/65R17', '265/65R17']
  },
  18: {
    'pre-2005': ['225/45R18', '235/50R18', '245/45R18', '255/55R18'],
    '2005-2015': ['225/45R18', '235/45R18', '245/45R18', '255/55R18', '265/60R18', '275/65R18'],
    '2015+': ['225/45R18', '235/45R18', '245/45R18', '255/55R18', '265/60R18', '275/65R18']
  },
  19: {
    'pre-2010': ['245/40R19', '255/40R19', '275/40R19'],
    '2010+': ['235/40R19', '245/40R19', '255/40R19', '275/40R19', '255/50R19', '255/55R19']
  },
  20: {
    'pre-2010': ['245/45R20', '255/45R20', '275/45R20', '285/50R20'],
    '2010+': ['245/40R20', '255/45R20', '265/50R20', '275/55R20', '275/60R20', '285/50R20']
  },
  21: {
    '2015+': ['265/40R21', '275/40R21', '285/40R21', '295/35R21']
  },
  22: {
    '2015+': ['275/45R22', '285/45R22', '305/40R22', '275/50R22', '285/50R22']
  }
};

// Vehicle type hints for tire selection
const TRUCK_MAKES = ['Ford', 'Chevrolet', 'GMC', 'RAM', 'Dodge', 'Toyota', 'Nissan'];
const TRUCK_MODELS = ['f-150', 'f-250', 'f-350', 'silverado', 'sierra', 'ram', 'tundra', 'titan', 'tacoma', 'colorado', 'canyon', 'ranger'];

function getEraKey(year: number, diameter: number): string {
  if (diameter <= 15) {
    if (year < 1980) return 'pre-1980';
    if (year < 1990) return '1980-1990';
    if (year < 2000) return '1990-2000';
    return '2000+';
  } else if (diameter === 16) {
    if (year < 1990) return 'pre-1990';
    if (year < 2000) return '1990-2000';
    return '2000+';
  } else if (diameter === 17) {
    if (year < 2000) return 'pre-2000';
    if (year < 2010) return '2000-2010';
    return '2010+';
  } else if (diameter === 18) {
    if (year < 2005) return 'pre-2005';
    if (year < 2015) return '2005-2015';
    return '2015+';
  } else if (diameter === 19) {
    if (year < 2010) return 'pre-2010';
    return '2010+';
  } else if (diameter === 20) {
    if (year < 2010) return 'pre-2010';
    return '2010+';
  } else {
    return '2015+';
  }
}

function getOemTiresForWheel(diameter: number, year: number, make: string, model: string): string[] {
  const lookup = OEM_TIRE_LOOKUP[diameter];
  if (!lookup) return [];
  
  const eraKey = getEraKey(year, diameter);
  
  // Try exact era match first
  if (lookup[eraKey]) return lookup[eraKey];
  
  // Fall back to any available era
  const keys = Object.keys(lookup);
  for (const key of keys) {
    if (lookup[key]) return lookup[key];
  }
  
  return [];
}

function isTruck(make: string, model: string): boolean {
  const makeMatch = TRUCK_MAKES.some(m => make.toLowerCase().includes(m.toLowerCase()));
  const modelMatch = TRUCK_MODELS.some(m => model.toLowerCase().includes(m));
  return makeMatch && modelMatch;
}

// ============================================================
// TIRE SIZE PARSING
// ============================================================

function extractTireDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return Math.floor(parseFloat(match[1]));
}

function extractWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const wheels = Array.isArray(oemWheelSizes) ? oemWheelSizes : [oemWheelSizes];
  
  for (const wheel of wheels) {
    if (typeof wheel === 'object' && wheel.diameter) {
      const d = Number(wheel.diameter);
      if (d > 0 && !diameters.includes(d)) diameters.push(d);
    } else if (typeof wheel === 'string') {
      const match = wheel.match(/(\d+)x/);
      if (match) {
        const d = parseInt(match[1]);
        if (d > 0 && !diameters.includes(d)) diameters.push(d);
      }
    }
  }
  
  return diameters.sort((a, b) => a - b);
}

function getMaxOemDiameterForYear(year: number): number {
  if (year < 1970) return 15;
  if (year < 1985) return 16;
  if (year < 1995) return 17;
  if (year < 2000) return 18;
  if (year < 2005) return 19;
  if (year < 2010) return 20;
  if (year < 2015) return 22;
  return 24;
}

function isStockWheel(wheel: any): boolean {
  if (typeof wheel === 'object') {
    return wheel.isStock !== false;
  }
  return true;
}

// ============================================================
// CORRECTION LOGIC
// ============================================================

async function correctAftermarketTires() {
  console.log('='.repeat(70));
  console.log('AFTERMARKET_TIRES CORRECTION LANE v2');
  console.log('='.repeat(70));
  console.log(`DRY_RUN: ${DRY_RUN}\n`);
  
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rows.length} records with AFTERMARKET_TIRES\n`);
  
  let processed = 0;
  let recertified = 0;
  let stillNeedsReview = 0;
  let filteredExisting = 0;
  let appliedOemLookup = 0;
  
  const byFamily: Record<string, { processed: number; recertified: number }> = {};
  const beforeAfter: { before: any; after: any; action: string }[] = [];
  
  for (const record of result.rows) {
    const { id, year, make, model, raw_trim } = record;
    const family = `${make} ${model}`;
    
    if (!byFamily[family]) {
      byFamily[family] = { processed: 0, recertified: 0 };
    }
    byFamily[family].processed++;
    processed++;
    
    const oemWheels = record.oem_wheel_sizes;
    const oemTires = record.oem_tire_sizes;
    
    if (!oemWheels) {
      stillNeedsReview++;
      continue;
    }
    
    // Get wheel diameters (prioritize stock wheels)
    const allWheels = Array.isArray(oemWheels) ? oemWheels : [oemWheels];
    const stockWheels = allWheels.filter(w => isStockWheel(w));
    const wheelDiams = extractWheelDiameters(stockWheels.length > 0 ? stockWheels : allWheels);
    
    if (wheelDiams.length === 0) {
      stillNeedsReview++;
      continue;
    }
    
    // Filter wheels to era-appropriate and stock only
    const maxDiam = getMaxOemDiameterForYear(year);
    const cleanedWheels = allWheels.filter(w => {
      if (!isStockWheel(w)) return false;
      const d = typeof w === 'object' ? w.diameter : parseInt(String(w).match(/(\d+)x/)?.[1] || '0');
      return d > 0 && d <= maxDiam;
    });
    
    if (cleanedWheels.length === 0) {
      stillNeedsReview++;
      continue;
    }
    
    const cleanedWheelDiams = extractWheelDiameters(cleanedWheels);
    
    // Try to filter existing tires first
    const tireArray = Array.isArray(oemTires) ? oemTires : (oemTires ? [oemTires] : []);
    let cleanedTires: string[] = [];
    
    for (const tire of tireArray) {
      if (!tire || typeof tire !== 'string') continue;
      const tireDiam = extractTireDiameter(tire);
      if (tireDiam && cleanedWheelDiams.includes(tireDiam)) {
        if (!cleanedTires.includes(tire)) {
          cleanedTires.push(tire);
        }
      }
    }
    
    let action = 'FILTERED_EXISTING';
    
    // If no valid tires found, apply OEM lookup
    if (cleanedTires.length === 0) {
      for (const diam of cleanedWheelDiams) {
        const oemTires = getOemTiresForWheel(diam, year, make, model);
        // Pick first 2 appropriate sizes
        for (const tire of oemTires.slice(0, 2)) {
          if (!cleanedTires.includes(tire)) {
            cleanedTires.push(tire);
          }
        }
      }
      action = 'APPLIED_OEM_LOOKUP';
      appliedOemLookup++;
    } else {
      filteredExisting++;
    }
    
    if (cleanedTires.length === 0) {
      stillNeedsReview++;
      continue;
    }
    
    // Final validation
    const finalTireDiams = cleanedTires.map(t => extractTireDiameter(t)).filter(d => d !== null) as number[];
    const allMatch = finalTireDiams.every(td => cleanedWheelDiams.includes(td));
    
    if (!allMatch) {
      stillNeedsReview++;
      continue;
    }
    
    // Store before/after
    if (beforeAfter.length < 15) {
      beforeAfter.push({
        before: { year, make, model, trim: raw_trim, wheels: oemWheels, tires: oemTires },
        after: { year, make, model, trim: raw_trim, wheels: cleanedWheels, tires: cleanedTires },
        action
      });
    }
    
    // Apply correction
    if (!DRY_RUN) {
      const auditData = record.audit_original_data || {
        original_wheels: oemWheels,
        original_tires: oemTires,
        captured_at: new Date().toISOString()
      };
      
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          oem_wheel_sizes = $1,
          oem_tire_sizes = $2,
          certification_status = 'certified',
          certification_errors = '[]'::jsonb,
          audit_original_data = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        JSON.stringify(cleanedWheels),
        JSON.stringify(cleanedTires),
        JSON.stringify(auditData),
        id
      ]);
    }
    
    recertified++;
    byFamily[family].recertified++;
  }
  
  // Summary
  console.log('='.repeat(70));
  console.log('CORRECTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nTotal processed: ${processed}`);
  console.log(`Recertified: ${recertified}`);
  console.log(`  - Filtered existing: ${filteredExisting}`);
  console.log(`  - Applied OEM lookup: ${appliedOemLookup}`);
  console.log(`Still needs_review: ${stillNeedsReview}`);
  
  // Top families
  const sortedFamilies = Object.entries(byFamily)
    .filter(([_, data]) => data.recertified > 0)
    .sort((a, b) => b[1].recertified - a[1].recertified)
    .slice(0, 25);
  
  console.log('\n=== TOP FAMILIES CORRECTED ===');
  console.log('| Family | Processed | Recertified |');
  console.log('|--------|-----------|-------------|');
  for (const [family, data] of sortedFamilies) {
    console.log(`| ${family.padEnd(30)} | ${String(data.processed).padStart(9)} | ${String(data.recertified).padStart(11)} |`);
  }
  
  // Before/After examples
  console.log('\n=== BEFORE/AFTER EXAMPLES ===');
  for (const ba of beforeAfter.slice(0, 8)) {
    console.log(`\n${ba.before.year} ${ba.before.make} ${ba.before.model} "${ba.before.trim}" [${ba.action}]:`);
    
    const beforeTires = Array.isArray(ba.before.tires) ? ba.before.tires : [ba.before.tires];
    const afterTires = Array.isArray(ba.after.tires) ? ba.after.tires : [ba.after.tires];
    
    const beforeWheels = extractWheelDiameters(ba.before.wheels);
    const afterWheels = extractWheelDiameters(ba.after.wheels);
    
    console.log(`  Wheels: ${beforeWheels.join('", ')}"`);
    console.log(`  BEFORE tires: ${beforeTires.slice(0, 4).join(', ')}${beforeTires.length > 4 ? '...' : ''}`);
    console.log(`  AFTER tires: ${afterTires.join(', ')}`);
  }
  
  // Final counts
  if (!DRY_RUN) {
    const finalCounts = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY certification_status
    `);
    
    console.log('\n=== FINAL STATUS ===');
    for (const r of finalCounts.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
    
    const remaining = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE certification_status = 'needs_review'
        AND certification_errors::text LIKE '%AFTERMARKET_TIRES%'
    `);
    
    console.log(`\n  Remaining AFTERMARKET_TIRES: ${remaining.rows[0].cnt}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('AFTERMARKET_TIRES CORRECTION COMPLETE');
  console.log('='.repeat(70));
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN mode - no changes written. Run without --dry-run to apply.');
  }
}

correctAftermarketTires().catch(console.error).finally(() => pool.end());
