/**
 * Fix suspicious OEM fallback cases
 * 
 * Strategy: For each suspicious record, find a same-generation certified record
 * with proper specs and copy those specs.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// Specialty trim patterns
const SPECIALTY_TRIMS = [
  'RS', 'AMG', 'M3', 'M4', 'M5', 'M6', 'M8', 'SRT', 'Hellcat', 'TRX',
  'GT350', 'GT500', 'Shelby', 'SS', 'Z28', 'ZL1', 'Z06', 'ZR1',
  'Type R', 'Nismo', 'TRD Pro', 'Raptor', 'Denali', 'Platinum',
  'High Country', 'King Ranch', 'Longhorn', 'Escalade', 'F Sport',
  'V-Sport', 'Blackwing', 'HD', '2500', '3500', 'Power Wagon', 
  'Tremor', 'ZR2', 'AT4', 'GTS', 'Turbo', 'S-Line'
];

function isSpecialtyTrim(trim: string | null, model: string | null): boolean {
  const combined = `${trim || ''} ${model || ''}`.toUpperCase();
  return SPECIALTY_TRIMS.some(s => combined.includes(s.toUpperCase()));
}

function extractWheelDiameter(wheel: any): number | null {
  if (typeof wheel === 'object' && wheel.diameter) return Number(wheel.diameter);
  if (typeof wheel === 'string') {
    const match = wheel.match(/(\d+)x/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

function isSuspiciousSpec(wheels: any[], year: number, trim: string | null, model: string | null): boolean {
  if (!wheels || wheels.length === 0) return false;
  
  const diameters = wheels.map(w => extractWheelDiameter(w)).filter(d => d !== null) as number[];
  if (diameters.length === 0) return false;
  
  const maxDiam = Math.max(...diameters);
  
  // Performance cars from 2000+ with < 17" are suspicious
  if (year >= 2000 && maxDiam < 17 && isSpecialtyTrim(trim, model)) return true;
  
  // Luxury SUVs from 2005+ with < 18" are suspicious
  if (year >= 2005 && maxDiam < 18 && isSpecialtyTrim(trim, model)) return true;
  
  return false;
}

async function fixSuspiciousFallbacks() {
  console.log('='.repeat(70));
  console.log('FIX SUSPICIOUS OEM FALLBACKS');
  console.log('='.repeat(70));
  console.log(`DRY_RUN: ${DRY_RUN}\n`);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Get all records corrected today
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim,
           oem_wheel_sizes, oem_tire_sizes,
           audit_original_data
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
      AND audit_original_data IS NOT NULL
      AND audit_original_data::text LIKE '%${today}%'
    ORDER BY make, model, year
  `);
  
  console.log(`Found ${result.rows.length} records corrected today\n`);
  
  let checked = 0;
  let suspicious = 0;
  let fixed = 0;
  let notFixed = 0;
  const fixes: any[] = [];
  
  for (const record of result.rows) {
    checked++;
    const { id, year, make, model, raw_trim } = record;
    const wheels = Array.isArray(record.oem_wheel_sizes) ? record.oem_wheel_sizes : [record.oem_wheel_sizes];
    
    if (!isSuspiciousSpec(wheels, year, raw_trim, model)) continue;
    
    suspicious++;
    
    // Find a reference record from same make/model with proper specs
    // Look for a nearby year (±3 years) that has reasonable wheel sizes
    const reference = await pool.query(`
      SELECT year, oem_wheel_sizes, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
        AND certification_status = 'certified'
        AND year BETWEEN $3 - 3 AND $3 + 3
        AND year != $3
        AND oem_wheel_sizes IS NOT NULL
      ORDER BY ABS(year - $3)
      LIMIT 5
    `, [make, model, year]);
    
    // Find a reference with appropriate wheel size
    let goodReference = null;
    for (const ref of reference.rows) {
      const refWheels = Array.isArray(ref.oem_wheel_sizes) ? ref.oem_wheel_sizes : [ref.oem_wheel_sizes];
      const refDiams = refWheels.map((w: any) => extractWheelDiameter(w)).filter((d: any) => d !== null) as number[];
      
      if (refDiams.length === 0) continue;
      
      const maxRefDiam = Math.max(...refDiams);
      
      // Reference is good if it has reasonable wheel size for the era
      if (year >= 2000 && maxRefDiam >= 17) {
        goodReference = ref;
        break;
      }
      if (year >= 2005 && maxRefDiam >= 18) {
        goodReference = ref;
        break;
      }
      if (year < 2000 && maxRefDiam >= 15) {
        goodReference = ref;
        break;
      }
    }
    
    if (goodReference) {
      fixes.push({
        id,
        year,
        make,
        model,
        trim: raw_trim,
        oldWheels: wheels,
        newWheels: goodReference.oem_wheel_sizes,
        newTires: goodReference.oem_tire_sizes,
        refYear: goodReference.year
      });
      
      if (!DRY_RUN) {
        await pool.query(`
          UPDATE vehicle_fitments
          SET oem_wheel_sizes = $1,
              oem_tire_sizes = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(goodReference.oem_wheel_sizes),
          JSON.stringify(goodReference.oem_tire_sizes),
          id
        ]);
      }
      
      fixed++;
    } else {
      // No good reference found - flag for manual review
      if (!DRY_RUN) {
        await pool.query(`
          UPDATE vehicle_fitments
          SET certification_status = 'needs_review',
              certification_errors = '[{"type":"SUSPICIOUS_FALLBACK","message":"OEM fallback assigned undersized wheels"}]'::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `, [id]);
      }
      notFixed++;
    }
  }
  
  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nRecords checked: ${checked}`);
  console.log(`Suspicious found: ${suspicious}`);
  console.log(`Fixed from reference: ${fixed}`);
  console.log(`Flagged for manual review: ${notFixed}`);
  
  // Show fixes
  console.log('\n=== FIXES APPLIED ===');
  for (const f of fixes.slice(0, 15)) {
    const oldDiam = f.oldWheels.map((w: any) => extractWheelDiameter(w)).filter((d: any) => d).join('/');
    const newWheels = Array.isArray(f.newWheels) ? f.newWheels : [f.newWheels];
    const newDiam = newWheels.map((w: any) => extractWheelDiameter(w)).filter((d: any) => d).join('/');
    console.log(`${f.year} ${f.make} ${f.model} "${f.trim}": ${oldDiam}" → ${newDiam}" (from ${f.refYear})`);
  }
  if (fixes.length > 15) {
    console.log(`... and ${fixes.length - 15} more`);
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
  }
  
  console.log('\n' + '='.repeat(70));
  
  if (DRY_RUN) {
    console.log('⚠️ DRY_RUN - no changes written');
  }
  
  await pool.end();
}

fixSuspiciousFallbacks().catch(console.error);
