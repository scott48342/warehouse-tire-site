/**
 * QA Check: Detect over-generic OEM fallback substitutions
 * 
 * Inspect records corrected today for specialty/performance/luxury trims
 * that may have been assigned base-model specs.
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Specialty trim patterns to check
const SPECIALTY_TRIMS = [
  // Performance
  'RS', 'AMG', 'M Sport', 'M3', 'M4', 'M5', 'M6', 'M8',
  'SRT', 'SRT-10', 'Hellcat', 'Demon', 'TRX', 'Redeye',
  'GT', 'GT-R', 'GTI', 'GT350', 'GT500', 'Shelby',
  'SS', 'Z28', 'ZL1', '1LE', 'Z06', 'ZR1', 'Grand Sport',
  'Type R', 'Si', 'Nismo', 'TRD Pro', 'Raptor',
  'SVT', 'ST', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7',
  'S3', 'S4', 'S5', 'S6', 'S7', 'S8',
  'F Sport', 'GS F', 'RC F', 'LC F', 'IS F',
  'V-Sport', 'Blackwing',
  
  // Luxury/Premium
  'Denali', 'Denali Ultimate', 'High Country', 'Platinum',
  'King Ranch', 'Limited', 'Longhorn', 'Laramie Longhorn',
  'Escalade-V', 'Sport Platinum', 'Premium Luxury',
  'Ultra Luxury', 'Executive', 'Maybach',
  'AMG Line', 'M Sport Package',
  
  // HD Trucks
  'HD', '2500', '3500', 'Dually', 'DRW', 'Power Wagon',
  'Tremor', 'Trail Boss', 'ZR2', 'AT4', 'AT4X',
  
  // Special editions
  'Anniversary', 'Heritage', 'Final Edition', 'Launch Edition'
];

// Check if trim matches specialty patterns
function isSpecialtyTrim(trim: string | null): boolean {
  if (!trim) return false;
  const upper = trim.toUpperCase();
  return SPECIALTY_TRIMS.some(s => upper.includes(s.toUpperCase()));
}

// Check if wheel specs look too generic/base
function isGenericSpec(wheel: any, year: number): { isGeneric: boolean; reason?: string } {
  if (!wheel || typeof wheel !== 'object') return { isGeneric: false };
  
  const { diameter, width } = wheel;
  
  // Performance cars from 2000+ with 14-16" wheels are suspicious
  if (year >= 2000 && diameter && diameter <= 16) {
    return { isGeneric: true, reason: `${diameter}" too small for ${year}+ performance` };
  }
  
  // Luxury/performance SUVs from 2005+ with < 18" wheels
  if (year >= 2005 && diameter && diameter < 18) {
    return { isGeneric: true, reason: `${diameter}" too small for modern luxury SUV` };
  }
  
  // HD trucks should have 17"+ wheels after 2010
  if (year >= 2010 && diameter && diameter < 17) {
    return { isGeneric: true, reason: `${diameter}" too small for HD truck` };
  }
  
  // Very narrow width for performance car
  if (width && width < 7 && year >= 2000) {
    return { isGeneric: true, reason: `${width}" width too narrow for performance` };
  }
  
  return { isGeneric: false };
}

async function runQA() {
  console.log('='.repeat(70));
  console.log('QA CHECK: Bulk Correction Generic Fallback Detection');
  console.log('='.repeat(70));
  
  // Get all records corrected today (have audit_original_data with today's timestamp)
  const today = new Date().toISOString().split('T')[0];
  
  const result = await pool.query(`
    SELECT id, year, make, model, raw_trim, 
           oem_wheel_sizes, oem_tire_sizes,
           audit_original_data, certification_status
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
      AND audit_original_data IS NOT NULL
      AND audit_original_data::text LIKE '%${today}%'
    ORDER BY make, model, year
  `);
  
  console.log(`\nFound ${result.rows.length} records corrected today\n`);
  
  let totalChecked = 0;
  let specialtyCount = 0;
  let passCount = 0;
  let failCount = 0;
  const suspicious: any[] = [];
  
  for (const record of result.rows) {
    totalChecked++;
    
    const { year, make, model, raw_trim } = record;
    const wheels = record.oem_wheel_sizes;
    
    // Check if this is a specialty trim
    const isSpecialty = isSpecialtyTrim(raw_trim) || 
                        isSpecialtyTrim(model) ||
                        SPECIALTY_TRIMS.some(s => 
                          make.toUpperCase().includes(s.toUpperCase()) ||
                          model.toUpperCase().includes(s.toUpperCase())
                        );
    
    if (!isSpecialty) {
      passCount++;
      continue;
    }
    
    specialtyCount++;
    
    // Check wheel specs
    const wheelArray = Array.isArray(wheels) ? wheels : [wheels];
    let hasSuspiciousSpec = false;
    let suspiciousReason = '';
    
    for (const wheel of wheelArray) {
      const check = isGenericSpec(wheel, year);
      if (check.isGeneric) {
        hasSuspiciousSpec = true;
        suspiciousReason = check.reason || 'generic spec';
        break;
      }
    }
    
    if (hasSuspiciousSpec) {
      failCount++;
      suspicious.push({
        year,
        make,
        model,
        trim: raw_trim,
        wheels: wheelArray,
        reason: suspiciousReason,
        original: record.audit_original_data
      });
    } else {
      passCount++;
    }
  }
  
  // Summary
  console.log('='.repeat(70));
  console.log('QA RESULTS');
  console.log('='.repeat(70));
  console.log(`\nTotal records checked: ${totalChecked}`);
  console.log(`Specialty trims identified: ${specialtyCount}`);
  console.log(`\n✅ PASS: ${passCount}`);
  console.log(`❌ FAIL (suspicious generic): ${failCount}`);
  
  const passRate = ((passCount / totalChecked) * 100).toFixed(1);
  console.log(`\nPass rate: ${passRate}%`);
  
  // Show suspicious cases
  if (suspicious.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('SUSPICIOUS GENERIC FALLBACK CASES');
    console.log('='.repeat(70));
    
    // Group by reason
    const byReason: Record<string, any[]> = {};
    for (const s of suspicious) {
      if (!byReason[s.reason]) byReason[s.reason] = [];
      byReason[s.reason].push(s);
    }
    
    for (const [reason, cases] of Object.entries(byReason)) {
      console.log(`\n### ${reason} (${cases.length} cases)`);
      for (const c of cases.slice(0, 5)) {
        const wheelStr = c.wheels.map((w: any) => 
          typeof w === 'object' ? `${w.diameter}x${w.width}` : w
        ).join(', ');
        console.log(`  ${c.year} ${c.make} ${c.model} "${c.trim}": ${wheelStr}`);
        
        // Show original data if available
        if (c.original?.original_wheels) {
          const origWheels = Array.isArray(c.original.original_wheels) 
            ? c.original.original_wheels 
            : [c.original.original_wheels];
          const origStr = origWheels.map((w: any) => 
            typeof w === 'object' ? `${w.diameter}x${w.width}` : w
          ).join(', ');
          console.log(`    Original: ${origStr}`);
        }
      }
      if (cases.length > 5) {
        console.log(`    ... and ${cases.length - 5} more`);
      }
    }
  }
  
  // Specific checks for known specialty families
  console.log('\n' + '='.repeat(70));
  console.log('TARGETED FAMILY SPOT-CHECKS');
  console.log('='.repeat(70));
  
  const spotCheckFamilies = [
    { make: 'Audi', models: ['rs6', 'rs4', 's8', 's6'] },
    { make: 'BMW', models: ['m3', 'm5', 'm6'] },
    { make: 'Mercedes', models: ['s-class', 'e-class', 'g-class-amg'] },
    { make: 'Cadillac', models: ['escalade', 'cts'] },
    { make: 'RAM', models: ['2500', '3500'] },
    { make: 'Ford', models: ['f-250', 'f-350', 'mustang'] },
    { make: 'Porsche', models: ['911', 'cayenne'] }
  ];
  
  for (const family of spotCheckFamilies) {
    for (const model of family.models) {
      const check = await pool.query(`
        SELECT year, raw_trim, oem_wheel_sizes, oem_tire_sizes
        FROM vehicle_fitments
        WHERE make = $1 AND model = $2
          AND certification_status = 'certified'
          AND audit_original_data IS NOT NULL
          AND audit_original_data::text LIKE '%${today}%'
        ORDER BY year DESC
        LIMIT 3
      `, [family.make, model]);
      
      if (check.rows.length > 0) {
        console.log(`\n${family.make} ${model} (${check.rows.length} corrected today):`);
        for (const r of check.rows) {
          const wheels = Array.isArray(r.oem_wheel_sizes) ? r.oem_wheel_sizes : [r.oem_wheel_sizes];
          const wheelStr = wheels.map((w: any) => 
            typeof w === 'object' ? `${w.diameter}x${w.width}` : w
          ).join(', ');
          const tires = Array.isArray(r.oem_tire_sizes) ? r.oem_tire_sizes : [r.oem_tire_sizes];
          console.log(`  ${r.year} "${r.raw_trim}": ${wheelStr} | ${tires.slice(0, 2).join(', ')}`);
        }
      }
    }
  }
  
  // Recommendation
  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATION');
  console.log('='.repeat(70));
  
  if (failCount === 0) {
    console.log('\n✅ SAFE TO CONTINUE: No suspicious generic fallbacks detected.');
  } else if (failCount < totalChecked * 0.05) {
    console.log(`\n⚠️ MOSTLY SAFE: ${failCount} suspicious cases (${((failCount/totalChecked)*100).toFixed(1)}%)`);
    console.log('Consider manual review of flagged records, but correction logic is acceptable.');
  } else {
    console.log(`\n❌ REVIEW NEEDED: ${failCount} suspicious cases (${((failCount/totalChecked)*100).toFixed(1)}%)`);
    console.log('Correction logic may be too aggressive. Review and refine before continuing.');
  }
  
  await pool.end();
}

runQA().catch(console.error);
