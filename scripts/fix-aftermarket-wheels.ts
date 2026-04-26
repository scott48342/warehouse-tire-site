/**
 * AFTERMARKET_WHEEL Correction Lane
 * 
 * Goal: Clean OEM wheel arrays by removing non-OEM/custom oversized wheel contamination.
 * 
 * Strategy:
 * 1. Remove wheel sizes exceeding era-appropriate maximums
 * 2. Filter out wheels marked as isStock: false
 * 3. Remove unrealistic wheel spreads
 * 4. Apply OEM wheel lookup when contamination is total
 * 5. Preserve audit trail and recertify
 * 
 * NOTE: This only cleans OEM reference data - does NOT restrict shopping options.
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
// ERA-APPROPRIATE OEM WHEEL LOOKUP
// ============================================================

// Maximum OEM wheel diameters by year
function getMaxOemDiameterForYear(year: number): number {
  if (year < 1970) return 15;
  if (year < 1985) return 15;
  if (year < 1990) return 16;
  if (year < 1995) return 17;
  if (year < 2000) return 18;
  if (year < 2005) return 19;
  if (year < 2010) return 20;
  if (year < 2015) return 22;
  return 24;
}

// OEM wheel sizes by diameter and era
const OEM_WHEEL_LOOKUP: Record<number, { width: number; offset: number }[]> = {
  13: [{ width: 5, offset: 35 }, { width: 5.5, offset: 35 }],
  14: [{ width: 5.5, offset: 40 }, { width: 6, offset: 40 }, { width: 6.5, offset: 40 }],
  15: [{ width: 6, offset: 40 }, { width: 6.5, offset: 40 }, { width: 7, offset: 40 }],
  16: [{ width: 6.5, offset: 40 }, { width: 7, offset: 40 }, { width: 7.5, offset: 45 }],
  17: [{ width: 7, offset: 45 }, { width: 7.5, offset: 45 }, { width: 8, offset: 45 }],
  18: [{ width: 7.5, offset: 45 }, { width: 8, offset: 45 }, { width: 8.5, offset: 45 }],
  19: [{ width: 8, offset: 40 }, { width: 8.5, offset: 40 }, { width: 9, offset: 40 }],
  20: [{ width: 8, offset: 35 }, { width: 8.5, offset: 35 }, { width: 9, offset: 35 }],
  21: [{ width: 8.5, offset: 35 }, { width: 9, offset: 35 }, { width: 9.5, offset: 35 }],
  22: [{ width: 9, offset: 30 }, { width: 9.5, offset: 30 }, { width: 10, offset: 30 }]
};

// Get era-appropriate OEM wheel for a given diameter
function getOemWheelForDiameter(diameter: number, year: number): any {
  const maxDiam = getMaxOemDiameterForYear(year);
  const effectiveDiam = Math.min(diameter, maxDiam);
  
  const lookup = OEM_WHEEL_LOOKUP[effectiveDiam];
  if (!lookup || lookup.length === 0) {
    // Fallback to closest available
    const available = Object.keys(OEM_WHEEL_LOOKUP).map(Number).sort((a, b) => a - b);
    const closest = available.find(d => d >= effectiveDiam) || available[available.length - 1];
    return OEM_WHEEL_LOOKUP[closest]?.[0] || { width: 7, offset: 40 };
  }
  
  return lookup[0];
}

// Get default OEM wheel for era
function getDefaultOemWheel(year: number): any {
  let diameter: number;
  
  if (year < 1970) diameter = 14;
  else if (year < 1985) diameter = 14;
  else if (year < 1990) diameter = 15;
  else if (year < 1995) diameter = 15;
  else if (year < 2000) diameter = 16;
  else if (year < 2005) diameter = 16;
  else if (year < 2010) diameter = 17;
  else if (year < 2015) diameter = 18;
  else diameter = 18;
  
  const spec = getOemWheelForDiameter(diameter, year);
  return {
    axle: 'both',
    diameter,
    width: spec.width,
    offset: spec.offset,
    isStock: true
  };
}

// ============================================================
// WHEEL PARSING & VALIDATION
// ============================================================

function extractWheelDiameter(wheel: any): number | null {
  if (typeof wheel === 'object' && wheel.diameter) {
    return Number(wheel.diameter);
  } else if (typeof wheel === 'string') {
    const match = wheel.match(/(\d+)x/);
    if (match) return parseInt(match[1]);
  }
  return null;
}

function isStockWheel(wheel: any): boolean {
  if (typeof wheel === 'object') {
    return wheel.isStock !== false;
  }
  return true;
}

function isEraAppropriateWheel(wheel: any, year: number): boolean {
  const diameter = extractWheelDiameter(wheel);
  if (!diameter) return false;
  
  const maxDiam = getMaxOemDiameterForYear(year);
  return diameter <= maxDiam;
}

// Get matching tire size for a wheel diameter
function getTireForDiameter(diameter: number, year: number): string {
  const OEM_TIRES: Record<number, Record<string, string>> = {
    13: { 'pre-1990': '175/80R13', '1990+': '175/70R13' },
    14: { 'pre-1990': '195/75R14', '1990+': '195/70R14' },
    15: { 'pre-1990': '205/75R15', '1990+': '205/65R15' },
    16: { 'pre-2000': '215/70R16', '2000+': '215/60R16' },
    17: { 'pre-2005': '225/55R17', '2005+': '225/50R17' },
    18: { 'pre-2010': '235/50R18', '2010+': '235/45R18' },
    19: { 'any': '245/40R19' },
    20: { 'any': '255/45R20' },
    21: { 'any': '265/40R21' },
    22: { 'any': '275/45R22' }
  };
  
  const tireMap = OEM_TIRES[diameter];
  if (!tireMap) return `225/60R${diameter}`;
  
  if (tireMap['any']) return tireMap['any'];
  
  if (diameter <= 15) {
    return year < 1990 ? (tireMap['pre-1990'] || tireMap['1990+']) : (tireMap['1990+'] || tireMap['pre-1990']);
  } else if (diameter <= 17) {
    return year < 2000 ? (tireMap['pre-2000'] || tireMap['2000+']) : (tireMap['2000+'] || tireMap['pre-2000']);
  } else {
    return year < 2010 ? (tireMap['pre-2010'] || tireMap['2010+']) : (tireMap['2010+'] || tireMap['pre-2010']);
  }
}

// ============================================================
// CORRECTION LOGIC
// ============================================================

async function correctAftermarketWheels() {
  console.log('='.repeat(70));
  console.log('AFTERMARKET_WHEEL Correction Lane');
  console.log('='.repeat(70));
  console.log(`DRY_RUN: ${DRY_RUN}\n`);
  
  // Get both AFTERMARKET_WHEEL and AFTERMARKET_WHEELS (typo variant)
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes, bolt_pattern, center_bore_mm,
           certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND (certification_errors::text LIKE '%AFTERMARKET_WHEEL%')
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rows.length} records with AFTERMARKET_WHEEL\n`);
  
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
    
    const wheels = Array.isArray(oemWheels) ? oemWheels : [oemWheels];
    const maxDiam = getMaxOemDiameterForYear(year);
    
    // Filter to era-appropriate stock wheels
    let cleanedWheels: any[] = [];
    
    for (const wheel of wheels) {
      // Skip non-stock wheels
      if (!isStockWheel(wheel)) continue;
      
      // Skip oversized wheels
      if (!isEraAppropriateWheel(wheel, year)) continue;
      
      // Valid wheel - keep it
      if (typeof wheel === 'object') {
        cleanedWheels.push(wheel);
      } else if (typeof wheel === 'string') {
        // Convert string to object format
        const match = wheel.match(/(\d+)x(\d+\.?\d*)/);
        if (match) {
          const diam = parseInt(match[1]);
          const width = parseFloat(match[2]);
          if (diam <= maxDiam) {
            cleanedWheels.push({
              axle: 'both',
              diameter: diam,
              width: width,
              offset: 40,
              isStock: true
            });
          }
        }
      }
    }
    
    let action = 'FILTERED_EXISTING';
    
    // If no valid wheels remain, apply OEM lookup
    if (cleanedWheels.length === 0) {
      const defaultWheel = getDefaultOemWheel(year);
      cleanedWheels = [defaultWheel];
      action = 'APPLIED_OEM_LOOKUP';
      appliedOemLookup++;
    } else {
      filteredExisting++;
    }
    
    // Now clean/generate tires to match the cleaned wheels
    const cleanedWheelDiams = cleanedWheels.map(w => extractWheelDiameter(w)).filter(d => d !== null) as number[];
    
    // Filter existing tires or generate new ones
    let cleanedTires: string[] = [];
    const existingTires = Array.isArray(oemTires) ? oemTires : (oemTires ? [oemTires] : []);
    
    for (const tire of existingTires) {
      if (typeof tire !== 'string') continue;
      const match = tire.match(/R(\d+)/i);
      if (match) {
        const tireDiam = parseInt(match[1]);
        if (cleanedWheelDiams.includes(tireDiam)) {
          if (!cleanedTires.includes(tire)) {
            cleanedTires.push(tire);
          }
        }
      }
    }
    
    // If no matching tires, generate them
    if (cleanedTires.length === 0) {
      for (const diam of cleanedWheelDiams) {
        const tire = getTireForDiameter(diam, year);
        if (!cleanedTires.includes(tire)) {
          cleanedTires.push(tire);
        }
      }
    }
    
    // Validation
    if (cleanedWheels.length === 0 || cleanedTires.length === 0) {
      stillNeedsReview++;
      continue;
    }
    
    // Verify diameter match
    const finalTireDiams = cleanedTires.map(t => {
      if (!t || typeof t !== 'string') return null;
      const m = t.match(/R(\d+)/i);
      return m ? parseInt(m[1]) : null;
    }).filter(d => d !== null) as number[];
    
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
    
    const beforeWheels = Array.isArray(ba.before.wheels) ? ba.before.wheels : [ba.before.wheels];
    const afterWheels = Array.isArray(ba.after.wheels) ? ba.after.wheels : [ba.after.wheels];
    
    const beforeStr = beforeWheels.map((w: any) => {
      if (typeof w === 'object') return `${w.diameter}x${w.width}${w.isStock === false ? '*' : ''}`;
      return w;
    }).join(', ');
    
    const afterStr = afterWheels.map((w: any) => {
      if (typeof w === 'object') return `${w.diameter}x${w.width}`;
      return w;
    }).join(', ');
    
    console.log(`  BEFORE wheels: ${beforeStr.substring(0, 80)}`);
    console.log(`  AFTER wheels: ${afterStr}`);
    
    const afterTires = Array.isArray(ba.after.tires) ? ba.after.tires : [ba.after.tires];
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
        AND (certification_errors::text LIKE '%AFTERMARKET_WHEEL%')
    `);
    
    console.log(`\n  Remaining AFTERMARKET_WHEEL: ${remaining.rows[0].cnt}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('AFTERMARKET_WHEEL CORRECTION COMPLETE');
  console.log('='.repeat(70));
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN mode - no changes written. Run without --dry-run to apply.');
  }
}

correctAftermarketWheels().catch(console.error).finally(() => pool.end());
