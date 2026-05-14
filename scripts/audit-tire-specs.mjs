/**
 * Part 2A: Tire Spec Completeness Sweep
 * Audits ALL vehicle_fitments records (2000-2026) for tire spec issues
 * 
 * NO DATABASE WRITES - READ ONLY AUDIT
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
console.log('Loading env from:', envPath);
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  if (line.startsWith('#') || !line.includes('=')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (key && !process.env[key]) {
    process.env[key] = value;
  }
}

const POSTGRES_URL = process.env.POSTGRES_URL;
console.log('POSTGRES_URL found:', POSTGRES_URL ? 'yes (length=' + POSTGRES_URL.length + ')' : 'no');
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL not found in environment');
  process.exit(1);
}

// Mainstream makes for HIGH severity (2020-2026)
const MAINSTREAM_MAKES = new Set([
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Ram', 'Nissan', 
  'Hyundai', 'Kia', 'Jeep', 'Subaru', 'Mazda', 'Volkswagen', 'BMW',
  'Mercedes-Benz', 'Audi', 'Lexus', 'Tesla', 'Dodge', 'Buick', 'Cadillac',
  'Chrysler', 'Acura', 'Infiniti', 'Volvo', 'Lincoln'
]);

// Tire size validation patterns
// Standard: P245/40R18 92Y, LT265/70R17, 245/40ZR18, etc.
// Flotation: 35x12.50R17LT, 33x10.50R15
// Run-flat: 245/40RF21, 275/35ZRF21

// Validate a single tire size string
function validateTireSize(size) {
  if (!size || typeof size !== 'string') {
    return { valid: false, issue: 'empty_or_not_string' };
  }
  
  const trimmed = size.trim();
  if (!trimmed) {
    return { valid: false, issue: 'empty_string' };
  }

  // Most flexible pattern - matches:
  // P245/40R18, LT265/70R17, 245/40ZR18, 245/40RF21, 245/40ZRF21
  // With optional load/speed ratings like 92Y, 112S XL, etc.
  const metricPattern = /^(P|LT)?(\d{3})\/(\d{2,3})(ZR|R|RF|ZRF)(\d{2})([A-Z0-9\s]*)?$/i;
  if (metricPattern.test(trimmed)) {
    return { valid: true };
  }

  // Flotation format: 35x12.50R17, 33x10.50R15LT
  const flotationPattern = /^(\d{2,3})[xX](\d+\.?\d*)(R)?(\d{2})(LT|C)?$/i;
  if (flotationPattern.test(trimmed)) {
    return { valid: true };
  }

  // LT metric with extra suffixes: LT275/70R18E, LT285/75R16 126/123R
  const ltMetricPattern = /^LT(\d{3})\/(\d{2,3})R(\d{2})/i;
  if (ltMetricPattern.test(trimmed)) {
    return { valid: true };
  }

  // Basic metric without prefix: 215/55R17, 225/45ZR17
  const basicMetricPattern = /^(\d{3})\/(\d{2,3})(ZR|R)(\d{2})/i;
  if (basicMetricPattern.test(trimmed)) {
    return { valid: true };
  }

  // Specific issue detection for diagnostic purposes
  if (!/\d{3}/.test(trimmed)) {
    return { valid: false, issue: 'missing_width' };
  }
  if (!/\/\d{2,3}/.test(trimmed) && !/[xX]\d+/.test(trimmed)) {
    return { valid: false, issue: 'missing_aspect_ratio' };
  }
  if (!/R\d{2}|RF\d{2}|ZR\d{2}|ZRF\d{2}/i.test(trimmed)) {
    return { valid: false, issue: 'missing_diameter' };
  }

  return { valid: false, issue: 'invalid_format' };
}

// Validate a single axle's tire sizes (string or array of strings)
function validateAxleTires(sizes, axleName) {
  const issues = [];
  
  if (typeof sizes === 'string') {
    const validation = validateTireSize(sizes);
    if (!validation.valid) {
      issues.push({ issue: `${axleName}_tire_${validation.issue}`, value: sizes });
    }
  } else if (Array.isArray(sizes)) {
    if (sizes.length === 0) {
      issues.push({ issue: `${axleName}_empty_array`, value: sizes });
    } else {
      for (let i = 0; i < sizes.length; i++) {
        const validation = validateTireSize(sizes[i]);
        if (!validation.valid) {
          issues.push({ issue: `${axleName}[${i}]_${validation.issue}`, value: sizes[i] });
        }
      }
    }
  } else {
    issues.push({ issue: `${axleName}_invalid_type`, value: sizes });
  }
  
  return issues;
}

// Validate staggered tire object (front/rear with string or array values)
function validateStaggeredTireSpec(spec) {
  const issues = [];
  
  if (typeof spec !== 'object' || spec === null) {
    return [{ issue: 'not_an_object', value: spec }];
  }

  // Check for front/rear keys
  const hasFront = 'front' in spec;
  const hasRear = 'rear' in spec;
  
  if (!hasFront && !hasRear) {
    issues.push({ issue: 'missing_front_and_rear_keys', value: spec });
  } else {
    if (!hasFront) {
      issues.push({ issue: 'missing_front_key', value: spec });
    } else {
      issues.push(...validateAxleTires(spec.front, 'front'));
    }
    
    if (!hasRear) {
      issues.push({ issue: 'missing_rear_key', value: spec });
    } else {
      issues.push(...validateAxleTires(spec.rear, 'rear'));
    }
  }

  return issues;
}

// Determine severity
function determineSeverity(year, make) {
  const normalizedMake = make?.trim();
  
  if (year >= 2020 && year <= 2026 && MAINSTREAM_MAKES.has(normalizedMake)) {
    return 'HIGH';
  }
  if (year >= 2015 && year <= 2019) {
    return 'MEDIUM';
  }
  if (year >= 2015 && !MAINSTREAM_MAKES.has(normalizedMake)) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// Determine likely fix source
function determineLikelyFixSource(row, missingFields, malformedFields) {
  // If it's just missing, might have sibling with data
  if (missingFields.length > 0 && malformedFields.length === 0) {
    // Check if there could be sibling records
    return 'sibling_record';
  }
  
  // If malformed, need manual review or external source
  if (malformedFields.length > 0) {
    // Popular makes might be in USAF
    if (MAINSTREAM_MAKES.has(row.make)) {
      return 'usaf';
    }
    return 'manual_review';
  }
  
  return 'sibling_record';
}

// Describe customer impact
function describeCustomerImpact(missingFields, malformedFields, year, make, model) {
  const impacts = [];
  
  if (missingFields.includes('oem_tire_sizes')) {
    impacts.push('Cannot show OEM tire options for this vehicle');
  }
  
  if (malformedFields.length > 0) {
    impacts.push('Tire search may fail or return incorrect results');
  }
  
  if (year >= 2020) {
    impacts.push('High-demand recent model year');
  }
  
  return impacts.join('; ') || 'Limited tire fitment data';
}

async function runAudit() {
  console.log('Connecting to database...');
  const pool = new pg.Pool({ connectionString: POSTGRES_URL });
  
  try {
    // First, get the table schema to understand columns
    console.log('Checking table schema...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_fitments'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', schemaResult.rows.map(r => r.column_name).join(', '));
    
    // Count total records in range
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM vehicle_fitments 
      WHERE year >= 2000 AND year <= 2026
    `);
    const totalRecords = parseInt(countResult.rows[0].total);
    console.log(`Total records to check: ${totalRecords}`);

    // Fetch all records in batches
    const batchSize = 5000;
    let offset = 0;
    let totalChecked = 0;
    let totalComplete = 0;
    let totalMissingTireSpecs = 0;
    let totalMalformedTireSpecs = 0;
    const failures = [];

    while (offset < totalRecords) {
      console.log(`Processing batch at offset ${offset}...`);
      
      const result = await pool.query(`
        SELECT 
          id, year, make, model, display_trim,
          oem_tire_sizes, oem_wheel_sizes,
          certification_status, quality_tier
        FROM vehicle_fitments 
        WHERE year >= 2000 AND year <= 2026
        ORDER BY year DESC, make, model
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      for (const row of result.rows) {
        totalChecked++;
        
        const missingFields = [];
        const malformedFields = [];
        
        // Check oem_tire_sizes
        let tireSizes = row.oem_tire_sizes;
        
        // Check for stringified JSON (data integrity issue)
        if (typeof tireSizes === 'string') {
          try {
            const parsed = JSON.parse(tireSizes);
            // It's a stringified JSON - this is a data integrity issue
            malformedFields.push({
              field: 'oem_tire_sizes',
              value: tireSizes.substring(0, 100),
              issue: 'stringified_json_needs_parse'
            });
            tireSizes = parsed; // Use parsed value for further validation
          } catch {
            malformedFields.push({
              field: 'oem_tire_sizes',
              value: tireSizes.substring(0, 100),
              issue: 'unparseable_string'
            });
          }
        }
        
        if (tireSizes === null || tireSizes === undefined) {
          missingFields.push('oem_tire_sizes');
          totalMissingTireSpecs++;
        } else if (Array.isArray(tireSizes)) {
          if (tireSizes.length === 0) {
            missingFields.push('oem_tire_sizes');
            totalMissingTireSpecs++;
          } else {
            // Validate each tire size
            for (let i = 0; i < tireSizes.length; i++) {
              const item = tireSizes[i];
              
              if (typeof item === 'string') {
                // Simple string tire size
                const validation = validateTireSize(item);
                if (!validation.valid) {
                  malformedFields.push({
                    field: `oem_tire_sizes[${i}]`,
                    value: item,
                    issue: validation.issue
                  });
                }
              } else if (typeof item === 'object' && item !== null) {
                // Staggered tire spec (front/rear object)
                const staggeredIssues = validateStaggeredTireSpec(item);
                if (staggeredIssues.length > 0) {
                  for (const issue of staggeredIssues) {
                    malformedFields.push({
                      field: `oem_tire_sizes[${i}]`,
                      value: JSON.stringify(item),
                      issue: issue.issue
                    });
                  }
                }
              } else {
                malformedFields.push({
                  field: `oem_tire_sizes[${i}]`,
                  value: String(item),
                  issue: 'unexpected_type'
                });
              }
            }
            
            if (malformedFields.length > 0) {
              totalMalformedTireSpecs++;
            }
          }
        } else if (typeof tireSizes === 'object') {
          // Might be a single staggered spec stored directly
          const staggeredIssues = validateStaggeredTireSpec(tireSizes);
          if (staggeredIssues.length > 0) {
            for (const issue of staggeredIssues) {
              malformedFields.push({
                field: 'oem_tire_sizes',
                value: JSON.stringify(tireSizes),
                issue: issue.issue
              });
            }
            totalMalformedTireSpecs++;
          }
        } else {
          malformedFields.push({
            field: 'oem_tire_sizes',
            value: String(tireSizes),
            issue: 'unexpected_type_not_array'
          });
          totalMalformedTireSpecs++;
        }
        
        // If any issues, record failure
        if (missingFields.length > 0 || malformedFields.length > 0) {
          const severity = determineSeverity(row.year, row.make);
          
          failures.push({
            id: row.id,
            year: row.year,
            make: row.make,
            model: row.model,
            trim: row.display_trim,
            missing_fields: missingFields,
            malformed_fields: malformedFields,
            severity,
            customer_impact: describeCustomerImpact(
              missingFields, 
              malformedFields, 
              row.year, 
              row.make, 
              row.model
            ),
            likely_fix_source: determineLikelyFixSource(row, missingFields, malformedFields)
          });
        } else {
          totalComplete++;
        }
      }

      offset += batchSize;
      console.log(`  Checked: ${totalChecked}, Complete: ${totalComplete}, Missing: ${totalMissingTireSpecs}, Malformed: ${totalMalformedTireSpecs}`);
    }

    // Sort and extract high severity
    const highSeverity = failures.filter(f => f.severity === 'HIGH');
    
    // Sort high severity by year desc, then make
    highSeverity.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return a.make.localeCompare(b.make);
    });

    // Top 50 highest impact (HIGH severity first, then by year)
    const topImpact = [...failures]
      .sort((a, b) => {
        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.year - a.year;
      })
      .slice(0, 50);

    // Count issue types
    const issueTypes = {};
    for (const f of failures) {
      for (const m of f.malformed_fields) {
        issueTypes[m.issue] = (issueTypes[m.issue] || 0) + 1;
      }
      for (const m of f.missing_fields) {
        issueTypes[`missing_${m}`] = (issueTypes[`missing_${m}`] || 0) + 1;
      }
    }
    
    // Count by make (for high severity)
    const makeBreakdown = {};
    for (const f of highSeverity) {
      makeBreakdown[f.make] = (makeBreakdown[f.make] || 0) + 1;
    }
    
    // Build output
    const output = {
      timestamp: new Date().toISOString(),
      totalChecked,
      totalComplete,
      totalMissingTireSpecs,
      totalMalformedTireSpecs,
      failureCount: failures.length,
      highSeverityCount: highSeverity.length,
      
      // Summary statistics
      issueTypeBreakdown: Object.fromEntries(
        Object.entries(issueTypes).sort((a, b) => b[1] - a[1])
      ),
      highSeverityByMake: makeBreakdown,
      severityCounts: {
        HIGH: highSeverity.length,
        MEDIUM: failures.filter(f => f.severity === 'MEDIUM').length,
        LOW: failures.filter(f => f.severity === 'LOW').length
      },
      
      // Details
      failures,
      highSeverity,
      topImpact
    };

    // Write to file
    const outputPath = 'g:\\clawd\\fitment-audit-part2a-tires.json';
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nAudit complete! Results written to: ${outputPath}`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total Checked: ${totalChecked}`);
    console.log(`Total Complete: ${totalComplete} (${(totalComplete/totalChecked*100).toFixed(1)}%)`);
    console.log(`Missing Tire Specs: ${totalMissingTireSpecs}`);
    console.log(`Malformed Tire Specs: ${totalMalformedTireSpecs}`);
    console.log(`High Severity Issues: ${highSeverity.length}`);
    
    // Breakdown by severity
    console.log(`\nBy Severity:`);
    console.log(`  HIGH: ${output.severityCounts.HIGH}`);
    console.log(`  MEDIUM: ${output.severityCounts.MEDIUM}`);
    console.log(`  LOW: ${output.severityCounts.LOW}`);
    
    // Breakdown by issue type
    console.log(`\nBy Issue Type:`);
    for (const [issue, count] of Object.entries(output.issueTypeBreakdown)) {
      console.log(`  ${count} - ${issue}`);
    }
    
    // High severity by make
    if (Object.keys(output.highSeverityByMake).length > 0) {
      console.log(`\nHigh Severity by Make:`);
      for (const [make, count] of Object.entries(output.highSeverityByMake)) {
        console.log(`  ${make}: ${count}`);
      }
    }

  } finally {
    await pool.end();
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
