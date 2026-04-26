/**
 * AFTERMARKET_TIRES Correction Lane
 * 
 * Goal: Clean OEM tire arrays by removing non-OEM/custom tire contamination.
 * 
 * Strategy:
 * 1. Extract valid OEM wheel diameters from oem_wheel_sizes
 * 2. Filter oem_tire_sizes to only sizes matching those diameters
 * 3. Apply era-appropriate sanity filters
 * 4. Preserve legitimate multiple OEM options
 * 5. Recertify only records that pass strict validation
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
// TIRE SIZE PARSING & VALIDATION
// ============================================================

function extractTireDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  // Match R followed by diameter: 225/55R17, P265/70R17, LT275/65R18, 33x12.50R15
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
      // Parse string format like "17x7.5"
      const match = wheel.match(/(\d+)x/);
      if (match) {
        const d = parseInt(match[1]);
        if (d > 0 && !diameters.includes(d)) diameters.push(d);
      }
    }
  }
  
  return diameters.sort((a, b) => a - b);
}

function isStockWheel(wheel: any): boolean {
  if (typeof wheel === 'object') {
    return wheel.isStock === true || wheel.isStock === undefined;
  }
  return true; // String format wheels are assumed stock
}

function getStockWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const wheels = Array.isArray(oemWheelSizes) ? oemWheelSizes : [oemWheelSizes];
  
  for (const wheel of wheels) {
    if (!isStockWheel(wheel)) continue;
    
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

// Era-appropriate maximum wheel diameters
function getMaxOemDiameterForYear(year: number): number {
  if (year < 1970) return 15;
  if (year < 1985) return 16;
  if (year < 1995) return 17;
  if (year < 2000) return 18;
  if (year < 2005) return 19;
  if (year < 2010) return 20;
  if (year < 2015) return 22;
  return 24; // Modern vehicles can have 22-24" factory
}

// Check if tire profile is plausible for era
function isEraAppropriateTire(tireSize: string, year: number): boolean {
  const diameter = extractTireDiameter(tireSize);
  if (!diameter) return false;
  
  const maxDiameter = getMaxOemDiameterForYear(year);
  if (diameter > maxDiameter) return false;
  
  // Extract aspect ratio
  const aspectMatch = tireSize.match(/\/(\d+)/);
  if (aspectMatch) {
    const aspect = parseInt(aspectMatch[1]);
    
    // Ultra-low profile (25-30) didn't exist as OEM before ~2000
    if (aspect <= 30 && year < 2000) return false;
    
    // Very low profile (35) rare before 1995
    if (aspect <= 35 && year < 1995) return false;
  }
  
  return true;
}

// Check if it's a truck/off-road tire on a car
function isTruckTireOnCar(tireSize: string, vehicleType: string): boolean {
  if (!vehicleType) return false;
  
  const carTypes = ['sedan', 'coupe', 'hatchback', 'convertible', 'wagon'];
  const isCar = carTypes.some(t => vehicleType.toLowerCase().includes(t));
  
  if (!isCar) return false;
  
  // LT tires are truck tires
  if (tireSize.startsWith('LT')) return true;
  
  // Flotation sizes (33x12.50R15) are truck tires
  if (/^\d+x\d+/.test(tireSize)) return true;
  
  return false;
}

// ============================================================
// CORRECTION LOGIC
// ============================================================

interface CorrectionResult {
  processed: number;
  recertified: number;
  stillNeedsReview: number;
  byFamily: Record<string, { processed: number; recertified: number }>;
  beforeAfter: { before: any; after: any }[];
}

async function correctAftermarketTires(): Promise<CorrectionResult> {
  console.log('='.repeat(70));
  console.log('AFTERMARKET_TIRES CORRECTION LANE');
  console.log('='.repeat(70));
  console.log(`DRY_RUN: ${DRY_RUN}\n`);
  
  // Get all AFTERMARKET_TIRES records
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim, submodel,
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
  const byFamily: Record<string, { processed: number; recertified: number }> = {};
  const beforeAfter: { before: any; after: any }[] = [];
  
  for (const record of result.rows) {
    const { id, year, make, model, raw_trim, submodel } = record;
    const family = `${make} ${model}`;
    
    if (!byFamily[family]) {
      byFamily[family] = { processed: 0, recertified: 0 };
    }
    byFamily[family].processed++;
    processed++;
    
    // Parse existing data
    const oemWheels = record.oem_wheel_sizes;
    const oemTires = record.oem_tire_sizes;
    
    if (!oemWheels || !oemTires) {
      stillNeedsReview++;
      continue;
    }
    
    // Get stock wheel diameters only
    const stockDiameters = getStockWheelDiameters(oemWheels);
    const allDiameters = extractWheelDiameters(oemWheels);
    
    if (stockDiameters.length === 0 && allDiameters.length === 0) {
      stillNeedsReview++;
      continue;
    }
    
    // Use stock diameters if available, otherwise all
    const validDiameters = stockDiameters.length > 0 ? stockDiameters : allDiameters;
    
    // Filter tires to only those matching valid wheel diameters
    const tires = Array.isArray(oemTires) ? oemTires : [oemTires];
    const cleanedTires: string[] = [];
    
    for (const tire of tires) {
      if (!tire || typeof tire !== 'string') continue;
      
      const tireDiameter = extractTireDiameter(tire);
      if (!tireDiameter) continue;
      
      // Must match a valid wheel diameter
      if (!validDiameters.includes(tireDiameter)) continue;
      
      // Must be era-appropriate
      if (!isEraAppropriateTire(tire, year)) continue;
      
      // Don't add duplicates
      if (!cleanedTires.includes(tire)) {
        cleanedTires.push(tire);
      }
    }
    
    // Also clean wheels - keep only stock wheels
    const wheels = Array.isArray(oemWheels) ? oemWheels : [oemWheels];
    const cleanedWheels: any[] = [];
    
    for (const wheel of wheels) {
      if (typeof wheel === 'object') {
        // Keep stock wheels, skip aftermarket
        if (wheel.isStock === false) continue;
        
        // Check era-appropriate diameter
        const d = wheel.diameter;
        if (d && d > getMaxOemDiameterForYear(year)) continue;
        
        cleanedWheels.push(wheel);
      } else if (typeof wheel === 'string') {
        // String format - parse and validate
        const match = wheel.match(/(\d+)x/);
        if (match) {
          const d = parseInt(match[1]);
          if (d <= getMaxOemDiameterForYear(year)) {
            cleanedWheels.push(wheel);
          }
        }
      }
    }
    
    // Validation checks
    if (cleanedTires.length === 0) {
      // No valid tires found - leave for manual review
      stillNeedsReview++;
      continue;
    }
    
    if (cleanedWheels.length === 0) {
      // No valid wheels found - leave for manual review
      stillNeedsReview++;
      continue;
    }
    
    // Verify diameter match between cleaned wheels and tires
    const cleanedWheelDiameters = extractWheelDiameters(cleanedWheels);
    const cleanedTireDiameters = cleanedTires.map(t => extractTireDiameter(t)).filter(d => d !== null) as number[];
    
    const allTiresDiametersMatch = cleanedTireDiameters.every(td => cleanedWheelDiameters.includes(td));
    
    if (!allTiresDiametersMatch) {
      stillNeedsReview++;
      continue;
    }
    
    // Store before/after for first few
    if (beforeAfter.length < 10) {
      beforeAfter.push({
        before: {
          year,
          make,
          model,
          trim: raw_trim,
          wheels: oemWheels,
          tires: oemTires
        },
        after: {
          year,
          make,
          model,
          trim: raw_trim,
          wheels: cleanedWheels,
          tires: cleanedTires
        }
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
  
  return { processed, recertified, stillNeedsReview, byFamily, beforeAfter };
}

async function main() {
  try {
    // Initial counts
    const initialCounts = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY certification_status
    `);
    
    console.log('=== INITIAL STATUS ===');
    for (const r of initialCounts.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
    
    // Run correction
    const results = await correctAftermarketTires();
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('CORRECTION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nTotal processed: ${results.processed}`);
    console.log(`Recertified: ${results.recertified}`);
    console.log(`Still needs_review: ${results.stillNeedsReview}`);
    
    // Top families
    const sortedFamilies = Object.entries(results.byFamily)
      .sort((a, b) => b[1].recertified - a[1].recertified)
      .slice(0, 20);
    
    console.log('\n=== TOP FAMILIES CORRECTED ===');
    console.log('| Family | Processed | Recertified |');
    console.log('|--------|-----------|-------------|');
    for (const [family, data] of sortedFamilies) {
      if (data.recertified > 0) {
        console.log(`| ${family.padEnd(25)} | ${String(data.processed).padStart(9)} | ${String(data.recertified).padStart(11)} |`);
      }
    }
    
    // Before/After examples
    console.log('\n=== BEFORE/AFTER EXAMPLES ===');
    for (const ba of results.beforeAfter.slice(0, 5)) {
      console.log(`\n${ba.before.year} ${ba.before.make} ${ba.before.model} "${ba.before.trim}":`);
      
      const beforeTires = Array.isArray(ba.before.tires) ? ba.before.tires : [ba.before.tires];
      const afterTires = Array.isArray(ba.after.tires) ? ba.after.tires : [ba.after.tires];
      
      console.log(`  BEFORE tires (${beforeTires.length}): ${beforeTires.slice(0, 5).join(', ')}${beforeTires.length > 5 ? '...' : ''}`);
      console.log(`  AFTER tires (${afterTires.length}): ${afterTires.join(', ')}`);
      
      const beforeWheels = Array.isArray(ba.before.wheels) ? ba.before.wheels : [ba.before.wheels];
      const afterWheels = Array.isArray(ba.after.wheels) ? ba.after.wheels : [ba.after.wheels];
      
      const beforeWheelStr = beforeWheels.map((w: any) => typeof w === 'object' ? `${w.diameter}"` : w).join(', ');
      const afterWheelStr = afterWheels.map((w: any) => typeof w === 'object' ? `${w.diameter}"` : w).join(', ');
      
      console.log(`  BEFORE wheels: ${beforeWheelStr.substring(0, 60)}`);
      console.log(`  AFTER wheels: ${afterWheelStr}`);
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
      
      // Remaining AFTERMARKET_TIRES
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
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
