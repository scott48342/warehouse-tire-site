/**
 * Full Vehicle Spec Completeness Sweep
 * Audits ALL vehicle_fitments records (2000-current) for missing/malformed data
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL, { max: 3 });

// Severity classification
const MAINSTREAM_MAKES = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Nissan', 'Mazda', 'Subaru', 'Volkswagen', 'GMC', 'Ram', 'Jeep', 'Dodge', 'Chrysler', 'BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Acura'];

function getSeverity(year, make) {
  const isMainstream = MAINSTREAM_MAKES.some(m => make.toLowerCase().includes(m.toLowerCase()));
  if (year >= 2020 && isMainstream) return 'HIGH';
  if (year >= 2015 || isMainstream) return 'MEDIUM';
  return 'LOW';
}

// Tire size validation
function validateTireSize(size) {
  if (!size || typeof size !== 'string') return { valid: false, issue: 'empty_or_null' };
  
  // Standard format: 275/65R18, P275/65R18, LT275/65R18
  const standard = /^(P|LT|ST)?(\d{3})\/(\d{2})(R|ZR|B|D)(\d{2})(\s*XL)?$/i;
  // Flotation format: 33x12.50R15
  const flotation = /^(\d{2,3})x(\d{1,2}\.?\d{0,2})(R|ZR)(\d{2})$/i;
  
  if (standard.test(size.trim()) || flotation.test(size.trim())) {
    return { valid: true };
  }
  
  return { valid: false, issue: `invalid_format: ${size}` };
}

// Parse oem_tire_sizes field
function parseTireSizes(raw) {
  if (!raw) return { sizes: [], issues: ['null_or_empty'] };
  
  const issues = [];
  let sizes = [];
  
  // Handle staggered object
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.front || raw.rear) {
      const front = Array.isArray(raw.front) ? raw.front : [];
      const rear = Array.isArray(raw.rear) ? raw.rear : [];
      sizes = [...front, ...rear];
      if (front.length === 0 && rear.length === 0) {
        issues.push('staggered_empty');
      }
    } else {
      issues.push('unknown_object_format');
    }
  } else if (Array.isArray(raw)) {
    sizes = raw;
  } else if (typeof raw === 'string') {
    try {
      sizes = JSON.parse(raw);
    } catch {
      issues.push('unparseable_string');
    }
  }
  
  // Validate each size
  const validSizes = [];
  for (const s of sizes) {
    if (typeof s === 'string') {
      const validation = validateTireSize(s);
      if (validation.valid) {
        validSizes.push(s);
      } else {
        issues.push(validation.issue);
      }
    } else if (s && typeof s === 'object') {
      const sizeStr = s.size || s.tireSize;
      if (sizeStr) {
        const validation = validateTireSize(sizeStr);
        if (validation.valid) {
          validSizes.push(sizeStr);
        } else {
          issues.push(validation.issue);
        }
      } else {
        issues.push('object_missing_size');
      }
    }
  }
  
  return { sizes: validSizes, issues: issues.length > 0 ? issues : [] };
}

// Validate bolt pattern
function validateBoltPattern(pattern) {
  if (!pattern) return { valid: false, issue: 'missing' };
  const bp = /^\d+x\d{2,3}(\.\d+)?$/;
  if (bp.test(pattern)) return { valid: true };
  return { valid: false, issue: `invalid_format: ${pattern}` };
}

console.log('='.repeat(70));
console.log(' FULL VEHICLE SPEC COMPLETENESS SWEEP');
console.log('='.repeat(70));
console.log();

// Fetch all records
console.log('Fetching all vehicle_fitments records...');
const records = await sql`
  SELECT 
    id, year, make, model, display_trim, modification_id,
    bolt_pattern, center_bore_mm, thread_size, seat_type,
    offset_min_mm, offset_max_mm,
    oem_tire_sizes, oem_wheel_sizes,
    source, confidence_tag
  FROM vehicle_fitments 
  WHERE year >= 2000 
    AND source != 'deprecated-staggered-split'
  ORDER BY year DESC, make, model
`;

console.log(`Total records: ${records.length}\n`);

const results = {
  timestamp: new Date().toISOString(),
  totalChecked: records.length,
  
  // Tire specs
  totalComplete: 0,
  totalMissingTireSpecs: 0,
  totalMalformedTireSpecs: 0,
  
  // Wheel specs
  totalMissingBoltPattern: 0,
  totalMissingCenterBore: 0,
  totalMissingWheelSizes: 0,
  totalMissingOffset: 0,
  totalMissingThreadSize: 0,
  
  failures: [],
  highSeverity: [],
  topImpact: []
};

let processed = 0;
for (const r of records) {
  processed++;
  if (processed % 5000 === 0) {
    console.log(`  Processed ${processed}/${records.length}...`);
  }
  
  const failure = {
    id: r.id,
    year: r.year,
    make: r.make,
    model: r.model,
    trim: r.display_trim,
    severity: getSeverity(r.year, r.make),
    missing_fields: [],
    malformed_fields: [],
    customer_impact: '',
    likely_fix_source: 'manual_review'
  };
  
  let hasIssue = false;
  
  // Check tire specs
  const tireParsed = parseTireSizes(r.oem_tire_sizes);
  if (tireParsed.sizes.length === 0) {
    failure.missing_fields.push('oem_tire_sizes');
    results.totalMissingTireSpecs++;
    hasIssue = true;
    failure.customer_impact = 'Cannot search tires for this vehicle';
    failure.likely_fix_source = 'usaf';
  } else if (tireParsed.issues.length > 0) {
    for (const issue of tireParsed.issues) {
      failure.malformed_fields.push({ field: 'oem_tire_sizes', issue });
    }
    results.totalMalformedTireSpecs++;
    hasIssue = true;
  }
  
  // Check bolt pattern
  const bpCheck = validateBoltPattern(r.bolt_pattern);
  if (!bpCheck.valid) {
    if (!r.bolt_pattern) {
      failure.missing_fields.push('bolt_pattern');
      results.totalMissingBoltPattern++;
    } else {
      failure.malformed_fields.push({ field: 'bolt_pattern', value: r.bolt_pattern, issue: bpCheck.issue });
    }
    hasIssue = true;
    failure.customer_impact = 'Cannot search wheels for this vehicle';
    failure.likely_fix_source = 'wheelpros';
  }
  
  // Check center bore
  if (!r.center_bore_mm) {
    failure.missing_fields.push('center_bore_mm');
    results.totalMissingCenterBore++;
    hasIssue = true;
  }
  
  // Check wheel sizes
  const wheelSizes = r.oem_wheel_sizes;
  if (!wheelSizes || (Array.isArray(wheelSizes) && wheelSizes.length === 0)) {
    failure.missing_fields.push('oem_wheel_sizes');
    results.totalMissingWheelSizes++;
    hasIssue = true;
  }
  
  // Check offset range
  if (r.offset_min_mm === null || r.offset_max_mm === null) {
    failure.missing_fields.push('offset_range');
    results.totalMissingOffset++;
    hasIssue = true;
  }
  
  // Check thread size
  if (!r.thread_size) {
    failure.missing_fields.push('thread_size');
    results.totalMissingThreadSize++;
    hasIssue = true;
  }
  
  if (hasIssue) {
    results.failures.push(failure);
    if (failure.severity === 'HIGH') {
      results.highSeverity.push(failure);
    }
  } else {
    results.totalComplete++;
  }
}

// Sort by severity and year
results.failures.sort((a, b) => {
  const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  if (sevOrder[a.severity] !== sevOrder[b.severity]) {
    return sevOrder[a.severity] - sevOrder[b.severity];
  }
  return b.year - a.year;
});

results.topImpact = results.failures.slice(0, 100);

// Summary
console.log('\n' + '='.repeat(70));
console.log(' SUMMARY');
console.log('='.repeat(70));
console.log(`Total records checked:       ${results.totalChecked}`);
console.log(`Total complete:              ${results.totalComplete} (${(results.totalComplete/results.totalChecked*100).toFixed(1)}%)`);
console.log(`Total with issues:           ${results.failures.length}`);
console.log();
console.log('Missing specs:');
console.log(`  - Tire sizes:              ${results.totalMissingTireSpecs}`);
console.log(`  - Bolt pattern:            ${results.totalMissingBoltPattern}`);
console.log(`  - Center bore:             ${results.totalMissingCenterBore}`);
console.log(`  - Wheel sizes:             ${results.totalMissingWheelSizes}`);
console.log(`  - Offset range:            ${results.totalMissingOffset}`);
console.log(`  - Thread size:             ${results.totalMissingThreadSize}`);
console.log();
console.log(`Malformed tire specs:        ${results.totalMalformedTireSpecs}`);
console.log();
console.log(`HIGH severity failures:      ${results.highSeverity.length}`);

// Save results
const outPath = 'g:/clawd/fitment-audit-part2-completeness.json';
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults saved to: ${outPath}`);

await sql.end();
