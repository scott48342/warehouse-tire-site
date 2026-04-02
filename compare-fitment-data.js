const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const prismaUrl = process.env.POSTGRES_URL;
const railwayUrl = process.env.DATABASE_URL;

async function main() {
  const prisma = new Pool({ connectionString: prismaUrl, ssl: { rejectUnauthorized: false } });
  const railway = new Pool({ connectionString: railwayUrl, ssl: false });

  console.log('='.repeat(80));
  console.log('STEP 1: DATA COMPARISON - Railway vs Prisma');
  console.log('='.repeat(80));

  // Get all Railway vehicles with their fitment data
  const railwayData = await railway.query(`
    SELECT 
      v.id as vehicle_id,
      v.year,
      LOWER(v.make) as make,
      LOWER(v.model) as model,
      v.trim,
      v.search_trim,
      vf.bolt_pattern,
      vf.center_bore,
      vf.thread_size,
      vf.fastener_type
    FROM vehicles v
    LEFT JOIN vehicle_fitment vf ON vf.vehicle_id = v.id
    ORDER BY v.year, v.make, v.model
  `);

  // Get all Railway wheel specs grouped by vehicle
  const railwayWheelSpecs = await railway.query(`
    SELECT 
      v.year,
      LOWER(v.make) as make,
      LOWER(v.model) as model,
      v.trim,
      vws.rim_diameter,
      vws.rim_width,
      vws.offset,
      vws.tire_size,
      vws.is_stock,
      vws.axle
    FROM vehicle_wheel_specs vws
    JOIN vehicles v ON v.id = vws.vehicle_id
    ORDER BY v.year, v.make, v.model
  `);

  // Get all Prisma fitments
  const prismaData = await prisma.query(`
    SELECT 
      year,
      make,
      model,
      display_trim,
      modification_id,
      bolt_pattern,
      center_bore_mm,
      thread_size,
      oem_wheel_sizes,
      oem_tire_sizes,
      source
    FROM vehicle_fitments
    ORDER BY year, make, model
  `);

  console.log(`\nRailway vehicles: ${railwayData.rows.length}`);
  console.log(`Railway wheel_specs: ${railwayWheelSpecs.rows.length}`);
  console.log(`Prisma vehicle_fitments: ${prismaData.rows.length}`);

  // Build lookup map for Prisma data (year-make-model)
  const prismaMap = new Map();
  for (const row of prismaData.rows) {
    const key = `${row.year}-${row.make}-${row.model}`;
    if (!prismaMap.has(key)) {
      prismaMap.set(key, []);
    }
    prismaMap.get(key).push(row);
  }

  // Check Railway vehicles against Prisma
  console.log('\n' + '='.repeat(80));
  console.log('VEHICLE COVERAGE ANALYSIS');
  console.log('='.repeat(80));

  const found = [];
  const missing = [];
  const partial = [];

  for (const rv of railwayData.rows) {
    const key = `${rv.year}-${rv.make}-${rv.model}`;
    const prismaRows = prismaMap.get(key);
    
    if (!prismaRows || prismaRows.length === 0) {
      missing.push(rv);
    } else {
      // Check if bolt pattern matches
      const hasMatchingBolt = prismaRows.some(p => 
        p.bolt_pattern === rv.bolt_pattern || !rv.bolt_pattern
      );
      if (hasMatchingBolt) {
        found.push({ railway: rv, prisma: prismaRows });
      } else {
        partial.push({ railway: rv, prisma: prismaRows });
      }
    }
  }

  console.log(`\n✓ FOUND in Prisma: ${found.length} vehicles`);
  console.log(`⚠ PARTIAL match: ${partial.length} vehicles`);
  console.log(`✗ MISSING from Prisma: ${missing.length} vehicles`);

  if (missing.length > 0) {
    console.log('\n--- MISSING VEHICLES (not in Prisma) ---');
    const grouped = {};
    for (const v of missing) {
      const mk = `${v.year} ${v.make} ${v.model}`;
      if (!grouped[mk]) grouped[mk] = [];
      grouped[mk].push(v.trim);
    }
    for (const [ymm, trims] of Object.entries(grouped).slice(0, 30)) {
      console.log(`  ${ymm}: ${trims.join(', ')}`);
    }
    if (Object.keys(grouped).length > 30) {
      console.log(`  ... and ${Object.keys(grouped).length - 30} more`);
    }
  }

  // Analyze wheel specs coverage
  console.log('\n' + '='.repeat(80));
  console.log('WHEEL SPECS COVERAGE ANALYSIS');
  console.log('='.repeat(80));

  const wheelSpecsInPrisma = [];
  const wheelSpecsMissing = [];

  for (const ws of railwayWheelSpecs.rows) {
    const key = `${ws.year}-${ws.make}-${ws.model}`;
    const prismaRows = prismaMap.get(key);
    
    if (!prismaRows || prismaRows.length === 0) {
      wheelSpecsMissing.push(ws);
    } else {
      // Check if this wheel size exists in Prisma's oem_wheel_sizes
      const wheelSize = `${ws.rim_width}x${ws.rim_diameter}`;
      const wheelSizeAlt = `${ws.rim_diameter}x${ws.rim_width}`;
      
      let foundInPrisma = false;
      for (const p of prismaRows) {
        const oemSizes = p.oem_wheel_sizes || [];
        for (const os of oemSizes) {
          if (typeof os === 'string') {
            if (os.includes(String(ws.rim_diameter)) && os.includes(String(ws.rim_width))) {
              foundInPrisma = true;
              break;
            }
          } else if (os && typeof os === 'object') {
            if (os.diameter == ws.rim_diameter && os.width == ws.rim_width) {
              foundInPrisma = true;
              break;
            }
          }
        }
        if (foundInPrisma) break;
      }
      
      if (foundInPrisma) {
        wheelSpecsInPrisma.push(ws);
      } else {
        wheelSpecsMissing.push(ws);
      }
    }
  }

  console.log(`\n✓ Wheel specs already in Prisma: ${wheelSpecsInPrisma.length}`);
  console.log(`✗ Wheel specs MISSING from Prisma: ${wheelSpecsMissing.length}`);

  if (wheelSpecsMissing.length > 0) {
    console.log('\n--- MISSING WHEEL SPECS (sample) ---');
    const grouped = {};
    for (const ws of wheelSpecsMissing) {
      const mk = `${ws.year} ${ws.make} ${ws.model}`;
      if (!grouped[mk]) grouped[mk] = new Set();
      grouped[mk].add(`${ws.rim_width}x${ws.rim_diameter}`);
    }
    let count = 0;
    for (const [ymm, sizes] of Object.entries(grouped)) {
      if (count++ > 20) break;
      console.log(`  ${ymm}: ${[...sizes].join(', ')}`);
    }
    if (Object.keys(grouped).length > 20) {
      console.log(`  ... and ${Object.keys(grouped).length - 20} more vehicles`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
Railway has:
  - ${railwayData.rows.length} vehicles
  - ${railwayWheelSpecs.rows.length} wheel spec records

Of these:
  A. DUPLICATE (already in Prisma): ${found.length} vehicles, ${wheelSpecsInPrisma.length} wheel specs
  B. PARTIAL (vehicle exists, data differs): ${partial.length} vehicles
  C. MISSING (not in Prisma): ${missing.length} vehicles, ${wheelSpecsMissing.length} wheel specs

Critical missing data: ${missing.length + wheelSpecsMissing.length} records need migration
`);

  await prisma.end();
  await railway.end();
}

main().catch(e => console.error(e));
