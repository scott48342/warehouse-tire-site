/**
 * Staggered Data Coverage Audit
 * 
 * Audits database coverage for German performance and EV platforms.
 * Identifies missing staggered records, incomplete data, and grouped trims.
 * 
 * NO LOGIC CHANGES - data gap identification only.
 */

import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET VEHICLES FOR AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

const AUDIT_TARGETS = {
  'BMW M Cars': [
    { make: 'BMW', model: 'M2', expectStaggered: true },
    { make: 'BMW', model: 'M3', expectStaggered: true },
    { make: 'BMW', model: 'M4', expectStaggered: true },
    { make: 'BMW', model: 'M5', expectStaggered: true },
    { make: 'BMW', model: 'M8', expectStaggered: true },
    { make: 'BMW', model: 'X3 M', expectStaggered: true },
    { make: 'BMW', model: 'X5 M', expectStaggered: true },
  ],
  'AMG Vehicles': [
    { make: 'Mercedes-Benz', model: 'AMG C 63', expectStaggered: true },
    { make: 'Mercedes-Benz', model: 'AMG E 63', expectStaggered: true },
    { make: 'Mercedes-Benz', model: 'AMG GT', expectStaggered: true },
    { make: 'Mercedes-Benz', model: 'AMG GLE 63', expectStaggered: true },
    { make: 'Mercedes-Benz', model: 'C 63 AMG', expectStaggered: true },
    { make: 'Mercedes-Benz', model: 'E 63 AMG', expectStaggered: true },
  ],
  'Audi RS': [
    { make: 'Audi', model: 'RS3', expectStaggered: true },
    { make: 'Audi', model: 'RS5', expectStaggered: true },
    { make: 'Audi', model: 'RS6', expectStaggered: true },
    { make: 'Audi', model: 'RS7', expectStaggered: true },
    { make: 'Audi', model: 'RS Q8', expectStaggered: true },
  ],
  'Porsche': [
    { make: 'Porsche', model: '911', expectStaggered: true },
    { make: 'Porsche', model: 'Taycan', expectStaggered: true },
    { make: 'Porsche', model: 'Panamera', expectStaggered: true },
    { make: 'Porsche', model: 'Cayman', expectStaggered: true },
    { make: 'Porsche', model: 'Boxster', expectStaggered: true },
  ],
  'EV Performance': [
    { make: 'Tesla', model: 'Model S', expectStaggered: true },
    { make: 'Tesla', model: 'Model 3', expectStaggered: false }, // Only Performance is staggered
    { make: 'Tesla', model: 'Model Y', expectStaggered: false },
    { make: 'Rivian', model: 'R1T', expectStaggered: false },
    { make: 'Rivian', model: 'R1S', expectStaggered: false },
    { make: 'Lucid', model: 'Air', expectStaggered: true },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function auditVehicleCoverage(make, model) {
  const { rows } = await pool.query(`
    SELECT 
      year,
      modification_id,
      display_trim,
      quality_tier,
      certification_status,
      oem_wheel_sizes,
      oem_tire_sizes,
      bolt_pattern,
      center_bore_mm
    FROM vehicle_fitments 
    WHERE make ILIKE $1 
    AND (model ILIKE $2 OR model ILIKE $3)
    ORDER BY year DESC, display_trim
  `, [make, model, `%${model}%`]);
  
  const results = {
    totalRecords: rows.length,
    years: [...new Set(rows.map(r => r.year))].sort((a, b) => b - a),
    trims: [],
    issues: [],
    staggeredReady: 0,
    squareOnly: 0,
    incomplete: 0,
    certified: 0,
  };
  
  for (const row of rows) {
    const wheels = row.oem_wheel_sizes || [];
    const tires = row.oem_tire_sizes || [];
    
    // Analyze wheel data
    const widths = [...new Set(wheels.map(w => w?.width).filter(Boolean))];
    const hasFront = wheels.some(w => w?.axle === 'front');
    const hasRear = wheels.some(w => w?.axle === 'rear');
    const hasMultipleWidths = widths.length >= 2;
    const widthDelta = widths.length >= 2 ? Math.max(...widths) - Math.min(...widths) : 0;
    
    // Determine staggered readiness
    let staggeredStatus = 'unknown';
    if (hasFront && hasRear && widthDelta >= 0.5) {
      staggeredStatus = 'staggered_ready';
      results.staggeredReady++;
    } else if (hasMultipleWidths && widthDelta >= 0.5) {
      staggeredStatus = 'needs_axle_markers';
      results.issues.push({
        year: row.year,
        trim: row.display_trim,
        issue: 'Has multiple widths but no front/rear markers',
        widths,
        suggestion: 'Add axle markers to wheel specs',
      });
    } else if (widths.length === 1 || widthDelta < 0.5) {
      staggeredStatus = 'square';
      results.squareOnly++;
    } else if (widths.length === 0) {
      staggeredStatus = 'no_wheel_data';
      results.incomplete++;
      results.issues.push({
        year: row.year,
        trim: row.display_trim,
        issue: 'No wheel size data',
        suggestion: 'Import wheel specs',
      });
    }
    
    // Check tire data
    const hasTires = tires.length > 0;
    const hasMultipleTireSizes = tires.length >= 2;
    
    // Check if grouped trim (might mask staggered)
    const isGroupedTrim = row.display_trim && /[,\/]/.test(row.display_trim);
    if (isGroupedTrim) {
      results.issues.push({
        year: row.year,
        trim: row.display_trim,
        issue: 'Grouped trim - may mask staggered variants',
        suggestion: 'Split into individual atomic trims',
      });
    }
    
    if (row.certification_status === 'certified') {
      results.certified++;
    }
    
    results.trims.push({
      year: row.year,
      trim: row.display_trim,
      modificationId: row.modification_id,
      qualityTier: row.quality_tier,
      certified: row.certification_status === 'certified',
      staggeredStatus,
      widths,
      hasFrontRear: hasFront && hasRear,
      tireCount: tires.length,
      boltPattern: row.bolt_pattern,
    });
  }
  
  return results;
}

async function runFullAudit() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  STAGGERED DATA COVERAGE AUDIT');
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const fullReport = {
    manufacturers: {},
    summary: {
      totalVehicles: 0,
      totalRecords: 0,
      staggeredReady: 0,
      needsAxleMarkers: 0,
      squareOnly: 0,
      incomplete: 0,
      missingModels: [],
    },
    recommendations: [],
  };

  for (const [category, vehicles] of Object.entries(AUDIT_TARGETS)) {
    console.log(`\n───────────────────────────────────────────────────────────────────`);
    console.log(`  ${category.toUpperCase()}`);
    console.log(`───────────────────────────────────────────────────────────────────\n`);

    for (const vehicle of vehicles) {
      fullReport.summary.totalVehicles++;
      
      const audit = await auditVehicleCoverage(vehicle.make, vehicle.model);
      
      if (audit.totalRecords === 0) {
        console.log(`  ❌ ${vehicle.make} ${vehicle.model}: NO DATA IN DB`);
        fullReport.summary.missingModels.push(`${vehicle.make} ${vehicle.model}`);
        continue;
      }
      
      fullReport.summary.totalRecords += audit.totalRecords;
      fullReport.summary.staggeredReady += audit.staggeredReady;
      fullReport.summary.squareOnly += audit.squareOnly;
      fullReport.summary.incomplete += audit.incomplete;
      
      // Count needs axle markers
      const needsMarkers = audit.issues.filter(i => i.issue.includes('no front/rear markers')).length;
      fullReport.summary.needsAxleMarkers += needsMarkers;
      
      // Status icon
      let icon = '✅';
      if (audit.staggeredReady === 0 && vehicle.expectStaggered) {
        icon = '⚠️';
      }
      if (audit.incomplete > 0) {
        icon = '❌';
      }
      
      console.log(`  ${icon} ${vehicle.make} ${vehicle.model}:`);
      console.log(`     Records: ${audit.totalRecords} | Years: ${audit.years.slice(0, 5).join(', ')}${audit.years.length > 5 ? '...' : ''}`);
      console.log(`     Staggered-ready: ${audit.staggeredReady} | Square: ${audit.squareOnly} | Incomplete: ${audit.incomplete}`);
      console.log(`     Certified: ${audit.certified}`);
      
      if (audit.issues.length > 0) {
        console.log(`     Issues: ${audit.issues.length}`);
        for (const issue of audit.issues.slice(0, 3)) {
          console.log(`       - ${issue.year} ${issue.trim}: ${issue.issue}`);
        }
        if (audit.issues.length > 3) {
          console.log(`       ... and ${audit.issues.length - 3} more`);
        }
      }
      
      // Sample trims
      const staggeredTrims = audit.trims.filter(t => t.staggeredStatus === 'staggered_ready').slice(0, 2);
      if (staggeredTrims.length > 0) {
        console.log(`     Sample staggered trims:`);
        for (const t of staggeredTrims) {
          console.log(`       - ${t.year} ${t.trim}: widths=${t.widths.join('/')}"`);
        }
      }
      
      // Store for report
      fullReport.manufacturers[`${vehicle.make} ${vehicle.model}`] = {
        ...audit,
        expectStaggered: vehicle.expectStaggered,
      };
    }
  }

  // Generate recommendations
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log('  COVERAGE SUMMARY:');
  console.log(`    Total models audited:     ${fullReport.summary.totalVehicles}`);
  console.log(`    Total DB records:         ${fullReport.summary.totalRecords}`);
  console.log(`    Staggered-ready:          ${fullReport.summary.staggeredReady}`);
  console.log(`    Needs axle markers:       ${fullReport.summary.needsAxleMarkers}`);
  console.log(`    Square only:              ${fullReport.summary.squareOnly}`);
  console.log(`    Incomplete data:          ${fullReport.summary.incomplete}`);
  
  if (fullReport.summary.missingModels.length > 0) {
    console.log(`\n  ❌ MISSING MODELS (${fullReport.summary.missingModels.length}):`);
    for (const m of fullReport.summary.missingModels) {
      console.log(`    - ${m}`);
    }
  }

  // Priority recommendations
  console.log('\n  RECOMMENDED ACTIONS (Priority Order):');
  
  let priority = 1;
  
  // 1. Add axle markers to existing data
  if (fullReport.summary.needsAxleMarkers > 0) {
    console.log(`\n  ${priority}. ADD FRONT/REAR AXLE MARKERS (${fullReport.summary.needsAxleMarkers} records)`);
    console.log(`     Many records have multiple wheel widths but no axle markers.`);
    console.log(`     Fix: Update oem_wheel_sizes to include axle: "front" or "rear"`);
    priority++;
  }
  
  // 2. Import missing models
  if (fullReport.summary.missingModels.length > 0) {
    console.log(`\n  ${priority}. IMPORT MISSING MODELS (${fullReport.summary.missingModels.length} models)`);
    for (const m of fullReport.summary.missingModels.slice(0, 5)) {
      console.log(`     - ${m}`);
    }
    priority++;
  }
  
  // 3. Fill incomplete data
  if (fullReport.summary.incomplete > 0) {
    console.log(`\n  ${priority}. COMPLETE WHEEL DATA (${fullReport.summary.incomplete} records)`);
    console.log(`     Records exist but have no wheel size data.`);
    priority++;
  }

  // Generate JSON report
  const reportPath = 'scripts/qa-certification/staggered-audit-report.json';
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
  console.log(`\n  Full report saved to: ${reportPath}`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  AUDIT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await pool.end();
}

runFullAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
