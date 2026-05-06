#!/usr/bin/env node
/**
 * Audit Tier A staggered vehicle data
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function analyzeWheelSizes(oem_wheel_sizes) {
  if (!oem_wheel_sizes || oem_wheel_sizes.length === 0) return { hasData: false };
  
  const widths = [...new Set(oem_wheel_sizes.map(w => w.width))].filter(Boolean);
  const hasAxle = oem_wheel_sizes.some(w => w.axle);
  const hasFrontRear = oem_wheel_sizes.some(w => w.axle === 'front') && 
                       oem_wheel_sizes.some(w => w.axle === 'rear');
  const diameters = [...new Set(oem_wheel_sizes.map(w => w.diameter))].filter(Boolean);
  
  return {
    hasData: true,
    isStaggered: widths.length > 1 || hasFrontRear,
    hasAxleMarkers: hasAxle,
    hasFrontRear,
    widths,
    diameters,
    frontWidth: oem_wheel_sizes.find(w => w.axle === 'front')?.width,
    rearWidth: oem_wheel_sizes.find(w => w.axle === 'rear')?.width,
  };
}

async function audit() {
  console.log('='.repeat(70));
  console.log('TIER A STAGGERED DATA AUDIT - DETAILED');
  console.log('='.repeat(70));
  
  const vehicles = [
    { make: 'Chevrolet', model: 'Camaro', trims: ['SS', 'SS 1LE', 'ZL1', 'ZL1 1LE', 'LT', '1LT', '2LT', 'LT1'] },
    { make: 'Dodge', model: 'Challenger', trims: ['Hellcat', 'Hellcat Widebody', 'Scat Pack', 'Scat Pack Widebody', 'R/T', 'SRT Demon'] },
    { make: 'Ford', model: 'Mustang', trims: ['GT', 'GT Performance Pack', 'Dark Horse', 'Shelby GT350', 'Shelby GT500', 'EcoBoost', 'Mach 1'] },
    { make: 'Chevrolet', model: 'Corvette', trims: ['Stingray', 'Z06', 'Grand Sport', 'E-Ray', 'ZR1'] },
  ];
  
  const summary = {
    total: 0,
    hasData: 0,
    isStaggered: 0,
    hasAxleMarkers: 0,
    missingData: [],
    needsAxleMarkers: [],
  };
  
  for (const vehicle of vehicles) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${vehicle.make.toUpperCase()} ${vehicle.model.toUpperCase()}`);
    console.log('='.repeat(70));
    
    const result = await pool.query(`
      SELECT year, modification_id, display_trim, oem_wheel_sizes, oem_tire_sizes, certification_status
      FROM vehicle_fitments
      WHERE make = $1 AND model = $2
      AND year >= 2020
      ORDER BY year DESC, display_trim
    `, [vehicle.make, vehicle.model]);
    
    if (result.rows.length === 0) {
      console.log('  ❌ NO DATA IN DATABASE');
      summary.missingData.push(`${vehicle.make} ${vehicle.model} (all years)`);
      continue;
    }
    
    // Group by year and trim
    const byYearTrim = {};
    for (const row of result.rows) {
      const key = `${row.year} ${row.display_trim || row.modification_id}`;
      byYearTrim[key] = row;
    }
    
    for (const [key, row] of Object.entries(byYearTrim)) {
      summary.total++;
      const analysis = analyzeWheelSizes(row.oem_wheel_sizes);
      
      let status = '';
      if (!analysis.hasData) {
        status = '❌ NO WHEEL DATA';
        summary.missingData.push(key);
      } else if (analysis.isStaggered && analysis.hasFrontRear) {
        status = `✓ STAGGERED F=${analysis.frontWidth}" R=${analysis.rearWidth}"`;
        summary.hasData++;
        summary.isStaggered++;
        summary.hasAxleMarkers++;
      } else if (analysis.isStaggered && !analysis.hasFrontRear) {
        status = `⚠ STAGGERED but NO AXLE MARKERS (widths: ${analysis.widths.join('/')})`;
        summary.hasData++;
        summary.isStaggered++;
        summary.needsAxleMarkers.push(key);
      } else {
        status = `○ square (width: ${analysis.widths.join('/')})`;
        summary.hasData++;
      }
      
      const tires = row.oem_tire_sizes?.slice(0, 3).join(', ') || 'none';
      console.log(`  ${key}: ${status}`);
      console.log(`      tires: ${tires}`);
    }
    
    // Check for missing priority trims
    const existingTrims = Object.values(byYearTrim).map(r => (r.display_trim || '').toLowerCase());
    for (const trim of vehicle.trims) {
      const hasThis = existingTrims.some(t => t.includes(trim.toLowerCase()));
      if (!hasThis) {
        console.log(`  ⚠ MISSING TRIM: ${trim}`);
      }
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total records:       ${summary.total}`);
  console.log(`Has wheel data:      ${summary.hasData}`);
  console.log(`Is staggered:        ${summary.isStaggered}`);
  console.log(`Has axle markers:    ${summary.hasAxleMarkers}`);
  console.log(`\nMissing data (${summary.missingData.length}):`);
  summary.missingData.slice(0, 10).forEach(m => console.log(`  - ${m}`));
  if (summary.missingData.length > 10) console.log(`  ... and ${summary.missingData.length - 10} more`);
  console.log(`\nNeeds axle markers (${summary.needsAxleMarkers.length}):`);
  summary.needsAxleMarkers.forEach(m => console.log(`  - ${m}`));
  
  await pool.end();
}

audit().catch(console.error);
