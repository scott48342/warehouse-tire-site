/**
 * Merge missing wheel specs into EXISTING Prisma vehicles
 * 
 * This script:
 * 1. Finds wheel specs from Railway that belong to existing Prisma vehicles
 * 2. Adds them to oem_wheel_sizes without duplicating
 * 3. Preserves existing data
 * 
 * Run with: node merge-wheel-specs.js [--dry-run]
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`WHEEL SPECS MERGE: Railway → Prisma`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  // Get all Prisma vehicles
  console.log('📊 Loading Prisma vehicles...');
  const prismaRes = await prisma.query(`
    SELECT id, year, make, model, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
  `);
  
  // Build lookup by year-make-model
  const prismaByYMM = new Map();
  for (const row of prismaRes.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaByYMM.has(key)) prismaByYMM.set(key, []);
    prismaByYMM.get(key).push(row);
  }
  console.log(`   Loaded ${prismaRes.rows.length} Prisma records\n`);

  // Get Railway wheel specs with vehicle info
  console.log('📊 Loading Railway wheel specs...');
  const railwayRes = await railway.query(`
    SELECT 
      v.year, LOWER(v.make) as make, LOWER(v.model) as model,
      ws.rim_diameter, ws.rim_width, ws.offset, ws.tire_size, ws.is_stock, ws.axle
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
  `);
  console.log(`   Loaded ${railwayRes.rows.length} Railway wheel specs\n`);

  // Group Railway specs by year-make-model
  const railwayByYMM = new Map();
  for (const ws of railwayRes.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    if (!railwayByYMM.has(key)) railwayByYMM.set(key, []);
    railwayByYMM.get(key).push(ws);
  }

  // Find vehicles that need merging
  console.log('🔍 Analyzing merge candidates...\n');
  const updates = [];

  for (const [ymm, prismaRows] of prismaByYMM) {
    const railwaySpecs = railwayByYMM.get(ymm);
    if (!railwaySpecs || railwaySpecs.length === 0) continue;

    for (const prismaRow of prismaRows) {
      const existingWheels = prismaRow.oem_wheel_sizes || [];
      const existingTires = prismaRow.oem_tire_sizes || [];
      
      // Find wheel specs not already in Prisma
      const newWheels = [];
      const newTires = new Set();

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
        for (const ew of existingWheels) {
          if (typeof ew === 'string') {
            if (ew.includes(String(wheelObj.diameter)) && 
                ew.includes(String(wheelObj.width))) {
              found = true;
              break;
            }
          } else if (ew && typeof ew === 'object') {
            if (ew.diameter === wheelObj.diameter && ew.width === wheelObj.width) {
              found = true;
              break;
            }
          }
        }

        if (!found) {
          // Check not already in newWheels
          const alreadyAdded = newWheels.some(
            nw => nw.diameter === wheelObj.diameter && nw.width === wheelObj.width
          );
          if (!alreadyAdded) {
            newWheels.push(wheelObj);
          }
        }

        // Collect tire sizes
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
          existingWheels,
          newWheels,
          existingTires,
          newTires: [...newTires]
        });
      }
    }
  }

  console.log(`Found ${updates.length} Prisma records that need updates\n`);

  if (updates.length === 0) {
    console.log('✅ No updates needed!');
    await prisma.end();
    await railway.end();
    return;
  }

  // Show sample
  console.log('📋 Sample updates:');
  for (const u of updates.slice(0, 5)) {
    console.log(`   ${u.year} ${u.make} ${u.model}:`);
    console.log(`      +${u.newWheels.length} wheel sizes, +${u.newTires.length} tire sizes`);
  }
  console.log('');

  // Stats
  const totalNewWheels = updates.reduce((sum, u) => sum + u.newWheels.length, 0);
  const totalNewTires = updates.reduce((sum, u) => sum + u.newTires.length, 0);
  console.log(`Total: +${totalNewWheels} wheel sizes, +${totalNewTires} tire sizes\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes made');
  } else {
    console.log('⚡ Applying updates...');
    let updated = 0;
    let errors = 0;

    for (const u of updates) {
      try {
        // Merge wheel sizes - convert existing strings to objects if needed
        const mergedWheels = [];
        for (const ew of u.existingWheels) {
          if (typeof ew === 'string') {
            // Parse "16x7" format
            const match = ew.match(/(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)/);
            if (match) {
              mergedWheels.push({
                diameter: parseFloat(match[1]),
                width: parseFloat(match[2]),
                axle: 'both',
                isStock: true
              });
            }
          } else {
            mergedWheels.push(ew);
          }
        }
        mergedWheels.push(...u.newWheels);

        // Merge tire sizes
        const mergedTires = [...new Set([...u.existingTires, ...u.newTires])];

        await prisma.query(`
          UPDATE vehicle_fitments 
          SET 
            oem_wheel_sizes = $1::jsonb,
            oem_tire_sizes = $2::jsonb,
            updated_at = NOW()
          WHERE id = $3
        `, [
          JSON.stringify(mergedWheels),
          JSON.stringify(mergedTires),
          u.id
        ]);

        updated++;
        if (updated % 50 === 0) {
          process.stdout.write(`   Updated ${updated}/${updates.length}\r`);
        }
      } catch (e) {
        errors++;
        console.error(`   ❌ Error updating ${u.id}: ${e.message}`);
      }
    }

    console.log(`\n\n✅ Updated ${updated} records (${errors} errors)`);
  }

  // Validation
  console.log('\n📊 Validation:');
  const countRes = await prisma.query(`
    SELECT 
      COUNT(*) as total,
      AVG(jsonb_array_length(oem_wheel_sizes)) as avg_wheels
    FROM vehicle_fitments
  `);
  console.log(`   Total records: ${countRes.rows[0].total}`);
  console.log(`   Avg wheel sizes per record: ${parseFloat(countRes.rows[0].avg_wheels).toFixed(1)}`);

  await prisma.end();
  await railway.end();
  
  console.log('\n✅ Merge complete!\n');
}

main().catch(e => {
  console.error('❌ Merge failed:', e);
  process.exit(1);
});
