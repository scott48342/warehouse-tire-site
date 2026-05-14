import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log("═══════════════════════════════════════════════════════════════");
console.log("          BMW M3/M4 'Base' RECORD AUDIT");
console.log("═══════════════════════════════════════════════════════════════\n");

// 1. Find all BMW M3/M4 records with "Base" in trim
console.log("1. ALL BMW M3/M4 RECORDS WITH 'Base' IN DISPLAY_TRIM\n");

const baseRecords = await sql`
  SELECT 
    id,
    year, 
    make, 
    model, 
    display_trim,
    modification_id,
    oem_tire_sizes,
    oem_wheel_sizes,
    bolt_pattern,
    center_bore_mm,
    source,
    certification_status,
    created_at::date as created_date
  FROM vehicle_fitments 
  WHERE make ILIKE 'BMW' 
    AND (model ILIKE 'M3' OR model ILIKE 'M4')
    AND display_trim ILIKE '%Base%'
  ORDER BY year DESC, model, display_trim
`;

console.log(`Found ${baseRecords.length} "Base" records:\n`);

for (const r of baseRecords) {
  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(`RECORD ID: ${r.id}`);
  console.log(`  Year/Make/Model: ${r.year} ${r.make} ${r.model}`);
  console.log(`  Display Trim: "${r.display_trim}"`);
  console.log(`  Modification ID: ${r.modification_id}`);
  console.log(`  Source: ${r.source}`);
  console.log(`  Certification: ${r.certification_status}`);
  console.log(`  Created: ${r.created_date}`);
  console.log(`  Tire Sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log(`  Wheel Sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
  console.log(`  Bolt Pattern: ${r.bolt_pattern}`);
  console.log(`  Center Bore: ${r.center_bore_mm}`);
  
  // Check if modification_id looks fake
  const isFake = r.modification_id?.startsWith('manual_') || 
                 r.modification_id === 'base' ||
                 r.modification_id?.startsWith('fake_');
  console.log(`\n  🔍 FAKE INDICATORS:`);
  console.log(`    - modification_id starts with 'manual_': ${r.modification_id?.startsWith('manual_')}`);
  console.log(`    - modification_id is 'base': ${r.modification_id === 'base'}`);
  console.log(`    - Verdict: ${isFake ? '⚠️ LIKELY FAKE' : '✅ Appears legitimate'}`);
}

// 2. Show REAL M3/M4 trims for comparison
console.log("\n\n2. REAL BMW M3/M4 TRIMS (for comparison)\n");

const realTrims = await sql`
  SELECT 
    year, 
    model, 
    display_trim,
    modification_id,
    oem_tire_sizes,
    source
  FROM vehicle_fitments 
  WHERE make ILIKE 'BMW' 
    AND (model ILIKE 'M3' OR model ILIKE 'M4')
    AND display_trim NOT ILIKE '%Base%'
    AND certification_status = 'certified'
  ORDER BY year DESC, model, display_trim
  LIMIT 20
`;

console.log("Real trims (not 'Base'):");
for (const r of realTrims) {
  console.log(`  ${r.year} ${r.model} "${r.display_trim}" (${r.source})`);
}

// 3. Check if fake records are referenced anywhere
console.log("\n\n3. REFERENCE CHECK - Are fake records used elsewhere?\n");

for (const r of baseRecords) {
  const mappings = await sql`
    SELECT COUNT(*) as count 
    FROM wheel_size_trim_mappings 
    WHERE modification_id = ${r.modification_id}
  `;
  
  const configs = await sql`
    SELECT COUNT(*) as count 
    FROM vehicle_fitment_configurations 
    WHERE fitment_id = ${r.id}
  `;
  
  console.log(`Record ID ${r.id} (${r.modification_id}):`);
  console.log(`  - wheel_size_trim_mappings: ${mappings[0]?.count || 0} references`);
  console.log(`  - vehicle_fitment_configurations: ${configs[0]?.count || 0} references`);
}

// 4. Create snapshot export
console.log("\n\n4. SNAPSHOT EXPORT (for rollback)\n");

console.log("Records to delete (JSON snapshot):");
console.log(JSON.stringify(baseRecords.map(r => ({
  id: r.id,
  year: r.year,
  make: r.make,
  model: r.model,
  display_trim: r.display_trim,
  modification_id: r.modification_id,
  oem_tire_sizes: r.oem_tire_sizes,
  oem_wheel_sizes: r.oem_wheel_sizes,
  bolt_pattern: r.bolt_pattern,
  center_bore_mm: r.center_bore_mm,
  source: r.source,
})), null, 2));

// 5. Dry-run DELETE
console.log("\n\n5. DRY-RUN DELETE STATEMENT\n");

const fakeRecordIds = baseRecords
  .filter(r => r.modification_id?.startsWith('manual_') || r.modification_id === 'base')
  .map(r => r.id);

if (fakeRecordIds.length > 0) {
  console.log(`-- DRY RUN: Would delete ${fakeRecordIds.length} records`);
  console.log(`DELETE FROM vehicle_fitments WHERE id IN (${fakeRecordIds.join(', ')});`);
  console.log(`\n⚠️ DO NOT RUN - Awaiting approval`);
} else {
  console.log("No fake records identified for deletion.");
}

await sql.end();
console.log("\n═══════════════════════════════════════════════════════════════");
