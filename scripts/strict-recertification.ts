/**
 * Strict Recertification Sweep
 * 
 * Re-validates ALL certified records with stricter rules.
 * Downgrades failing records to needs_review.
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
// OEM Generation Norms - Max Wheel Diameters by Era
// ============================================================================

const ERA_MAX_WHEEL: Record<string, number> = {
  // Classic era
  'pre-1980': 15,
  '1980-1989': 16,
  '1990-1999': 17,
  '2000-2005': 18,
  '2006-2010': 20,
  '2011-2015': 22,
  '2016-2020': 22,
  '2021+': 24
};

function getEraMaxWheel(year: number): number {
  // More realistic OEM maximums - luxury brands/SUVs pushed larger wheels earlier
  if (year < 1980) return 15;
  if (year < 1985) return 15;
  if (year < 1990) return 16;
  if (year < 1995) return 17;
  if (year < 2000) return 18;  // Audi A8, BMW 7 Series had 18" in late 90s
  if (year < 2005) return 20;  // 20" became available 2000-2004 on SUVs
  if (year < 2010) return 21;  // 21" available 2005-2009 on luxury SUVs
  if (year < 2015) return 22;  // 22" common 2010-2014
  if (year < 2020) return 24;  // 24" available 2015-2019 on full-size SUVs
  return 24;  // 24" standard max 2020+
}

// ============================================================================
// Trim Introduction Dates - Detect impossible future trims
// ============================================================================

const TRIM_INTRODUCTION: Record<string, Record<string, number>> = {
  // Cadillac Escalade trims
  'Cadillac': {
    'V': 2021,
    'Sport': 2019,
    'Premium Luxury': 2015,
    'Platinum': 2008
  },
  // RAM trims
  'RAM': {
    'TRX': 2021,
    'Rebel': 2015,
    'Limited': 2016,
    'Longhorn': 2011,
    'Big Horn': 2010,
    'Warlock': 2019,
    'Night Edition': 2017
  },
  // Chevrolet trims
  'Chevrolet': {
    'High Country': 2014,
    'Trail Boss': 2019,
    'ZR2': 2017,
    'RST': 2018,
    'Midnight Edition': 2015,
    'Custom': 2016
  },
  // GMC trims
  'GMC': {
    'AT4': 2019,
    'AT4X': 2022,
    'Denali Ultimate': 2022,
    'Elevation': 2019
  },
  // Ford trims
  'Ford': {
    'Raptor': 2010,
    'Tremor': 2014,
    'King Ranch': 2001,
    'Platinum': 2009,
    'Limited': 2016,
    'Dark Horse': 2024
  },
  // Toyota trims
  'Toyota': {
    'TRD Pro': 2015,
    'TRD Off-Road': 2016,
    'TRD Sport': 2016,
    'Trailhunter': 2024,
    'i-Force Max': 2022
  },
  // Lexus LX trims
  'Lexus': {
    'F Sport': 2022,
    'Ultra Luxury': 2022,
    'LX 600': 2022,
    'LX 570': 2008
  }
};

function isTrimValidForYear(make: string, trim: string, year: number): boolean {
  const makeTrims = TRIM_INTRODUCTION[make];
  if (!makeTrims) return true; // Unknown make, assume valid
  
  const trimLower = trim.toLowerCase();
  for (const [trimName, introYear] of Object.entries(makeTrims)) {
    if (trimLower.includes(trimName.toLowerCase())) {
      if (year < introYear) {
        return false;
      }
    }
  }
  return true;
}

// ============================================================================
// Validation Functions
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function extractDiameter(tireSize: string): number | null {
  const match = String(tireSize).match(/R(\d+(?:\.\d+)?)/i);
  return match ? Math.floor(parseFloat(match[1])) : null;
}

function parseWheelDiameters(oemWheelSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemWheelSizes) return diameters;
  
  const data = typeof oemWheelSizes === 'string' ? JSON.parse(oemWheelSizes) : oemWheelSizes;
  
  if (Array.isArray(data)) {
    for (const w of data) {
      if (typeof w === 'string') {
        const match = w.match(/x(\d+)/i);
        if (match) diameters.push(parseInt(match[1]));
      } else if (w?.diameter) {
        diameters.push(Math.floor(w.diameter));
      }
      if (w?.rearDiameter) diameters.push(Math.floor(w.rearDiameter));
    }
  } else if (typeof data === 'object') {
    if (data.diameter) diameters.push(Math.floor(data.diameter));
    if (data.rearDiameter) diameters.push(Math.floor(data.rearDiameter));
  }
  
  return [...new Set(diameters)];
}

function parseTireDiameters(oemTireSizes: any): number[] {
  const diameters: number[] = [];
  if (!oemTireSizes) return diameters;
  
  const data = typeof oemTireSizes === 'string' ? JSON.parse(oemTireSizes) : oemTireSizes;
  
  if (Array.isArray(data)) {
    for (const t of data) {
      const size = typeof t === 'string' ? t : t?.size || t?.front;
      if (size) {
        const dia = extractDiameter(String(size));
        if (dia) diameters.push(dia);
      }
      if (t?.rear) {
        const dia = extractDiameter(String(t.rear));
        if (dia) diameters.push(dia);
      }
    }
  } else if (typeof data === 'string') {
    const dia = extractDiameter(data);
    if (dia) diameters.push(dia);
  }
  
  return [...new Set(diameters)];
}

function validateRecord(row: any): ValidationResult {
  const errors: string[] = [];
  
  const wheelDiameters = parseWheelDiameters(row.oem_wheel_sizes);
  const tireDiameters = parseTireDiameters(row.oem_tire_sizes);
  
  // Rule 1: Tire rim diameter must match at least one wheel diameter
  if (wheelDiameters.length > 0 && tireDiameters.length > 0) {
    const unmatchedTires = tireDiameters.filter(td => !wheelDiameters.includes(td));
    if (unmatchedTires.length > 0) {
      errors.push(`DIAMETER_MISMATCH: Tire R${unmatchedTires.join('/R')} doesn't match wheels ${wheelDiameters.join('/')}`);
    }
    
    // Complete mismatch (no overlap at all)
    const hasAnyMatch = tireDiameters.some(td => wheelDiameters.includes(td));
    if (!hasAnyMatch) {
      errors.push(`COMPLETE_MISMATCH: No tire diameters match any wheel diameters`);
    }
  }
  
  // Rule 2: Detect model-wide tire soup - too many unrelated rim diameters
  // Be more lenient - some luxury vehicles legitimately have 5+ wheel options
  const uniqueTireDiameters = [...new Set(tireDiameters)];
  const uniqueWheelDiameters = [...new Set(wheelDiameters)];
  
  if (uniqueTireDiameters.length > 5) {
    errors.push(`TIRE_SOUP: ${uniqueTireDiameters.length} different tire diameters is excessive`);
  }
  if (uniqueWheelDiameters.length > 5) {
    errors.push(`WHEEL_SOUP: ${uniqueWheelDiameters.length} different wheel diameters is excessive`);
  }
  
  // Check diameter spread - if spread > 6 inches, likely contamination
  if (uniqueWheelDiameters.length > 0) {
    const minWheel = Math.min(...uniqueWheelDiameters);
    const maxWheel = Math.max(...uniqueWheelDiameters);
    if (maxWheel - minWheel > 6) {
      errors.push(`WHEEL_SPREAD: ${maxWheel - minWheel}" spread (${minWheel}-${maxWheel}) is unrealistic for single trim`);
    }
  }
  if (uniqueTireDiameters.length > 0) {
    const minTire = Math.min(...uniqueTireDiameters);
    const maxTire = Math.max(...uniqueTireDiameters);
    if (maxTire - minTire > 6) {
      errors.push(`TIRE_SPREAD: R${minTire}-R${maxTire} spread is unrealistic for single trim`);
    }
  }
  
  // Rule 3: Detect trim/year impossible pairings
  if (!isTrimValidForYear(row.make, row.display_trim || '', row.year)) {
    errors.push(`FUTURE_TRIM: "${row.display_trim}" didn't exist in ${row.year}`);
  }
  
  // Rule 4: Detect aftermarket wheel contamination - oversized for era
  const maxOemWheel = getEraMaxWheel(row.year);
  const oversizedWheels = wheelDiameters.filter(d => d > maxOemWheel);
  if (oversizedWheels.length > 0) {
    errors.push(`AFTERMARKET_WHEEL: ${oversizedWheels.join('/')}" exceeds ${maxOemWheel}" max for ${row.year}`);
  }
  
  // Rule 5: Detect classic cars with modern tire sizes
  if (row.year < 1990) {
    const modernTires = tireDiameters.filter(d => d > 17);
    if (modernTires.length > 0) {
      errors.push(`MODERN_TIRES_ON_CLASSIC: R${modernTires.join('/R')} impossible for ${row.year} vehicle`);
    }
  }
  
  // Rule 6: Detect wheel diameter without matching tire
  if (wheelDiameters.length > 0 && tireDiameters.length > 0) {
    const unmatchedWheels = wheelDiameters.filter(wd => !tireDiameters.includes(wd));
    // Only flag if NO tires match - partial is OK for multi-wheel setups
    if (unmatchedWheels.length === wheelDiameters.length) {
      errors.push(`ORPHAN_WHEELS: Wheels ${unmatchedWheels.join('/')}\" have no matching tires`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function main() {
  console.log(`\n🔒 Strict Recertification Sweep${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  // Get ALL certified records
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes,
           certification_status, certification_errors, audit_original_data, source
    FROM vehicle_fitments
    WHERE certification_status = 'certified' OR certification_status IS NULL
    ORDER BY make, model, year
  `);

  console.log(`Checking ${records.rowCount} certified records...\n`);

  let checked = 0;
  let downgraded = 0;
  let stillCertified = 0;
  
  const failureReasons: Record<string, number> = {};
  const offenderFamilies: Record<string, number> = {};
  const samples: any[] = [];

  for (const row of records.rows) {
    checked++;
    
    const result = validateRecord(row);
    
    if (!result.valid) {
      downgraded++;
      
      // Track failure reasons
      for (const err of result.errors) {
        const reason = err.split(':')[0];
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
      
      // Track offender families
      const family = `${row.make} ${row.model}`;
      offenderFamilies[family] = (offenderFamilies[family] || 0) + 1;
      
      // Capture samples
      if (samples.length < 15) {
        samples.push({
          vehicle: `${row.year} ${row.make} ${row.model} [${row.display_trim}]`,
          errors: result.errors,
          wheels: parseWheelDiameters(row.oem_wheel_sizes),
          tires: parseTireDiameters(row.oem_tire_sizes)
        });
      }
      
      if (!DRY_RUN) {
        // Preserve original data
        const auditData = row.audit_original_data || {
          oem_wheel_sizes: row.oem_wheel_sizes,
          oem_tire_sizes: row.oem_tire_sizes,
          original_source: row.source,
          original_certification_status: row.certification_status,
          recertification_date: new Date().toISOString()
        };
        
        const certErrors = result.errors.map(e => ({
          type: e.split(':')[0],
          message: e,
          detected_at: new Date().toISOString()
        }));
        
        await pool.query(`
          UPDATE vehicle_fitments
          SET 
            certification_status = 'needs_review',
            certification_errors = $1,
            audit_original_data = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [JSON.stringify(certErrors), JSON.stringify(auditData), row.id]);
      }
    } else {
      stillCertified++;
    }
    
    if (checked % 5000 === 0) {
      console.log(`  Progress: ${checked} / ${records.rowCount} checked, ${downgraded} downgraded...`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RECERTIFICATION RESULTS');
  console.log('='.repeat(70));
  
  console.log(`\n📊 Summary:`);
  console.log(`  Records checked: ${checked}`);
  console.log(`  ❌ Downgraded to needs_review: ${downgraded}`);
  console.log(`  ✅ Still certified: ${stillCertified}`);
  console.log(`  Failure rate: ${(downgraded / checked * 100).toFixed(2)}%`);
  
  console.log(`\n📋 Top Failure Reasons:`);
  const sortedReasons = Object.entries(failureReasons).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons.slice(0, 10)) {
    console.log(`  ${reason}: ${count} (${(count / downgraded * 100).toFixed(1)}%)`);
  }
  
  console.log(`\n📋 Top Offender Families:`);
  const sortedFamilies = Object.entries(offenderFamilies).sort((a, b) => b[1] - a[1]);
  for (const [family, count] of sortedFamilies.slice(0, 20)) {
    console.log(`  ${family}: ${count}`);
  }
  
  console.log(`\n📋 Sample Failures:`);
  for (const s of samples.slice(0, 10)) {
    console.log(`\n  ${s.vehicle}`);
    console.log(`    Wheels: ${s.wheels.join('/')}" | Tires: R${s.tires.join('/R')}`);
    for (const err of s.errors) {
      console.log(`    ❌ ${err}`);
    }
  }

  // Final counts
  console.log('\n' + '='.repeat(70));
  console.log('FINAL STATUS');
  console.log('='.repeat(70));
  
  const finalCertified = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE certification_status = 'certified' OR certification_status IS NULL
  `);
  const finalReview = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
  `);
  
  console.log(`\n📈 Global Status:`);
  console.log(`  ✅ Certified: ${finalCertified.rows[0].cnt}`);
  console.log(`  ⚠️ Needs Review: ${finalReview.rows[0].cnt}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDED NEXT CORRECTION BATCH');
  console.log('='.repeat(70));
  
  // Get top family with most needs_review
  const topFamily = sortedFamilies[0];
  if (topFamily) {
    console.log(`\n🎯 Highest ROI: ${topFamily[0]} (${topFamily[1]} records)`);
    
    // Get sample of what's wrong
    const familyParts = topFamily[0].split(' ');
    const make = familyParts[0];
    const model = familyParts.slice(1).join(' ');
    
    const familySample = await pool.query(`
      SELECT year, display_trim, certification_errors
      FROM vehicle_fitments
      WHERE make = $1 AND model ILIKE $2
        AND certification_status = 'needs_review'
      ORDER BY year DESC
      LIMIT 5
    `, [make, `%${model}%`]);
    
    console.log(`  Sample issues:`);
    for (const row of familySample.rows) {
      const errors = row.certification_errors || [];
      const errTypes = errors.map((e: any) => e.type).join(', ');
      console.log(`    ${row.year} [${row.display_trim}]: ${errTypes}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
