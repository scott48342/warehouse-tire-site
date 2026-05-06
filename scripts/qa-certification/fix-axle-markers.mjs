/**
 * Fix Missing Axle Markers for Staggered Vehicles
 * 
 * Updates oem_wheel_sizes to add front/rear axle markers based on width:
 * - Narrower width = front
 * - Wider width = rear
 * 
 * Standard staggered pattern for performance vehicles.
 */

import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Staggered-capable makes to fix
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
  'Ford',      // Mustang
  'Chevrolet', // Corvette, Camaro
  'Dodge',     // Challenger, Charger
];

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

async function fixAxleMarkers() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FIX AXLE MARKERS FOR STAGGERED VEHICLES');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Find records that need fixing - fetch all, filter in JS to avoid JSONB issues
  const { rows: allRows } = await pool.query(`
    SELECT id, year, make, model, modification_id, display_trim, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE make = ANY($1)
    AND certification_status = 'certified'
  `, [STAGGERED_MAKES]);
  
  // Filter to only records with valid wheel arrays
  const rows = allRows.filter(r => {
    const wheels = r.oem_wheel_sizes;
    return Array.isArray(wheels) && wheels.length >= 2;
  });

  console.log(`Found ${rows.length} records to analyze...\n`);

  let fixed = 0;
  let skipped = 0;
  let alreadyCorrect = 0;
  const updates = [];

  for (const row of rows) {
    const wheels = row.oem_wheel_sizes || [];
    
    // Check if already has front/rear markers
    const hasFront = wheels.some(w => w?.axle === 'front');
    const hasRear = wheels.some(w => w?.axle === 'rear');
    
    if (hasFront && hasRear) {
      alreadyCorrect++;
      continue;
    }
    
    // Get unique widths
    const widths = [...new Set(wheels.map(w => w?.width).filter(Boolean))].sort((a, b) => a - b);
    
    if (widths.length < 2) {
      skipped++;
      continue; // Not staggered
    }
    
    const widthDelta = widths[widths.length - 1] - widths[0];
    if (widthDelta < 0.5) {
      skipped++;
      continue; // Width difference too small
    }
    
    // Assign axle markers: narrower = front, wider = rear
    const minWidth = widths[0];
    const maxWidth = widths[widths.length - 1];
    
    const updatedWheels = wheels.map(w => {
      if (!w?.width) return w;
      
      // Already has axle marker - keep it
      if (w.axle === 'front' || w.axle === 'rear') return w;
      
      // Assign based on width
      let newAxle = 'both';
      if (w.width === minWidth) {
        newAxle = 'front';
      } else if (w.width === maxWidth) {
        newAxle = 'rear';
      } else {
        // Middle width - could be either, default to both
        newAxle = 'both';
      }
      
      return { ...w, axle: newAxle };
    });
    
    // Verify we now have both front and rear
    const nowHasFront = updatedWheels.some(w => w?.axle === 'front');
    const nowHasRear = updatedWheels.some(w => w?.axle === 'rear');
    
    if (!nowHasFront || !nowHasRear) {
      if (VERBOSE) {
        console.log(`  ⚠️ Could not determine front/rear for ${row.year} ${row.make} ${row.model} ${row.display_trim}`);
        console.log(`     Widths: ${widths.join(', ')}`);
      }
      skipped++;
      continue;
    }
    
    updates.push({
      id: row.id,
      vehicle: `${row.year} ${row.make} ${row.model} ${row.display_trim}`,
      widths,
      updatedWheels,
    });
    
    if (VERBOSE) {
      console.log(`  ✅ ${row.year} ${row.make} ${row.model} ${row.display_trim}`);
      console.log(`     Widths: ${minWidth}" (front) / ${maxWidth}" (rear)`);
    }
    
    fixed++;
  }

  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────\n');
  
  console.log(`  Already correct:   ${alreadyCorrect}`);
  console.log(`  Needs fixing:      ${fixed}`);
  console.log(`  Skipped:           ${skipped}`);
  console.log(`  Total analyzed:    ${rows.length}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No changes made. Run without --dry-run to apply.\n');
    
    // Show sample updates
    console.log('  Sample updates that would be applied:');
    for (const update of updates.slice(0, 5)) {
      console.log(`    - ${update.vehicle}: ${update.widths[0]}" front / ${update.widths[update.widths.length - 1]}" rear`);
    }
    if (updates.length > 5) {
      console.log(`    ... and ${updates.length - 5} more`);
    }
  } else {
    console.log('\n  Applying updates...\n');
    
    let applied = 0;
    for (const update of updates) {
      try {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_wheel_sizes = $1::jsonb,
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(update.updatedWheels), update.id]);
        applied++;
        
        if (applied % 50 === 0) {
          console.log(`  Applied ${applied}/${updates.length} updates...`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to update ${update.vehicle}: ${err.message}`);
      }
    }
    
    console.log(`\n  ✅ Applied ${applied} updates successfully!`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await pool.end();
}

fixAxleMarkers().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
