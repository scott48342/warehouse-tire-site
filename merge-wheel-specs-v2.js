/**
 * Merge missing wheel specs into EXISTING Prisma vehicles (v2 - Fixed duplicate detection)
 * 
 * This script:
 * 1. Finds wheel specs from Railway that belong to existing Prisma vehicles
 * 2. Adds them to oem_wheel_sizes without duplicating
 * 3. Preserves existing data
 * 4. Handles string format "8.5Jx18" and object format correctly
 * 
 * Run with: node merge-wheel-specs-v2.js [--dry-run]
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

// Parse wheel size from various formats
function parseWheelSize(ws) {
  if (typeof ws === 'string') {
    // Handle "8.5Jx18", "8.5x18", "18x8.5", etc.
    const match = ws.match(/(\d+(?:\.\d+)?)[Jj]?[xX](\d+(?:\.\d+)?)/);
    if (match) {
      const a = parseFloat(match[1]);
      const b = parseFloat(match[2]);
      // Determine which is width and which is diameter (diameter is usually larger)
      if (b >= 14 && b <= 30) {
        return { width: a, diameter: b };
      } else if (a >= 14 && a <= 30) {
        return { width: b, diameter: a };
      }
      // Default: first is width, second is diameter
      return { width: a, diameter: b };
    }
    return null;
  } else if (ws && typeof ws === 'object') {
    return { 
      width: parseFloat(ws.width), 
      diameter: parseFloat(ws.diameter) 
    };
  }
  return null;
}

// Compare two wheel sizes for equality
function wheelSizesEqual(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.width - b.width) < 0.1 && Math.abs(a.diameter - b.diameter) < 0.1;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`WHEEL SPECS MERGE v2: Railway → Prisma`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  // Get all Prisma vehicles (exclude Phase 1 imports - they already have Railway data)
  console.log('📊 Loading Prisma vehicles (excluding Phase 1 imports)...');
  const prismaRes = await prisma.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE source != 'railway_import'
  `);
  
  const prismaByYMM = new Map();
  for (const row of prismaRes.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaByYMM.has(key)) prismaByYMM.set(key, []);
    prismaByYMM.get(key).push(row);
  }
  console.log(`   Loaded ${prismaRes.rows.length} existing Prisma records\n`);

  // Get Railway wheel specs
  console.log('📊 Loading Railway wheel specs...');
  const railwayRes = await railway.query(`
    SELECT 
      v.year, LOWER(v.make) as make, LOWER(v.model) as model,
      ws.rim_diameter, ws.rim_width, ws.offset, ws.tire_size, ws.is_stock, ws.axle
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
  `);
  console.log(`   Loaded ${railwayRes.rows.length} Railway wheel specs\n`);

  const railwayByYMM = new Map();
  for (const ws of railwayRes.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    if (!railwayByYMM.has(key)) railwayByYMM.set(key, []);
    railwayByYMM.get(key).push(ws);
  }

  // Analyze merge candidates
  console.log('🔍 Analyzing merge candidates with improved duplicate detection...\n');
  const updates = [];
  const conflicts = [];
  let skippedDuplicates = 0;

  for (const [ymm, prismaRows] of prismaByYMM) {
    const railwaySpecs = railwayByYMM.get(ymm);
    if (!railwaySpecs || railwaySpecs.length === 0) continue;

    for (const prismaRow of prismaRows) {
      const existingWheels = prismaRow.oem_wheel_sizes || [];
      const existingTires = prismaRow.oem_tire_sizes || [];
      
      // Parse existing wheel sizes
      const parsedExisting = existingWheels.map(parseWheelSize).filter(Boolean);
      
      const newWheels = [];
      const newTires = new Set();
      const recordConflicts = [];

      for (const rw of railwaySpecs) {
        const railwayWheel = {
          diameter: parseFloat(rw.rim_diameter),
          width: parseFloat(rw.rim_width),
          offset: rw.offset ? parseFloat(rw.offset) : null,
          axle: rw.axle || 'both',
          isStock: rw.is_stock !== false
        };

        // Check if this wheel already exists using improved comparison
        let found = false;
        for (const existing of parsedExisting) {
          if (wheelSizesEqual(existing, railwayWheel)) {
            found = true;
            skippedDuplicates++;
            break;
          }
        }

        // Also check newWheels to avoid adding the same size twice
        if (!found) {
          const alreadyAdding = newWheels.some(nw => 
            wheelSizesEqual({ width: nw.width, diameter: nw.diameter }, railwayWheel)
          );
          if (!alreadyAdding) {
            newWheels.push(railwayWheel);
          } else {
            skippedDuplicates++;
          }
        }

        // Collect new tire sizes
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
          newTires: [...newTires]
        });
      }
    }
  }

  const totalNewWheels = updates.reduce((sum, u) => sum + u.newWheels.length, 0);
  const totalNewTires = updates.reduce((sum, u) => sum + u.newTires.length, 0);

  console.log(`Records to update: ${updates.length}`);
  console.log(`Wheel sizes to add: +${totalNewWheels}`);
  console.log(`Tire sizes to add: +${totalNewTires}`);
  console.log(`Duplicates skipped: ${skippedDuplicates}`);

  // Show sample
  console.log('\n📋 Sample updates (first 10):');
  for (const u of updates.slice(0, 10)) {
    console.log(`  ${u.year} ${u.make} ${u.model} - ${u.trim}:`);
    console.log(`    +${u.newWheels.length} wheels, +${u.newTires.length} tires`);
    if (u.newWheels.length > 0) {
      console.log(`    New wheels: ${u.newWheels.map(w => `${w.width}x${w.diameter}`).join(', ')}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - No changes made');
    console.log(`   Would update ${updates.length} records`);
    console.log(`   Would add ${totalNewWheels} wheel sizes`);
    console.log(`   Would add ${totalNewTires} tire sizes`);
  } else {
    console.log('\n⚡ Applying updates...');
    let updated = 0;
    let errors = 0;

    for (const u of updates) {
      try {
        // Merge wheel sizes - keep existing, add new
        const mergedWheels = [...u.existingWheels, ...u.newWheels];
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
        if (updated % 100 === 0) {
          process.stdout.write(`   Updated ${updated}/${updates.length}\r`);
        }
      } catch (e) {
        errors++;
        console.error(`   ❌ Error updating ${u.id}: ${e.message}`);
      }
    }

    console.log(`\n\n✅ Updated ${updated} records (${errors} errors)`);
  }

  // Validation stats
  console.log('\n📊 Validation:');
  const countRes = await prisma.query(`
    SELECT 
      COUNT(*) as total,
      AVG(jsonb_array_length(oem_wheel_sizes)) as avg_wheels,
      AVG(jsonb_array_length(oem_tire_sizes)) as avg_tires
    FROM vehicle_fitments
  `);
  console.log(`   Total records: ${countRes.rows[0].total}`);
  console.log(`   Avg wheel sizes per record: ${parseFloat(countRes.rows[0].avg_wheels).toFixed(2)}`);
  console.log(`   Avg tire sizes per record: ${parseFloat(countRes.rows[0].avg_tires).toFixed(2)}`);

  await prisma.end();
  await railway.end();
  
  console.log('\n✅ Complete!\n');
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
