/**
 * Full Database Completeness Audit Worker
 * 
 * Usage: node audit-worker.mjs --start-year=2020 --end-year=2026 --batch-name=batch-04
 * 
 * Validates every vehicle_fitments record for:
 * - Tire spec completeness
 * - Wheel spec completeness
 * - Staggered format correctness
 * - No fake Front/Rear trims
 * - No grouped trims visible
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

// Parse CLI args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

const START_YEAR = parseInt(args['start-year'] || '2000', 10);
const END_YEAR = parseInt(args['end-year'] || '2026', 10);
const BATCH_NAME = args['batch-name'] || `batch-${START_YEAR}-${END_YEAR}`;

const sql = postgres(process.env.POSTGRES_URL);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

// Standard tire: P265/70R17, LT265/60R20, 275/35ZR19
// With load range: LT265/60R20/E, LT245/75R17/D
// With speed rating: 275/35R19Y, P265/70R17H
const TIRE_SIZE_REGEX = /^(P|LT)?(\d{2,3})\/(\d{2,3})(Z?R|RF|HL|B|D)?(\d{2})(\.5)?(C|D|E|F|G|H|J|L|M|N|P|Q|R|S|T|U|V|W|Y|Z)?(\d{2,3})?(V|W|Y|Z)?(\/[A-Z])?$/i;
const FLOTATION_REGEX = /^\d{2,3}x\d{1,2}(\.\d{1,2})?(R|RF)?\d{2}/i;

function isValidTireSize(size) {
  if (typeof size !== 'string') return false;
  const trimmed = size.trim();
  // Match standard formats, flotation, or simple metric with optional load range suffix
  return TIRE_SIZE_REGEX.test(trimmed) || FLOTATION_REGEX.test(trimmed) || trimmed.match(/^\d{3}\/\d{2}Z?R\d{2}(\/[A-Z])?$/i);
}

function validateTireSpecs(record) {
  const issues = [];
  const tires = record.oem_tire_sizes;
  
  // Check existence
  if (tires === null || tires === undefined) {
    issues.push({ severity: 'HIGH', code: 'TIRE_NULL', message: 'oem_tire_sizes is null' });
    return { valid: false, issues, format: 'null' };
  }
  
  // Check for double-encoded JSON
  if (typeof tires === 'string') {
    try {
      const parsed = JSON.parse(tires);
      if (typeof parsed === 'string') {
        issues.push({ severity: 'HIGH', code: 'TIRE_DOUBLE_ENCODED', message: 'Double-encoded JSON string' });
        return { valid: false, issues, format: 'double-encoded' };
      }
    } catch {
      // Not JSON, might be single tire size
      if (isValidTireSize(tires)) {
        return { valid: true, issues: [], format: 'single-string', sizes: [tires] };
      }
      issues.push({ severity: 'HIGH', code: 'TIRE_INVALID_STRING', message: `Invalid tire string: ${tires}` });
      return { valid: false, issues, format: 'invalid-string' };
    }
  }
  
  // Check for staggered object format
  if (typeof tires === 'object' && !Array.isArray(tires)) {
    const { front, rear } = tires;
    const result = { valid: true, issues: [], format: 'staggered', sizes: [] };
    
    if (!front && !rear) {
      issues.push({ severity: 'HIGH', code: 'STAGGERED_EMPTY', message: 'Staggered object has no front/rear' });
      return { valid: false, issues, format: 'staggered-empty' };
    }
    
    // Validate front
    if (front) {
      if (typeof front === 'string') {
        if (!isValidTireSize(front)) {
          issues.push({ severity: 'HIGH', code: 'STAGGERED_FRONT_INVALID', message: `Invalid front tire: ${front}` });
          result.valid = false;
        } else {
          result.sizes.push(front);
        }
      } else if (Array.isArray(front)) {
        for (const s of front) {
          if (!isValidTireSize(s)) {
            issues.push({ severity: 'MEDIUM', code: 'STAGGERED_FRONT_ARRAY_INVALID', message: `Invalid front tire in array: ${s}` });
          } else {
            result.sizes.push(s);
          }
        }
      }
    } else {
      issues.push({ severity: 'HIGH', code: 'STAGGERED_NO_FRONT', message: 'Staggered object missing front' });
      result.valid = false;
    }
    
    // Validate rear
    if (rear) {
      if (typeof rear === 'string') {
        if (!isValidTireSize(rear)) {
          issues.push({ severity: 'HIGH', code: 'STAGGERED_REAR_INVALID', message: `Invalid rear tire: ${rear}` });
          result.valid = false;
        } else {
          result.sizes.push(rear);
        }
      } else if (Array.isArray(rear)) {
        for (const s of rear) {
          if (!isValidTireSize(s)) {
            issues.push({ severity: 'MEDIUM', code: 'STAGGERED_REAR_ARRAY_INVALID', message: `Invalid rear tire in array: ${s}` });
          } else {
            result.sizes.push(s);
          }
        }
      }
    } else {
      issues.push({ severity: 'HIGH', code: 'STAGGERED_NO_REAR', message: 'Staggered object missing rear' });
      result.valid = false;
    }
    
    result.issues = issues;
    return result;
  }
  
  // Check for array format
  if (Array.isArray(tires)) {
    if (tires.length === 0) {
      issues.push({ severity: 'HIGH', code: 'TIRE_EMPTY_ARRAY', message: 'oem_tire_sizes is empty array' });
      return { valid: false, issues, format: 'empty-array' };
    }
    
    // Check for [null]
    if (tires.every(t => t === null)) {
      issues.push({ severity: 'HIGH', code: 'TIRE_NULL_ARRAY', message: 'oem_tire_sizes contains only nulls' });
      return { valid: false, issues, format: 'null-array' };
    }
    
    const validSizes = [];
    for (const size of tires) {
      if (size === null) {
        issues.push({ severity: 'MEDIUM', code: 'TIRE_HAS_NULL', message: 'Array contains null element' });
        continue;
      }
      if (typeof size === 'string' && isValidTireSize(size)) {
        validSizes.push(size);
      } else if (typeof size === 'object' && size?.size) {
        if (isValidTireSize(size.size)) {
          validSizes.push(size.size);
        } else {
          issues.push({ severity: 'MEDIUM', code: 'TIRE_OBJECT_INVALID', message: `Invalid tire object: ${JSON.stringify(size)}` });
        }
      } else {
        issues.push({ severity: 'MEDIUM', code: 'TIRE_INVALID_ELEMENT', message: `Invalid tire element: ${JSON.stringify(size)}` });
      }
    }
    
    if (validSizes.length === 0) {
      issues.push({ severity: 'HIGH', code: 'TIRE_NO_VALID', message: 'No valid tire sizes in array' });
      return { valid: false, issues, format: 'array-no-valid' };
    }
    
    return { valid: true, issues, format: 'array', sizes: validSizes };
  }
  
  issues.push({ severity: 'HIGH', code: 'TIRE_UNKNOWN_FORMAT', message: `Unknown tire format: ${typeof tires}` });
  return { valid: false, issues, format: 'unknown' };
}

function validateWheelSpecs(record) {
  const issues = [];
  let complete = true;
  
  // Bolt pattern
  if (!record.bolt_pattern) {
    issues.push({ severity: 'HIGH', code: 'NO_BOLT_PATTERN', message: 'Missing bolt pattern' });
    complete = false;
  } else if (!/^\d+x\d+(\.\d+)?$/.test(record.bolt_pattern)) {
    issues.push({ severity: 'MEDIUM', code: 'INVALID_BOLT_PATTERN', message: `Invalid bolt pattern: ${record.bolt_pattern}` });
  }
  
  // Center bore
  if (!record.center_bore_mm) {
    issues.push({ severity: 'MEDIUM', code: 'NO_CENTER_BORE', message: 'Missing center bore' });
  } else if (isNaN(parseFloat(record.center_bore_mm))) {
    issues.push({ severity: 'MEDIUM', code: 'INVALID_CENTER_BORE', message: `Invalid center bore: ${record.center_bore_mm}` });
  }
  
  // OEM wheel sizes
  const wheels = record.oem_wheel_sizes;
  if (!wheels || (Array.isArray(wheels) && wheels.length === 0)) {
    issues.push({ severity: 'MEDIUM', code: 'NO_WHEEL_SIZES', message: 'Missing oem_wheel_sizes' });
  } else if (Array.isArray(wheels)) {
    let hasValidWheel = false;
    for (const w of wheels) {
      if (w && typeof w === 'object') {
        if (w.diameter || w.width || w.front_width || w.rear_width) {
          hasValidWheel = true;
        }
      }
    }
    if (!hasValidWheel) {
      issues.push({ severity: 'MEDIUM', code: 'WHEEL_SIZES_EMPTY', message: 'oem_wheel_sizes has no valid entries' });
    }
  }
  
  // Offset range
  if (!record.offset_min_mm && !record.offset_max_mm) {
    issues.push({ severity: 'LOW', code: 'NO_OFFSET_RANGE', message: 'Missing offset range' });
  }
  
  // Thread size
  if (!record.thread_size) {
    issues.push({ severity: 'LOW', code: 'NO_THREAD_SIZE', message: 'Missing thread size' });
  }
  
  // Seat type
  if (!record.seat_type) {
    issues.push({ severity: 'LOW', code: 'NO_SEAT_TYPE', message: 'Missing seat type' });
  }
  
  return { valid: complete, issues };
}

function validateTrimLabel(record) {
  const issues = [];
  const trim = record.display_trim || '';
  
  // Check for fake Front/Rear labels
  // Exclude legitimate "Dual Rear Wheel" (DRW) trims
  if ((/\bFront\s+\w/i.test(trim) || /\bRear\s+\w/i.test(trim)) 
      && !/Dual Rear Wheel/i.test(trim)) {
    issues.push({ severity: 'HIGH', code: 'FAKE_FRONT_REAR_TRIM', message: `Fake Front/Rear trim label: ${trim}` });
  }
  
  // Check for grouped trim labels (contains " / ")
  if (trim.includes(' / ')) {
    issues.push({ severity: 'MEDIUM', code: 'GROUPED_TRIM_VISIBLE', message: `Grouped trim label visible: ${trim}` });
  }
  
  // Check for deprecated status
  if (record.certification_status === 'deprecated-staggered-split') {
    issues.push({ severity: 'LOW', code: 'DEPRECATED_RECORD', message: 'Record is deprecated from staggered merge' });
  }
  
  return { valid: issues.filter(i => i.severity === 'HIGH').length === 0, issues };
}

// ============================================================================
// MAIN AUDIT
// ============================================================================

async function runAudit() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   FULL DB AUDIT: ${START_YEAR} - ${END_YEAR} (${BATCH_NAME})`.padEnd(64) + `║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Query all records in year range (excluding deprecated)
  const records = await sql`
    SELECT 
      id, year, make, model, display_trim, modification_id,
      oem_tire_sizes, oem_wheel_sizes,
      bolt_pattern, center_bore_mm,
      offset_min_mm, offset_max_mm,
      thread_size, seat_type,
      certification_status, quality_tier, source
    FROM vehicle_fitments
    WHERE year >= ${START_YEAR} AND year <= ${END_YEAR}
      AND (certification_status IS NULL 
           OR certification_status NOT IN ('deprecated-staggered-split', 'deprecated-superseded-by-canonical'))
    ORDER BY year, make, model, display_trim
  `;
  
  console.log(`Found ${records.length} records to audit\n`);
  
  const results = {
    batchName: BATCH_NAME,
    yearRange: { start: START_YEAR, end: END_YEAR },
    timestamp: new Date().toISOString(),
    summary: {
      totalRecords: records.length,
      completeRecords: 0,
      completionPct: 0,
      missingTireSpec: 0,
      missingWheelSpec: 0,
      malformedTireSpec: 0,
      malformedWheelSpec: 0,
      staggeredIncomplete: 0,
      fakeGroupedTrim: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
    },
    issuesByCode: {},
    highSeverityRecords: [],
    customerImpactingGaps: [],
    sampleByMake: {},
  };
  
  let processed = 0;
  for (const record of records) {
    processed++;
    if (processed % 1000 === 0) {
      console.log(`  Processed ${processed}/${records.length}...`);
    }
    
    const tireResult = validateTireSpecs(record);
    const wheelResult = validateWheelSpecs(record);
    const trimResult = validateTrimLabel(record);
    
    const allIssues = [...tireResult.issues, ...wheelResult.issues, ...trimResult.issues];
    
    // Count severities
    for (const issue of allIssues) {
      if (issue.severity === 'HIGH') results.summary.highSeverity++;
      if (issue.severity === 'MEDIUM') results.summary.mediumSeverity++;
      if (issue.severity === 'LOW') results.summary.lowSeverity++;
      
      // Count by code
      results.issuesByCode[issue.code] = (results.issuesByCode[issue.code] || 0) + 1;
    }
    
    // Track specific issue types
    if (!tireResult.valid) {
      results.summary.missingTireSpec++;
      if (tireResult.format === 'staggered-empty' || tireResult.issues.some(i => i.code.startsWith('STAGGERED_'))) {
        results.summary.staggeredIncomplete++;
      }
    }
    if (tireResult.issues.some(i => i.code.includes('INVALID') || i.code.includes('MALFORMED'))) {
      results.summary.malformedTireSpec++;
    }
    
    if (!wheelResult.valid) {
      results.summary.missingWheelSpec++;
    }
    if (wheelResult.issues.some(i => i.code.includes('INVALID'))) {
      results.summary.malformedWheelSpec++;
    }
    
    if (trimResult.issues.some(i => i.code === 'FAKE_FRONT_REAR_TRIM' || i.code === 'GROUPED_TRIM_VISIBLE')) {
      results.summary.fakeGroupedTrim++;
    }
    
    // Track complete records
    if (tireResult.valid && wheelResult.valid && trimResult.valid) {
      results.summary.completeRecords++;
    }
    
    // Capture HIGH severity records (limit to 500)
    const highIssues = allIssues.filter(i => i.severity === 'HIGH');
    if (highIssues.length > 0 && results.highSeverityRecords.length < 500) {
      results.highSeverityRecords.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.display_trim,
        issues: highIssues,
      });
    }
    
    // Capture customer-impacting gaps (missing tire sizes primarily)
    if (!tireResult.valid && results.customerImpactingGaps.length < 200) {
      results.customerImpactingGaps.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.display_trim,
        tireFormat: tireResult.format,
        issues: tireResult.issues,
      });
    }
    
    // Sample by make for runtime spot-checks
    const makeKey = record.make.toLowerCase();
    if (!results.sampleByMake[makeKey]) {
      results.sampleByMake[makeKey] = {
        make: record.make,
        sampleRecord: {
          year: record.year,
          model: record.model,
          trim: record.display_trim,
        },
        totalRecords: 0,
        completeRecords: 0,
      };
    }
    results.sampleByMake[makeKey].totalRecords++;
    if (tireResult.valid && wheelResult.valid) {
      results.sampleByMake[makeKey].completeRecords++;
    }
  }
  
  // Calculate completion percentage
  results.summary.completionPct = ((results.summary.completeRecords / results.summary.totalRecords) * 100).toFixed(2);
  
  // Output summary
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`BATCH ${BATCH_NAME} COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total records:       ${results.summary.totalRecords}`);
  console.log(`Complete records:    ${results.summary.completeRecords} (${results.summary.completionPct}%)`);
  console.log(`Missing tire spec:   ${results.summary.missingTireSpec}`);
  console.log(`Missing wheel spec:  ${results.summary.missingWheelSpec}`);
  console.log(`Malformed tire:      ${results.summary.malformedTireSpec}`);
  console.log(`Malformed wheel:     ${results.summary.malformedWheelSpec}`);
  console.log(`Staggered incomplete:${results.summary.staggeredIncomplete}`);
  console.log(`Fake/grouped trim:   ${results.summary.fakeGroupedTrim}`);
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log(`HIGH severity:       ${results.summary.highSeverity}`);
  console.log(`MEDIUM severity:     ${results.summary.mediumSeverity}`);
  console.log(`LOW severity:        ${results.summary.lowSeverity}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `${BATCH_NAME}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results written to: ${outputPath}`);
  
  await sql.end();
  return results;
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
