/**
 * Analyze which wheel specs need to be MERGED into existing Prisma records
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  console.log('Analyzing wheel specs that belong to EXISTING Prisma vehicles...\n');

  // Get existing Prisma vehicles with their wheel sizes
  const prismaRes = await prisma.query(`
    SELECT year, make, model, modification_id, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
  `);

  // Build lookup
  const prismaMap = new Map();
  for (const row of prismaRes.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaMap.has(key)) prismaMap.set(key, []);
    prismaMap.get(key).push(row);
  }

  // Get Railway wheel specs with vehicle info
  const railwayRes = await railway.query(`
    SELECT 
      v.year, LOWER(v.make) as make, LOWER(v.model) as model, v.trim,
      ws.rim_diameter, ws.rim_width, ws.offset, ws.tire_size, ws.axle
    FROM vehicle_wheel_specs ws
    JOIN vehicles v ON v.id = ws.vehicle_id
  `);

  let existsInPrisma = 0;
  let vehicleExistsButWheelMissing = 0;
  let vehicleMissing = 0;
  
  const mergeCandidates = [];

  for (const ws of railwayRes.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    const prismaRows = prismaMap.get(key);
    
    if (!prismaRows || prismaRows.length === 0) {
      // Vehicle doesn't exist in Prisma - will be handled by main migration
      vehicleMissing++;
      continue;
    }

    // Vehicle exists - check if this wheel size is already there
    const wheelSize = { d: parseFloat(ws.rim_diameter), w: parseFloat(ws.rim_width) };
    let found = false;
    
    for (const pr of prismaRows) {
      const oemSizes = pr.oem_wheel_sizes || [];
      for (const os of oemSizes) {
        if (typeof os === 'string') {
          if (os.includes(String(wheelSize.d)) && os.includes(String(wheelSize.w))) {
            found = true;
            break;
          }
        } else if (os && typeof os === 'object') {
          if (os.diameter == wheelSize.d && os.width == wheelSize.w) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    
    if (found) {
      existsInPrisma++;
    } else {
      vehicleExistsButWheelMissing++;
      mergeCandidates.push({
        year: ws.year,
        make: ws.make,
        model: ws.model,
        trim: ws.trim,
        wheel: `${ws.rim_width}x${ws.rim_diameter}`,
        tire: ws.tire_size,
        axle: ws.axle
      });
    }
  }

  console.log('WHEEL SPEC ANALYSIS:');
  console.log('='.repeat(50));
  console.log(`Total Railway wheel specs: ${railwayRes.rows.length}`);
  console.log(`  ✓ Already in Prisma:           ${existsInPrisma}`);
  console.log(`  ⚠ Vehicle exists, wheel missing: ${vehicleExistsButWheelMissing}`);
  console.log(`  ✗ Vehicle missing entirely:     ${vehicleMissing}`);
  console.log('');

  if (vehicleExistsButWheelMissing > 0) {
    // Group by vehicle
    const grouped = {};
    for (const mc of mergeCandidates) {
      const key = `${mc.year} ${mc.make} ${mc.model}`;
      if (!grouped[key]) grouped[key] = new Set();
      grouped[key].add(mc.wheel);
    }

    console.log(`Vehicles that need wheel spec MERGE (${Object.keys(grouped).length} vehicles):`);
    let count = 0;
    for (const [ymm, wheels] of Object.entries(grouped).sort()) {
      if (count++ > 25) {
        console.log(`  ... and ${Object.keys(grouped).length - 25} more`);
        break;
      }
      console.log(`  ${ymm}: +${[...wheels].join(', ')}`);
    }
  }

  await prisma.end();
  await railway.end();
}

main().catch(console.error);
