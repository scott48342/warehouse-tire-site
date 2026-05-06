/**
 * Tier-A Import Audit Script
 * 
 * Finds tier-a-import records that may be masking higher-quality data.
 * READ-ONLY - Does not modify DB.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Priority vehicles for staggered fitment
const STAGGERED_CAPABLE = {
  'Dodge': ['Challenger', 'Charger'],
  'Chevrolet': ['Camaro', 'Corvette'],
  'Ford': ['Mustang'],
  'BMW': ['M2', 'M3', 'M4', 'M5', 'M8'],
  'Mercedes-Benz': ['AMG C 43', 'AMG C 63', 'AMG E 63', 'AMG GT', 'AMG GLE 63'],
  'Audi': ['RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'RS Q8', 'R8'],
  'Porsche': ['911', 'Taycan', 'Panamera'],
};

const results = {
  duplicateCollisions: [],
  incompleteStaggered: [],
  betterSourceAvailable: [],
  summary: {
    totalTierARecords: 0,
    suspectRecords: 0,
    affectedVehicles: new Set(),
  }
};

console.log('🔍 Tier-A Import Audit\n');
console.log('='.repeat(60));

// 1. Find all tier-a-import records
console.log('\n📊 Phase 1: Counting tier-a-import records...');
const tierACount = await pool.query(`
  SELECT COUNT(*) as count FROM vehicle_fitments WHERE source = 'tier-a-import'
`);
results.summary.totalTierARecords = parseInt(tierACount.rows[0].count);
console.log(`   Total tier-a-import records: ${results.summary.totalTierARecords}`);

// 2. Find tier-a-import records where another source has the same YMM+trim
console.log('\n📊 Phase 2: Finding duplicate collisions...');
const duplicates = await pool.query(`
  WITH tier_a AS (
    SELECT id, year, make, model, modification_id, display_trim, source, oem_wheel_sizes, certification_status
    FROM vehicle_fitments
    WHERE source = 'tier-a-import'
  ),
  other_sources AS (
    SELECT id, year, make, model, modification_id, display_trim, source, oem_wheel_sizes, certification_status
    FROM vehicle_fitments
    WHERE source != 'tier-a-import'
  )
  SELECT 
    t.year, t.make, t.model, 
    t.modification_id as tier_a_mod_id,
    t.display_trim as tier_a_trim,
    t.source as tier_a_source,
    t.oem_wheel_sizes as tier_a_wheels,
    t.certification_status as tier_a_cert,
    o.modification_id as other_mod_id,
    o.display_trim as other_trim,
    o.source as other_source,
    o.oem_wheel_sizes as other_wheels,
    o.certification_status as other_cert
  FROM tier_a t
  JOIN other_sources o ON 
    t.year = o.year 
    AND LOWER(t.make) = LOWER(o.make)
    AND LOWER(t.model) = LOWER(o.model)
    AND (
      LOWER(t.display_trim) = LOWER(o.display_trim)
      OR LOWER(t.display_trim) LIKE '%' || LOWER(o.display_trim) || '%'
      OR LOWER(o.display_trim) LIKE '%' || LOWER(t.display_trim) || '%'
    )
  ORDER BY t.make, t.model, t.year DESC
`);

console.log(`   Found ${duplicates.rows.length} potential collisions`);

// Analyze each collision
for (const row of duplicates.rows) {
  const tierAWheels = row.tier_a_wheels || [];
  const otherWheels = row.other_wheels || [];
  
  // Check quality indicators
  const tierAHasFrontRear = tierAWheels.some(w => w.axle === 'front') && tierAWheels.some(w => w.axle === 'rear');
  const otherHasFrontRear = otherWheels.some(w => w.axle === 'front') && otherWheels.some(w => w.axle === 'rear');
  const tierAOnlyBoth = tierAWheels.length > 0 && tierAWheels.every(w => w.axle === 'both');
  
  // Determine if other source is better
  const otherIsBetter = !tierAHasFrontRear && otherHasFrontRear;
  
  if (otherIsBetter || tierAOnlyBoth) {
    results.duplicateCollisions.push({
      year: row.year,
      make: row.make,
      model: row.model,
      tierATrim: row.tier_a_trim,
      tierAModId: row.tier_a_mod_id,
      tierAWheelCount: tierAWheels.length,
      tierAHasFrontRear,
      tierAOnlyBoth,
      tierACert: row.tier_a_cert,
      otherTrim: row.other_trim,
      otherModId: row.other_mod_id,
      otherSource: row.other_source,
      otherWheelCount: otherWheels.length,
      otherHasFrontRear,
      otherCert: row.other_cert,
      recommendation: otherIsBetter ? 'DELETE_TIER_A' : 'REVIEW',
    });
    results.summary.affectedVehicles.add(`${row.year} ${row.make} ${row.model}`);
  }
}

// 3. Find tier-a-import records for staggered-capable vehicles with only axle="both"
console.log('\n📊 Phase 3: Finding incomplete staggered data...');
for (const [make, models] of Object.entries(STAGGERED_CAPABLE)) {
  for (const model of models) {
    const incomplete = await pool.query(`
      SELECT year, make, model, modification_id, display_trim, oem_wheel_sizes, source, certification_status
      FROM vehicle_fitments
      WHERE source = 'tier-a-import'
        AND LOWER(make) = LOWER($1)
        AND (LOWER(model) = LOWER($2) OR LOWER(model) LIKE LOWER($2) || '%')
        AND certification_status = 'certified'
      ORDER BY year DESC
    `, [make, model]);
    
    for (const row of incomplete.rows) {
      const wheels = row.oem_wheel_sizes || [];
      const hasFrontRear = wheels.some(w => w.axle === 'front') && wheels.some(w => w.axle === 'rear');
      const onlyBoth = wheels.length > 0 && wheels.every(w => w.axle === 'both');
      const widths = [...new Set(wheels.map(w => w.width))].sort((a,b) => a-b);
      const hasWidthVariation = widths.length > 1 && (widths[widths.length-1] - widths[0]) >= 1;
      
      // Flag if: staggered-capable + only "both" axle + width variation suggests staggered
      if (onlyBoth && hasWidthVariation) {
        results.incompleteStaggered.push({
          year: row.year,
          make: row.make,
          model: row.model,
          modId: row.modification_id,
          trim: row.display_trim,
          wheelCount: wheels.length,
          widths: widths.join(', '),
          hasFrontRear,
          onlyBoth,
          cert: row.certification_status,
          recommendation: 'NEEDS_AXLE_MARKERS',
        });
        results.summary.affectedVehicles.add(`${row.year} ${row.make} ${row.model}`);
      }
    }
  }
}

// 4. Check if better source exists for affected vehicles
console.log('\n📊 Phase 4: Checking for better source alternatives...');
for (const vehicle of results.summary.affectedVehicles) {
  const [year, make, ...modelParts] = vehicle.split(' ');
  const model = modelParts.join(' ');
  
  const alternatives = await pool.query(`
    SELECT source, COUNT(*) as count, 
           SUM(CASE WHEN oem_wheel_sizes::text LIKE '%"axle":"front"%' THEN 1 ELSE 0 END) as has_front_rear
    FROM vehicle_fitments
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) LIKE LOWER($3) || '%'
    GROUP BY source
    ORDER BY has_front_rear DESC
  `, [parseInt(year), make, model]);
  
  if (alternatives.rows.length > 1) {
    results.betterSourceAvailable.push({
      vehicle,
      sources: alternatives.rows.map(r => ({
        source: r.source,
        count: parseInt(r.count),
        hasFrontRear: parseInt(r.has_front_rear),
      })),
    });
  }
}

// Print results
console.log('\n' + '='.repeat(60));
console.log('📋 AUDIT RESULTS');
console.log('='.repeat(60));

console.log(`\n🔢 Summary:`);
console.log(`   Total tier-a-import records: ${results.summary.totalTierARecords}`);
console.log(`   Suspect records: ${results.duplicateCollisions.length + results.incompleteStaggered.length}`);
console.log(`   Affected vehicles: ${results.summary.affectedVehicles.size}`);

console.log(`\n⚠️  Duplicate Collisions (${results.duplicateCollisions.length}):`);
for (const r of results.duplicateCollisions) {
  console.log(`   ${r.year} ${r.make} ${r.model} "${r.tierATrim}"`);
  console.log(`      tier-a: ${r.tierAWheelCount} wheels, frontRear=${r.tierAHasFrontRear}, onlyBoth=${r.tierAOnlyBoth}`);
  console.log(`      ${r.otherSource}: ${r.otherWheelCount} wheels, frontRear=${r.otherHasFrontRear}`);
  console.log(`      → ${r.recommendation}`);
}

console.log(`\n⚠️  Incomplete Staggered (${results.incompleteStaggered.length}):`);
for (const r of results.incompleteStaggered) {
  console.log(`   ${r.year} ${r.make} ${r.model} "${r.trim}"`);
  console.log(`      ${r.wheelCount} wheels, widths=[${r.widths}], onlyBoth=${r.onlyBoth}`);
  console.log(`      → ${r.recommendation}`);
}

console.log(`\n📊 Source Comparison:`);
for (const r of results.betterSourceAvailable) {
  console.log(`   ${r.vehicle}:`);
  for (const s of r.sources) {
    console.log(`      ${s.source}: ${s.count} records, ${s.hasFrontRear} with front/rear`);
  }
}

// Generate dry-run SQL
console.log('\n' + '='.repeat(60));
console.log('📝 DRY-RUN SQL (DO NOT EXECUTE WITHOUT REVIEW)');
console.log('='.repeat(60));

const deleteTargets = results.duplicateCollisions.filter(r => r.recommendation === 'DELETE_TIER_A');
if (deleteTargets.length > 0) {
  console.log('\n-- Delete tier-a-import duplicates where better source exists:');
  for (const r of deleteTargets) {
    console.log(`-- ${r.year} ${r.make} ${r.model} "${r.tierATrim}"`);
    console.log(`DELETE FROM vehicle_fitments WHERE modification_id = '${r.tierAModId}' AND source = 'tier-a-import';`);
  }
}

await pool.end();
console.log('\n✅ Audit complete');
