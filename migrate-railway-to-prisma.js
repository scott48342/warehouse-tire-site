/**
 * Railway → Prisma Fitment Data Migration
 * 
 * This script:
 * 1. Identifies missing vehicles from Railway
 * 2. Transforms data to Prisma schema
 * 3. Imports safely (no overwrites)
 * 4. Validates results
 * 
 * Run with: node migrate-railway-to-prisma.js [--dry-run]
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function uuidv4() {
  return crypto.randomUUID();
}

const DRY_RUN = process.argv.includes('--dry-run');

const prismaUrl = process.env.POSTGRES_URL;
const railwayUrl = process.env.DATABASE_URL;

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FITMENT DATA MIGRATION: Railway → Prisma`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (will insert data)'}`);
  console.log(`${'='.repeat(60)}\n`);

  const prisma = new Pool({ connectionString: prismaUrl, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: railwayUrl, ssl: false });

  // Step 1: Get existing Prisma vehicles for deduplication
  console.log('📊 Loading existing Prisma data...');
  const existingRes = await prisma.query(`
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments
  `);
  const existingSet = new Set(
    existingRes.rows.map(r => `${r.year}-${r.make}-${r.model}`)
  );
  console.log(`   Found ${existingSet.size} unique year/make/model combinations in Prisma\n`);

  // Step 2: Get Railway vehicles with all related data
  console.log('📊 Loading Railway data...');
  const railwayVehicles = await railway.query(`
    SELECT 
      v.id,
      v.year,
      v.make,
      v.model,
      v.trim,
      v.search_trim,
      v.imported_from,
      vf.bolt_pattern,
      vf.center_bore,
      vf.thread_size,
      vf.fastener_type,
      vf.torque_nm
    FROM vehicles v
    LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
  `);

  const railwayWheelSpecs = await railway.query(`
    SELECT 
      vehicle_id,
      rim_diameter,
      rim_width,
      "offset",
      tire_size,
      is_stock,
      axle
    FROM vehicle_wheel_specs
  `);

  // Group wheel specs by vehicle_id
  const wheelSpecsByVehicle = new Map();
  for (const ws of railwayWheelSpecs.rows) {
    if (!wheelSpecsByVehicle.has(ws.vehicle_id)) {
      wheelSpecsByVehicle.set(ws.vehicle_id, []);
    }
    wheelSpecsByVehicle.get(ws.vehicle_id).push(ws);
  }

  console.log(`   Found ${railwayVehicles.rows.length} vehicles`);
  console.log(`   Found ${railwayWheelSpecs.rows.length} wheel specs\n`);

  // Step 3: Identify missing vehicles
  console.log('🔍 Identifying missing vehicles...');
  const missingVehicles = railwayVehicles.rows.filter(v => {
    const key = `${v.year}-${v.make.toLowerCase()}-${v.model.toLowerCase()}`;
    return !existingSet.has(key);
  });
  console.log(`   ${missingVehicles.length} vehicles need to be imported\n`);

  if (missingVehicles.length === 0) {
    console.log('✅ No missing vehicles to import!');
    await prisma.end();
    await railway.end();
    return;
  }

  // Step 4: Transform to Prisma format
  console.log('🔄 Transforming data...');
  const recordsToInsert = [];

  for (const v of missingVehicles) {
    const wheelSpecs = wheelSpecsByVehicle.get(v.id) || [];
    
    // Build oem_wheel_sizes JSONB array
    const oemWheelSizes = wheelSpecs.map(ws => ({
      diameter: parseFloat(ws.rim_diameter),
      width: parseFloat(ws.rim_width),
      offset: ws.offset ? parseFloat(ws.offset) : null,
      axle: ws.axle || 'both',
      isStock: ws.is_stock !== false
    }));

    // Build oem_tire_sizes JSONB array (unique tire sizes)
    const tireSizes = [...new Set(
      wheelSpecs
        .filter(ws => ws.tire_size)
        .map(ws => ws.tire_size)
    )];

    // Calculate offset range
    const offsets = wheelSpecs
      .filter(ws => ws.offset != null)
      .map(ws => parseFloat(ws.offset));
    const offsetMin = offsets.length > 0 ? Math.min(...offsets) : null;
    const offsetMax = offsets.length > 0 ? Math.max(...offsets) : null;

    // Map fastener_type to seat_type
    let seatType = 'conical';
    if (v.fastener_type === 'Lug bolts') seatType = 'ball';
    else if (v.fastener_type === 'Lug nuts') seatType = 'conical';

    recordsToInsert.push({
      id: uuidv4(),
      year: v.year,
      make: v.make.toLowerCase(),
      model: v.model.toLowerCase(),
      modification_id: v.search_trim || `railway_${v.id}`,
      raw_trim: v.trim,
      display_trim: v.trim || 'Base',
      submodel: null,
      bolt_pattern: v.bolt_pattern || null,
      center_bore_mm: v.center_bore ? parseFloat(v.center_bore) : null,
      thread_size: v.thread_size || null,
      seat_type: seatType,
      offset_min_mm: offsetMin,
      offset_max_mm: offsetMax,
      oem_wheel_sizes: JSON.stringify(oemWheelSizes),
      oem_tire_sizes: JSON.stringify(tireSizes),
      source: 'railway_import',
      source_record_id: null
    });
  }

  console.log(`   Prepared ${recordsToInsert.length} records for insertion\n`);

  // Show sample
  console.log('📋 Sample records to insert:');
  for (const r of recordsToInsert.slice(0, 3)) {
    console.log(`   ${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
    console.log(`      Bolt: ${r.bolt_pattern}, Wheels: ${JSON.parse(r.oem_wheel_sizes).length}, Tires: ${JSON.parse(r.oem_tire_sizes).length}`);
  }
  console.log('');

  // Step 5: Insert (if not dry run)
  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes made');
    console.log(`   Would insert ${recordsToInsert.length} records`);
  } else {
    console.log('⚡ Inserting records into Prisma...');
    
    let inserted = 0;
    let errors = 0;

    for (const r of recordsToInsert) {
      try {
        await prisma.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, modification_id,
            raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm,
            oem_wheel_sizes, oem_tire_sizes,
            source, source_record_id,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14,
            $15::jsonb, $16::jsonb,
            $17, $18,
            NOW(), NOW()
          )
        `, [
          r.id, r.year, r.make, r.model, r.modification_id,
          r.raw_trim, r.display_trim, r.submodel,
          r.bolt_pattern, r.center_bore_mm, r.thread_size, r.seat_type,
          r.offset_min_mm, r.offset_max_mm,
          r.oem_wheel_sizes, r.oem_tire_sizes,
          r.source, r.source_record_id
        ]);
        inserted++;
        if (inserted % 50 === 0) {
          process.stdout.write(`   Inserted ${inserted}/${recordsToInsert.length}\r`);
        }
      } catch (e) {
        errors++;
        console.error(`   ❌ Error inserting ${r.year} ${r.make} ${r.model}: ${e.message}`);
      }
    }
    
    console.log(`\n\n✅ Inserted ${inserted} records (${errors} errors)`);
  }

  // Step 6: Validation
  console.log('\n📊 Validation:');
  const countRes = await prisma.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE source = 'railway_import') as imported
    FROM vehicle_fitments
  `);
  console.log(`   Total records: ${countRes.rows[0].total}`);
  console.log(`   Railway imports: ${countRes.rows[0].imported}`);

  await prisma.end();
  await railway.end();
  
  console.log('\n✅ Migration complete!\n');
}

main().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
