/**
 * Revert Axle Markers on HD Trucks and Non-Performance Vehicles
 * 
 * CRITICAL FIX (2026-05-06): The fix-axle-markers.mjs script incorrectly applied
 * front/rear axle markers to HD trucks and other non-staggered vehicles.
 * 
 * Problem: HD trucks like Silverado 2500 HD have multiple wheel WIDTH options
 * (e.g., 8" and 8.5") that are NOT staggered setups - they're just factory options.
 * The script marked narrower=front, wider=rear which made them appear staggered.
 * 
 * Fix: Remove axle markers from vehicles that should NOT be staggered:
 * - HD trucks (2500/3500-class)
 * - Half-ton trucks (F-150, Silverado 1500, etc.)
 * - Full-size SUVs (Tahoe, Suburban, Expedition, etc.)
 * - Midsize trucks (Tacoma, Ranger, Colorado, etc.)
 * 
 * Keep axle markers ONLY on known staggered-capable vehicles:
 * - Performance cars (Mustang, Camaro, Corvette, etc.)
 * - German performance (BMW M-series, Mercedes AMG, Audi RS, Porsche)
 * - Sports cars (Nissan Z, Toyota Supra, etc.)
 */

import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Models that ARE staggered-capable (KEEP their axle markers)
const STAGGERED_CAPABLE_MODELS = [
  // Ford - ONLY Mustang
  /^mustang/i,
  // Chevrolet - ONLY Corvette, Camaro
  /^corvette/i,
  /^camaro/i,
  // Dodge - Challenger, Charger, Viper
  /^challenger/i,
  /^charger/i,
  /^viper/i,
  // BMW M-series and sports
  /^m[2-8]/i,
  /^z[1-8]/i,
  // Mercedes AMG and sports
  /amg/i,
  /^sl[0-9-]/i,
  /^sl$/i,
  /^cls/i,
  /^gt$/i,
  /^gt-?c/i,
  /^gt-?r/i,
  /^gt-?s/i,
  // Audi RS and sports
  /^rs/i,
  /^r8/i,
  /^tt/i,
  /^s[3-8]$/i,
  // Porsche (ALL Porsche models are performance-oriented)
  /^911/i,
  /^cayman/i,
  /^boxster/i,
  /^panamera/i,
  /^taycan/i,
  /^carrera/i,
  /^macan/i,
  /^cayenne/i,  // Porsche Cayenne is performance SUV
  // Nissan sports
  /^gt-?r/i,
  /^370z/i,
  /^350z/i,
  /^z$/i,
  /^fairlady/i,
  // Lexus sports
  /^rc/i,
  /^lc/i,
  /^is-?f/i,
  /^gs-?f/i,
  /^lfa/i,
  // Toyota sports
  /^supra/i,
  /^gr86/i,
  // Subaru sports
  /^brz/i,
  // Mazda sports
  /^mx-?5/i,
  /^miata/i,
  /^rx-?[78]/i,
  // Jaguar sports (F-Type is sports car)
  /^f-?type/i,
  /^xk/i,
  /^xj/i,
  // Infiniti sports
  /^g37/i,
  /^q60/i,
];

function isStaggeredCapableModel(model) {
  const normalized = (model || '').trim();
  return STAGGERED_CAPABLE_MODELS.some(pattern => pattern.test(normalized));
}

// Makes that should NEVER have staggered fitment
// (entire make is trucks/SUVs with no sports cars)
const NEVER_STAGGERED_MAKES = [
  'ram',
  'gmc',
];

function isNeverStaggeredMake(make) {
  return NEVER_STAGGERED_MAKES.includes((make || '').toLowerCase().trim());
}

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

async function revertTruckAxleMarkers() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  REVERT TRUCK AXLE MARKERS (Staggered False Positive Fix)');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Find records that have axle markers applied (from the earlier fix)
  // We only need to check records from the STAGGERED_MAKES that were processed
  const STAGGERED_MAKES = [
    'BMW',
    'Mercedes-Benz',
    'Audi',
    'Porsche',
    'Ferrari',
    'Lamborghini',
    'Maserati',
    'McLaren',
    'Aston Martin',
    'Jaguar',
    'Lexus',
    'Infiniti',
    'Nissan',
    'Tesla',
    'Rivian',
    'Lucid',
    'Ford',      // Mustang - but also got F-150, F-250, etc.
    'Chevrolet', // Corvette, Camaro - but also got Silverado, Tahoe, etc.
    'Dodge',     // Challenger, Charger - but also Ram (wait, RAM is separate)
    'RAM',       // All trucks - should never be staggered
    'GMC',       // All trucks/SUVs - should never be staggered
  ];

  const { rows: allRows } = await pool.query(`
    SELECT id, year, make, model, modification_id, display_trim, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE make = ANY($1)
    AND certification_status = 'certified'
  `, [STAGGERED_MAKES]);
  
  // Filter to records with axle markers
  const rowsWithAxleMarkers = allRows.filter(r => {
    const wheels = r.oem_wheel_sizes;
    if (!Array.isArray(wheels) || wheels.length === 0) return false;
    return wheels.some(w => w?.axle === 'front' || w?.axle === 'rear');
  });

  console.log(`Found ${rowsWithAxleMarkers.length} records with axle markers to analyze...\n`);

  let reverted = 0;
  let kept = 0;
  let skipped = 0;
  const updates = [];

  for (const row of rowsWithAxleMarkers) {
    const wheels = row.oem_wheel_sizes || [];
    const make = row.make;
    const model = row.model;
    
    // Check if this vehicle IS staggered-capable
    const isCapable = isStaggeredCapableModel(model) && !isNeverStaggeredMake(make);
    
    if (isCapable) {
      // Keep axle markers for staggered-capable vehicles
      kept++;
      if (VERBOSE) {
        console.log(`  ✅ KEEP: ${row.year} ${make} ${model} (staggered-capable)`);
      }
      continue;
    }
    
    // This vehicle should NOT have axle markers - revert them
    const revertedWheels = wheels.map(w => {
      if (!w) return w;
      // Remove axle marker if it's front or rear, set to 'both'
      if (w.axle === 'front' || w.axle === 'rear') {
        const { axle, ...rest } = w;
        return { ...rest, axle: 'both' };
      }
      return w;
    });
    
    updates.push({
      id: row.id,
      vehicle: `${row.year} ${make} ${model} ${row.display_trim || ''}`.trim(),
      originalWheels: wheels,
      revertedWheels,
    });
    
    if (VERBOSE) {
      console.log(`  🔄 REVERT: ${row.year} ${make} ${model} ${row.display_trim || ''}`);
    }
    
    reverted++;
  }

  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────\n');
  
  console.log(`  Staggered-capable (kept):     ${kept}`);
  console.log(`  Non-staggered (to revert):    ${reverted}`);
  console.log(`  Total with markers:           ${rowsWithAxleMarkers.length}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No changes made. Run without --dry-run to apply.\n');
    
    // Show sample reverts
    console.log('  Sample reverts that would be applied:');
    for (const update of updates.slice(0, 10)) {
      console.log(`    - ${update.vehicle}`);
    }
    if (updates.length > 10) {
      console.log(`    ... and ${updates.length - 10} more`);
    }
  } else {
    console.log('\n  Applying reverts...\n');
    
    let applied = 0;
    for (const update of updates) {
      try {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb,
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(update.revertedWheels), update.id]);
        applied++;
        
        if (applied % 100 === 0) {
          console.log(`  Applied ${applied}/${updates.length} reverts...`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to revert ${update.vehicle}: ${err.message}`);
      }
    }
    
    console.log(`\n  ✅ Applied ${applied} reverts successfully!`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await pool.end();
}

revertTruckAxleMarkers().catch(err => {
  console.error('Revert failed:', err);
  process.exit(1);
});
