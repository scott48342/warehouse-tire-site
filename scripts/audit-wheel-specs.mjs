/**
 * Part 2B: Wheel Spec Completeness Audit
 * 
 * Scans ALL vehicle_fitments records (2000-2026) and checks wheel spec completeness.
 * NO DB WRITES - audit only!
 */

import { config } from 'dotenv';
import pg from 'pg';

// Load environment
config({ path: '.env.local' });

const { Pool } = pg;

// Connect to Prisma Postgres
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Mainstream makes (HIGH severity if recent)
const MAINSTREAM_MAKES = new Set([
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Ram', 'Nissan', 'Hyundai', 'Kia',
  'Subaru', 'Mazda', 'Jeep', 'Dodge', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Audi',
  'Lexus', 'Acura', 'Infiniti', 'Cadillac', 'Buick', 'Lincoln', 'Chrysler', 'Volvo',
  'Tesla', 'Porsche', 'Land Rover', 'Jaguar', 'Genesis', 'Rivian', 'Lucid'
]);

// HD truck models (always HIGH severity for wheel specs)
const HD_TRUCK_PATTERNS = [
  /2500/i, /3500/i, /4500/i, /5500/i, /F-250/i, /F-350/i, /F-450/i,
  /Super Duty/i, /Heavy Duty/i, /HD$/i, /Silverado.*HD/i, /Sierra.*HD/i
];

// Bolt pattern validation: should be like "5x114.3" or "6x139.7"
const BOLT_PATTERN_REGEX = /^\d+x\d+(\.\d+)?$/;

// Thread size validation: like "M12x1.5" or "14x1.5"
const THREAD_SIZE_REGEX = /^(M)?\d+(\.\d+)?x\d+(\.\d+)?$/i;

// Valid seat types
const VALID_SEAT_TYPES = new Set([
  'cone', 'conical', 'ball', 'flat', 'mag', 'shank', 'acorn', 'tuner', 'spline'
]);

function isHDTruck(model) {
  return HD_TRUCK_PATTERNS.some(pattern => pattern.test(model));
}

function getSeverity(year, make, model) {
  // HD trucks are always HIGH
  if (isHDTruck(model)) return 'HIGH';
  
  // 2020-2026 mainstream = HIGH
  if (year >= 2020 && MAINSTREAM_MAKES.has(make)) return 'HIGH';
  
  // 2015-2019 or less common = MEDIUM
  if (year >= 2015) return 'MEDIUM';
  
  // Pre-2015 or exotic = LOW
  return 'LOW';
}

function getLikelyFixSource(record, missingFields, malformedFields) {
  const allIssueFields = [...missingFields, ...malformedFields.map(m => m.field)];
  
  // If only minor fields missing, siblings might have them
  if (allIssueFields.every(f => ['thread_size', 'seat_type'].includes(f))) {
    return 'sibling_record';
  }
  
  // Bolt pattern issues often need USAF
  if (allIssueFields.includes('bolt_pattern')) {
    return 'usaf';
  }
  
  // Wheel sizes and offsets - WheelPros or USAF
  if (allIssueFields.includes('oem_wheel_sizes') || 
      allIssueFields.includes('offset_min_mm') || 
      allIssueFields.includes('offset_max_mm')) {
    return 'wheelpros';
  }
  
  // Center bore - usually needs manual review
  if (allIssueFields.includes('center_bore_mm')) {
    return 'manual_review';
  }
  
  return 'manual_review';
}

function getCustomerImpact(missingFields, malformedFields) {
  const impacts = [];
  const allFields = [...missingFields, ...malformedFields.map(m => m.field)];
  
  if (allFields.includes('bolt_pattern')) {
    impacts.push('Cannot show compatible wheels - wheel search fails');
  }
  if (allFields.includes('center_bore_mm')) {
    impacts.push('Cannot verify hub fitment - potential safety issue');
  }
  if (allFields.includes('oem_wheel_sizes')) {
    impacts.push('Cannot determine proper wheel diameter/width options');
  }
  if (allFields.includes('offset_min_mm') || allFields.includes('offset_max_mm')) {
    impacts.push('Cannot filter by safe offset range - fitment issues possible');
  }
  if (allFields.includes('thread_size')) {
    impacts.push('Cannot recommend correct lug nuts');
  }
  if (allFields.includes('seat_type')) {
    impacts.push('May recommend wrong lug nut seat type');
  }
  
  return impacts.join('; ') || 'Minor data quality issue';
}

function validateWheelSizes(oemWheelSizes) {
  const issues = [];
  
  if (!oemWheelSizes) {
    return { valid: false, issues: ['null or undefined'] };
  }
  
  if (typeof oemWheelSizes === 'string') {
    try {
      oemWheelSizes = JSON.parse(oemWheelSizes);
    } catch (e) {
      return { valid: false, issues: ['Invalid JSON string'] };
    }
  }
  
  if (!Array.isArray(oemWheelSizes)) {
    return { valid: false, issues: ['Not an array'] };
  }
  
  if (oemWheelSizes.length === 0) {
    return { valid: false, issues: ['Empty array'] };
  }
  
  // Check structure of each wheel size entry
  for (let i = 0; i < oemWheelSizes.length; i++) {
    const ws = oemWheelSizes[i];
    if (typeof ws !== 'object' || ws === null) {
      issues.push(`Entry ${i}: not an object`);
      continue;
    }
    
    // Should have diameter
    if (!ws.diameter && !ws.wheelDiameter) {
      issues.push(`Entry ${i}: missing diameter`);
    }
    
    // Should have width
    if (!ws.width && !ws.wheelWidth && !ws.frontWidth) {
      issues.push(`Entry ${i}: missing width`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

function checkStaggeredData(oemWheelSizes, model, trim) {
  // Check if this is likely a staggered vehicle
  const staggeredKeywords = ['GT', 'Performance', 'Sport', 'Track', 'SS', 'SRT', 'AMG', 'M3', 'M4', 'M5'];
  const likelyStaggered = staggeredKeywords.some(kw => 
    model?.includes(kw) || trim?.includes(kw)
  );
  
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) {
    return { hasStaggeredData: false, needsStaggered: likelyStaggered };
  }
  
  // Check if staggered data exists
  const hasStaggeredData = oemWheelSizes.some(ws => 
    ws.rearWidth || ws.rearDiameter || ws.isStaggered || 
    (ws.frontWidth && ws.rearWidth && ws.frontWidth !== ws.rearWidth)
  );
  
  return { hasStaggeredData, needsStaggered: likelyStaggered };
}

function checkSrwDrw(model, trim) {
  // Check if this is an HD truck that should have SRW/DRW indicator
  if (!isHDTruck(model)) {
    return { isHDTruck: false, hasSrwDrw: null };
  }
  
  // Check if SRW or DRW is indicated
  const hasSrw = /\bSRW\b/i.test(trim) || /\bSRW\b/i.test(model) || /Single Rear Wheel/i.test(trim);
  const hasDrw = /\bDRW\b/i.test(trim) || /\bDRW\b/i.test(model) || /Dual Rear Wheel/i.test(trim) || /Dually/i.test(trim);
  
  return { 
    isHDTruck: true, 
    hasSrwDrw: hasSrw || hasDrw,
    srwDrwValue: hasSrw ? 'SRW' : (hasDrw ? 'DRW' : null)
  };
}

async function runAudit() {
  console.log('Starting Wheel Spec Completeness Audit...\n');
  
  const startTime = Date.now();
  
  // Query all records 2000-2026
  const query = `
    SELECT 
      id, year, make, model, display_trim, raw_trim, submodel, modification_id,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm, oem_wheel_sizes,
      source, quality_tier, confidence_tag
    FROM vehicle_fitments
    WHERE year >= 2000 AND year <= 2026
    ORDER BY year DESC, make, model
  `;
  
  console.log('Querying database...');
  const { rows } = await pool.query(query);
  console.log(`Found ${rows.length} records to audit\n`);
  
  const stats = {
    totalChecked: rows.length,
    totalComplete: 0,
    totalMissingBoltPattern: 0,
    totalMissingCenterBore: 0,
    totalMissingWheelSizes: 0,
    totalMissingOffset: 0,
    totalMalformed: 0,
    totalMissingThreadSize: 0,
    totalMissingSeatType: 0,
    totalHDTrucksMissingSrwDrw: 0,
    totalStaggeredMissingRearData: 0
  };
  
  const failures = [];
  const highSeverity = [];
  
  let processed = 0;
  
  for (const row of rows) {
    processed++;
    if (processed % 5000 === 0) {
      console.log(`Progress: ${processed}/${rows.length} (${Math.round(processed/rows.length*100)}%)`);
    }
    
    const missingFields = [];
    const malformedFields = [];
    
    // Check bolt_pattern
    if (!row.bolt_pattern) {
      missingFields.push('bolt_pattern');
      stats.totalMissingBoltPattern++;
    } else if (!BOLT_PATTERN_REGEX.test(row.bolt_pattern)) {
      malformedFields.push({ field: 'bolt_pattern', value: row.bolt_pattern, issue: 'Invalid format (expected NxN.N)' });
      stats.totalMalformed++;
    }
    
    // Check center_bore_mm
    if (row.center_bore_mm === null || row.center_bore_mm === undefined) {
      missingFields.push('center_bore_mm');
      stats.totalMissingCenterBore++;
    } else {
      const cbVal = parseFloat(row.center_bore_mm);
      if (isNaN(cbVal) || cbVal <= 0 || cbVal > 200) {
        malformedFields.push({ field: 'center_bore_mm', value: row.center_bore_mm, issue: 'Invalid value (should be 0-200mm)' });
        stats.totalMalformed++;
      }
    }
    
    // Check oem_wheel_sizes
    const wheelSizeValidation = validateWheelSizes(row.oem_wheel_sizes);
    if (!wheelSizeValidation.valid) {
      if (!row.oem_wheel_sizes || (Array.isArray(row.oem_wheel_sizes) && row.oem_wheel_sizes.length === 0)) {
        missingFields.push('oem_wheel_sizes');
        stats.totalMissingWheelSizes++;
      } else {
        malformedFields.push({ 
          field: 'oem_wheel_sizes', 
          value: JSON.stringify(row.oem_wheel_sizes).substring(0, 100), 
          issue: wheelSizeValidation.issues.join(', ') 
        });
        stats.totalMalformed++;
      }
    }
    
    // Check offset range
    if (row.offset_min_mm === null || row.offset_min_mm === undefined) {
      missingFields.push('offset_min_mm');
      stats.totalMissingOffset++;
    } else if (row.offset_max_mm === null || row.offset_max_mm === undefined) {
      missingFields.push('offset_max_mm');
      stats.totalMissingOffset++;
    } else {
      const minOffset = parseInt(row.offset_min_mm);
      const maxOffset = parseInt(row.offset_max_mm);
      if (isNaN(minOffset) || isNaN(maxOffset)) {
        malformedFields.push({ field: 'offset_range', value: `${row.offset_min_mm}-${row.offset_max_mm}`, issue: 'Non-numeric values' });
        stats.totalMalformed++;
      } else if (minOffset > maxOffset) {
        malformedFields.push({ field: 'offset_range', value: `${minOffset}-${maxOffset}`, issue: 'min > max' });
        stats.totalMalformed++;
      } else if (minOffset < -100 || maxOffset > 100) {
        malformedFields.push({ field: 'offset_range', value: `${minOffset}-${maxOffset}`, issue: 'Values out of typical range (-100 to +100)' });
        stats.totalMalformed++;
      }
    }
    
    // Check thread_size
    if (!row.thread_size) {
      missingFields.push('thread_size');
      stats.totalMissingThreadSize++;
    } else if (!THREAD_SIZE_REGEX.test(row.thread_size)) {
      malformedFields.push({ field: 'thread_size', value: row.thread_size, issue: 'Invalid format (expected M12x1.5 or 14x1.5)' });
      stats.totalMalformed++;
    }
    
    // Check seat_type (optional but validate if present)
    if (row.seat_type) {
      const normalizedSeat = row.seat_type.toLowerCase().trim();
      if (!VALID_SEAT_TYPES.has(normalizedSeat)) {
        malformedFields.push({ field: 'seat_type', value: row.seat_type, issue: `Unknown seat type (valid: ${[...VALID_SEAT_TYPES].join(', ')})` });
        stats.totalMalformed++;
      }
    } else {
      // seat_type missing is less critical but track it
      missingFields.push('seat_type');
      stats.totalMissingSeatType++;
    }
    
    // Check staggered data for performance vehicles
    const staggeredCheck = checkStaggeredData(row.oem_wheel_sizes, row.model, row.display_trim);
    if (staggeredCheck.needsStaggered && !staggeredCheck.hasStaggeredData) {
      malformedFields.push({ 
        field: 'staggered_data', 
        value: 'missing', 
        issue: 'Performance vehicle likely needs staggered wheel data (front/rear widths)' 
      });
      stats.totalStaggeredMissingRearData++;
    }
    
    // Check SRW/DRW for HD trucks
    const srwDrwCheck = checkSrwDrw(row.model, row.display_trim);
    if (srwDrwCheck.isHDTruck && !srwDrwCheck.hasSrwDrw) {
      malformedFields.push({
        field: 'srw_drw_indicator',
        value: 'missing',
        issue: 'HD truck missing SRW/DRW indicator - critical for bolt pattern (GM 2011+)'
      });
      stats.totalHDTrucksMissingSrwDrw++;
    }
    
    // If no issues, count as complete
    if (missingFields.length === 0 && malformedFields.length === 0) {
      stats.totalComplete++;
      continue;
    }
    
    // Create failure record
    const severity = getSeverity(row.year, row.make, row.model);
    const failure = {
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.display_trim,
      modificationId: row.modification_id,
      missingFields,
      malformedFields,
      severity,
      customerImpact: getCustomerImpact(missingFields, malformedFields),
      likelyFixSource: getLikelyFixSource(row, missingFields, malformedFields),
      currentValues: {
        boltPattern: row.bolt_pattern,
        centerBoreMm: row.center_bore_mm,
        threadSize: row.thread_size,
        seatType: row.seat_type,
        offsetMin: row.offset_min_mm,
        offsetMax: row.offset_max_mm,
        source: row.source,
        confidenceTag: row.confidence_tag
      }
    };
    
    failures.push(failure);
    
    if (severity === 'HIGH') {
      highSeverity.push(failure);
    }
  }
  
  // Sort failures by severity and year
  const severityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
  failures.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.year - a.year;
  });
  
  // Get top 50 impact (HIGH severity, most missing fields)
  const topImpact = [...highSeverity]
    .sort((a, b) => {
      const aCount = a.missingFields.length + a.malformedFields.length;
      const bCount = b.missingFields.length + b.malformedFields.length;
      if (aCount !== bCount) return bCount - aCount;
      return b.year - a.year;
    })
    .slice(0, 50);
  
  const elapsedMs = Date.now() - startTime;
  
  const report = {
    timestamp: new Date().toISOString(),
    durationMs: elapsedMs,
    totalChecked: stats.totalChecked,
    totalComplete: stats.totalComplete,
    totalWithIssues: failures.length,
    completionRate: `${((stats.totalComplete / stats.totalChecked) * 100).toFixed(2)}%`,
    
    // Summary by missing field
    totalMissingBoltPattern: stats.totalMissingBoltPattern,
    totalMissingCenterBore: stats.totalMissingCenterBore,
    totalMissingWheelSizes: stats.totalMissingWheelSizes,
    totalMissingOffset: stats.totalMissingOffset,
    totalMissingThreadSize: stats.totalMissingThreadSize,
    totalMissingSeatType: stats.totalMissingSeatType,
    totalMalformed: stats.totalMalformed,
    
    // Special checks
    totalHDTrucksMissingSrwDrw: stats.totalHDTrucksMissingSrwDrw,
    totalStaggeredMissingRearData: stats.totalStaggeredMissingRearData,
    
    // Severity breakdown
    severityBreakdown: {
      HIGH: highSeverity.length,
      MEDIUM: failures.filter(f => f.severity === 'MEDIUM').length,
      LOW: failures.filter(f => f.severity === 'LOW').length
    },
    
    // Fix source breakdown
    fixSourceBreakdown: failures.reduce((acc, f) => {
      acc[f.likelyFixSource] = (acc[f.likelyFixSource] || 0) + 1;
      return acc;
    }, {}),
    
    // Detailed lists
    highSeverity: highSeverity.slice(0, 500), // Cap at 500 to avoid huge file
    topImpact,
    failures: failures.slice(0, 2000) // Cap at 2000 to avoid huge file
  };
  
  // Write report
  const outputPath = 'g:\\clawd\\fitment-audit-part2b-wheels.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  console.log('\n=== WHEEL SPEC COMPLETENESS AUDIT RESULTS ===\n');
  console.log(`Total records checked: ${stats.totalChecked}`);
  console.log(`Total complete: ${stats.totalComplete} (${report.completionRate})`);
  console.log(`Total with issues: ${failures.length}`);
  console.log('');
  console.log('Missing Fields Summary:');
  console.log(`  - Missing bolt_pattern: ${stats.totalMissingBoltPattern}`);
  console.log(`  - Missing center_bore_mm: ${stats.totalMissingCenterBore}`);
  console.log(`  - Missing oem_wheel_sizes: ${stats.totalMissingWheelSizes}`);
  console.log(`  - Missing offset range: ${stats.totalMissingOffset}`);
  console.log(`  - Missing thread_size: ${stats.totalMissingThreadSize}`);
  console.log(`  - Missing seat_type: ${stats.totalMissingSeatType}`);
  console.log(`  - Malformed values: ${stats.totalMalformed}`);
  console.log('');
  console.log('Special Checks:');
  console.log(`  - HD trucks missing SRW/DRW: ${stats.totalHDTrucksMissingSrwDrw}`);
  console.log(`  - Staggered vehicles missing rear data: ${stats.totalStaggeredMissingRearData}`);
  console.log('');
  console.log('Severity Breakdown:');
  console.log(`  - HIGH: ${highSeverity.length}`);
  console.log(`  - MEDIUM: ${failures.filter(f => f.severity === 'MEDIUM').length}`);
  console.log(`  - LOW: ${failures.filter(f => f.severity === 'LOW').length}`);
  console.log('');
  console.log('Likely Fix Source:');
  Object.entries(report.fixSourceBreakdown).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count}`);
  });
  console.log('');
  console.log(`Report saved to: ${outputPath}`);
  console.log(`Duration: ${(elapsedMs / 1000).toFixed(1)}s`);
  
  await pool.end();
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
