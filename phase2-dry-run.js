/**
 * Phase 2 Dry Run - Detailed Sample Validation
 * Shows exactly what would change before running the actual merge
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  console.log('='.repeat(80));
  console.log('PHASE 2 DRY RUN - WHEEL SPEC MERGE PREVIEW');
  console.log('='.repeat(80));

  // Get all Prisma vehicles
  const prismaRes = await prisma.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE source != 'railway_import'  -- Only existing records, not Phase 1 imports
  `);
  
  // Build lookup by year-make-model
  const prismaByYMM = new Map();
  for (const row of prismaRes.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaByYMM.has(key)) prismaByYMM.set(key, []);
    prismaByYMM.get(key).push(row);
  }

  // Get Railway wheel specs with vehicle info
  const railwayRes = await railway.query(`
    SELECT 
      v.year, LOWER(v.make) as make, LOWER(v.model) as model, v.trim,
      ws.rim_diameter, ws.rim_width, ws.offset, ws.tire_size, ws.is_stock, ws.axle
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
  `);

  // Group Railway specs by year-make-model
  const railwayByYMM = new Map();
  for (const ws of railwayRes.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    if (!railwayByYMM.has(key)) railwayByYMM.set(key, []);
    railwayByYMM.get(key).push(ws);
  }

  // Analyze merge candidates
  const updates = [];
  const conflicts = [];

  for (const [ymm, prismaRows] of prismaByYMM) {
    const railwaySpecs = railwayByYMM.get(ymm);
    if (!railwaySpecs || railwaySpecs.length === 0) continue;

    for (const prismaRow of prismaRows) {
      const existingWheels = prismaRow.oem_wheel_sizes || [];
      const existingTires = prismaRow.oem_tire_sizes || [];
      
      const newWheels = [];
      const newTires = new Set();
      const conflictDetails = [];

      for (const rw of railwaySpecs) {
        const wheelObj = {
          diameter: parseFloat(rw.rim_diameter),
          width: parseFloat(rw.rim_width),
          offset: rw.offset ? parseFloat(rw.offset) : null,
          axle: rw.axle || 'both',
          isStock: rw.is_stock !== false
        };

        // Check if this wheel already exists
        let found = false;
        let existingMatch = null;
        
        for (const ew of existingWheels) {
          let ewDia, ewWidth, ewOffset;
          if (typeof ew === 'string') {
            const match = ew.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
            if (match) {
              ewWidth = parseFloat(match[1]);
              ewDia = parseFloat(match[2]);
            }
          } else if (ew && typeof ew === 'object') {
            ewDia = ew.diameter;
            ewWidth = ew.width;
            ewOffset = ew.offset;
          }
          
          if (ewDia === wheelObj.diameter && ewWidth === wheelObj.width) {
            found = true;
            existingMatch = ew;
            
            // Check for conflict: same wheel size but different offset
            if (ewOffset != null && wheelObj.offset != null && ewOffset !== wheelObj.offset) {
              conflictDetails.push({
                type: 'offset_mismatch',
                wheel: `${wheelObj.width}x${wheelObj.diameter}`,
                existing: ewOffset,
                railway: wheelObj.offset
              });
            }
            break;
          }
        }

        if (!found) {
          const alreadyAdded = newWheels.some(
            nw => nw.diameter === wheelObj.diameter && nw.width === wheelObj.width
          );
          if (!alreadyAdded) {
            newWheels.push(wheelObj);
          }
        }

        if (rw.tire_size && !existingTires.includes(rw.tire_size)) {
          newTires.add(rw.tire_size);
        }
      }

      if (newWheels.length > 0 || newTires.size > 0) {
        updates.push({
          id: prismaRow.id,
          year: prismaRow.year,
          make: prismaRow.make,
          model: prismaRow.model,
          trim: prismaRow.display_trim,
          existingWheels,
          newWheels,
          existingTires,
          newTires: [...newTires],
          conflicts: conflictDetails
        });

        if (conflictDetails.length > 0) {
          conflicts.push({
            vehicle: `${prismaRow.year} ${prismaRow.make} ${prismaRow.model} ${prismaRow.display_trim}`,
            details: conflictDetails
          });
        }
      }
    }
  }

  // Display results
  console.log(`\nTotal records to update: ${updates.length}`);
  console.log(`Records with conflicts: ${conflicts.length}`);

  // Show 20 sample updates
  console.log('\n' + '='.repeat(80));
  console.log('20 SAMPLE RECORDS - BEFORE/AFTER PREVIEW');
  console.log('='.repeat(80));

  const samples = updates.slice(0, 20);
  for (let i = 0; i < samples.length; i++) {
    const u = samples[i];
    console.log(`\n--- ${i + 1}. ${u.year} ${u.make} ${u.model} - ${u.trim} ---`);
    
    // Format existing wheels
    const existingWheelStr = u.existingWheels.map(w => {
      if (typeof w === 'string') return w;
      return `${w.width}x${w.diameter}`;
    }).join(', ') || '(none)';
    
    const newWheelStr = u.newWheels.map(w => `${w.width}x${w.diameter}`).join(', ') || '(none)';
    
    console.log(`\n  OEM_WHEEL_SIZES:`);
    console.log(`    BEFORE: [${existingWheelStr}] (${u.existingWheels.length} sizes)`);
    console.log(`    ADDING: [${newWheelStr}] (+${u.newWheels.length} sizes)`);
    console.log(`    AFTER:  ${u.existingWheels.length + u.newWheels.length} total sizes`);
    
    console.log(`\n  OEM_TIRE_SIZES:`);
    console.log(`    BEFORE: [${u.existingTires.slice(0, 5).join(', ')}${u.existingTires.length > 5 ? '...' : ''}] (${u.existingTires.length} sizes)`);
    console.log(`    ADDING: [${u.newTires.slice(0, 5).join(', ')}${u.newTires.length > 5 ? '...' : ''}] (+${u.newTires.length} sizes)`);
    console.log(`    AFTER:  ${u.existingTires.length + u.newTires.length} total sizes`);

    if (u.conflicts.length > 0) {
      console.log(`\n  ⚠️ CONFLICTS:`);
      for (const c of u.conflicts) {
        console.log(`    ${c.type}: ${c.wheel} - existing: ${c.existing}, railway: ${c.railway}`);
      }
    }
  }

  // Conflict summary
  if (conflicts.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️ CONFLICT SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nFound ${conflicts.length} records with data conflicts:\n`);
    for (const c of conflicts.slice(0, 10)) {
      console.log(`  ${c.vehicle}:`);
      for (const d of c.details) {
        console.log(`    - ${d.type}: ${d.wheel} (existing: ${d.existing}, railway: ${d.railway})`);
      }
    }
    if (conflicts.length > 10) {
      console.log(`  ... and ${conflicts.length - 10} more`);
    }
    console.log('\n  NOTE: Conflicts are logged but NOT blocking. Merge will ADD data, not overwrite.');
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('✅ NO CONFLICTS DETECTED');
    console.log('='.repeat(80));
    console.log('All Railway data is purely additive - no existing values will be changed.');
  }

  // Final stats
  const totalNewWheels = updates.reduce((sum, u) => sum + u.newWheels.length, 0);
  const totalNewTires = updates.reduce((sum, u) => sum + u.newTires.length, 0);

  console.log('\n' + '='.repeat(80));
  console.log('PHASE 2 DRY RUN SUMMARY');
  console.log('='.repeat(80));
  console.log(`
  Records to update:     ${updates.length}
  Wheel sizes to add:    +${totalNewWheels}
  Tire sizes to add:     +${totalNewTires}
  Conflicts detected:    ${conflicts.length} (will log, not block)
  
  Operation type: ADDITIVE ONLY
  - Existing oem_wheel_sizes: PRESERVED
  - Existing oem_tire_sizes: PRESERVED
  - New sizes: APPENDED to arrays
  `);

  await prisma.end();
  await railway.end();
}

main().catch(e => console.error('Error:', e));
