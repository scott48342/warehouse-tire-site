import postgres from 'postgres';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

async function trace() {
  console.log('=== TRACING: 2014 RAM Ram 1500 SLT ===\n');

  // 1. Check vehicle_fitments
  console.log('1. VEHICLE_FITMENTS TABLE:');
  const fitments = await sql`
    SELECT id, year, make, model, raw_trim, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year = 2014 AND LOWER(make) = 'ram' AND LOWER(model) LIKE '%1500%'
  `;
  console.log(`   Records found: ${fitments.length}`);
  fitments.forEach(f => {
    console.log(`   - ${f.year} ${f.make} ${f.model} | trim='${f.raw_trim || f.display_trim}' | bolt=${f.bolt_pattern} | oem_tires=${JSON.stringify(f.oem_tire_sizes)}`);
  });

  // 2. Check tgp_solutions 
  console.log('\n2. TGP_SOLUTIONS TABLE:');
  const tgp = await sql`
    SELECT year, make, model, trim, bolt_pattern, oem_tire_size_front, oem_tire_size_rear
    FROM tgp_solutions 
    WHERE year = 2014 AND LOWER(make) = 'ram' AND LOWER(model) LIKE '%1500%'
    LIMIT 15
  `;
  console.log(`   Records found: ${tgp.length}`);
  tgp.forEach(t => {
    console.log(`   - ${t.year} ${t.make} ${t.model} | trim='${t.trim}' | bolt=${t.bolt_pattern} | tires=${t.oem_tire_size_front}`);
  });

  // 3. Check ALL distinct model names for RAM in vehicle_fitments
  console.log('\n3. ALL RAM MODEL NAMES IN VEHICLE_FITMENTS:');
  const ramModels = await sql`
    SELECT DISTINCT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ram'
    GROUP BY model
    ORDER BY cnt DESC
  `;
  ramModels.forEach(m => console.log(`   - "${m.model}" (${m.cnt} records)`));

  // 4. Check ALL distinct model names for RAM in tgp_solutions
  console.log('\n4. ALL RAM MODEL NAMES IN TGP_SOLUTIONS:');
  const ramTgp = await sql`
    SELECT DISTINCT model, COUNT(*) as cnt 
    FROM tgp_solutions 
    WHERE LOWER(make) = 'ram'
    GROUP BY model
    ORDER BY cnt DESC
  `;
  ramTgp.forEach(m => console.log(`   - "${m.model}" (${m.cnt} records)`));

  // 5. Check if there's a mapping issue - query both ways
  console.log('\n5. EXACT MATCH TEST:');
  const exact1 = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year = 2014 AND make = 'RAM' AND model = 'Ram 1500'`;
  const exact2 = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year = 2014 AND make = 'RAM' AND model = '1500'`;
  const exact3 = await sql`SELECT COUNT(*) as cnt FROM tgp_solutions WHERE year = 2014 AND make = 'RAM' AND model = '1500'`;
  console.log(`   vehicle_fitments WHERE model='Ram 1500': ${exact1[0].cnt}`);
  console.log(`   vehicle_fitments WHERE model='1500': ${exact2[0].cnt}`);
  console.log(`   tgp_solutions WHERE model='1500': ${exact3[0].cnt}`);

  // 6. Sample what trims exist in tgp_solutions for 2014 RAM 1500
  console.log('\n6. TRIMS IN TGP_SOLUTIONS FOR 2014 RAM 1500:');
  const tgpTrims = await sql`
    SELECT DISTINCT trim FROM tgp_solutions 
    WHERE year = 2014 AND LOWER(make) = 'ram' AND model = '1500'
  `;
  console.log(`   Trims: ${tgpTrims.map(t => t.trim).join(', ')}`);

  await sql.end();
}

trace().catch(e => { console.error(e); process.exit(1); });
