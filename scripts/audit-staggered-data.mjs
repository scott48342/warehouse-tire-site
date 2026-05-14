import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log("═══════════════════════════════════════════════════════════════");
console.log("          STAGGERED DATA AUDIT - Front/Rear Split Records");
console.log("═══════════════════════════════════════════════════════════════\n");

// 1. Find all records with "Front" or "Rear" in display_trim
console.log("1. RECORDS WITH 'Front' OR 'Rear' IN DISPLAY_TRIM\n");

const frontRearRecords = await sql`
  SELECT year, make, model, display_trim, modification_id, 
         oem_tire_sizes, source, created_at::date as created_date
  FROM vehicle_fitments 
  WHERE (display_trim ILIKE '%Front%' OR display_trim ILIKE '%Rear%')
    AND certification_status = 'certified'
  ORDER BY make, model, year, display_trim
`;

console.log(`Total records with Front/Rear: ${frontRearRecords.length}\n`);

// Group by make/model
const byMakeModel = {};
for (const r of frontRearRecords) {
  const key = `${r.make} ${r.model}`;
  if (!byMakeModel[key]) byMakeModel[key] = [];
  byMakeModel[key].push(r);
}

console.log("Affected Makes/Models:");
for (const [key, records] of Object.entries(byMakeModel)) {
  const years = [...new Set(records.map(r => r.year))].sort();
  console.log(`  ${key}: ${records.length} records (${years.join(', ')})`);
}

// 2. Show sample of Camaro data
console.log("\n\n2. 2018 CHEVROLET CAMARO - ALL RECORDS\n");

const camaroRecords = await sql`
  SELECT display_trim, modification_id, oem_tire_sizes, source,
         oem_wheel_sizes, bolt_pattern, center_bore_mm
  FROM vehicle_fitments 
  WHERE year = 2018 AND make ILIKE 'Chevrolet' AND model ILIKE 'Camaro'
    AND certification_status = 'certified'
  ORDER BY display_trim
`;

for (const r of camaroRecords) {
  const tireSizes = typeof r.oem_tire_sizes === 'object' 
    ? JSON.stringify(r.oem_tire_sizes) 
    : r.oem_tire_sizes;
  console.log(`Trim: ${r.display_trim}`);
  console.log(`  modificationId: ${r.modification_id}`);
  console.log(`  tireSizes: ${tireSizes}`);
  console.log(`  source: ${r.source}`);
  console.log("");
}

// 3. Check source of malformed records
console.log("\n3. SOURCE ANALYSIS - WHERE DID THESE RECORDS COME FROM?\n");

const sourceAnalysis = await sql`
  SELECT source, COUNT(*) as count
  FROM vehicle_fitments 
  WHERE (display_trim ILIKE '%Front%' OR display_trim ILIKE '%Rear%')
    AND certification_status = 'certified'
  GROUP BY source
  ORDER BY count DESC
`;

console.log("Records by source:");
for (const r of sourceAnalysis) {
  console.log(`  ${r.source || 'NULL'}: ${r.count} records`);
}

// 4. Check other staggered platforms
console.log("\n\n4. OTHER STAGGERED PLATFORMS - CHECKING FOR SIMILAR ISSUES\n");

const staggeredPlatforms = [
  { make: 'Chevrolet', model: 'Corvette' },
  { make: 'Ford', model: 'Mustang' },
  { make: 'BMW', model: 'M3' },
  { make: 'BMW', model: 'M4' },
  { make: 'Porsche', model: '911' },
  { make: 'Dodge', model: 'Challenger' },
  { make: 'Dodge', model: 'Charger' },
];

for (const { make, model } of staggeredPlatforms) {
  const records = await sql`
    SELECT display_trim, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE make ILIKE ${make} AND model ILIKE ${model}
      AND certification_status = 'certified'
      AND (display_trim ILIKE '%Front%' OR display_trim ILIKE '%Rear%')
    LIMIT 5
  `;
  
  const hasStaggeredObject = await sql`
    SELECT COUNT(*) as count
    FROM vehicle_fitments 
    WHERE make ILIKE ${make} AND model ILIKE ${model}
      AND certification_status = 'certified'
      AND jsonb_typeof(oem_tire_sizes::jsonb) = 'object'
  `;
  
  const splitCount = records.length;
  const objectCount = hasStaggeredObject[0]?.count || 0;
  
  if (splitCount > 0 || objectCount > 0) {
    console.log(`${make} ${model}:`);
    if (splitCount > 0) {
      console.log(`  ⚠️ ${splitCount} Front/Rear split records`);
      for (const r of records.slice(0, 2)) {
        console.log(`    - "${r.display_trim}"`);
      }
    }
    if (objectCount > 0) {
      console.log(`  📦 ${objectCount} records with object-shaped tire sizes`);
    }
    console.log("");
  } else {
    console.log(`${make} ${model}: ✅ Clean (no split records)`);
  }
}

// 5. Check pattern in modification_id to understand origin
console.log("\n\n5. MODIFICATION_ID PATTERNS FOR SPLIT RECORDS\n");

const modPatterns = await sql`
  SELECT 
    CASE 
      WHEN modification_id LIKE 'manual_%' THEN 'manual_*'
      WHEN modification_id LIKE 'batch%' THEN 'batch*'
      WHEN modification_id LIKE 'import_%' THEN 'import_*'
      WHEN modification_id ~ '^[0-9a-f]{16}$' THEN 'hex-16 (wheel-size API)'
      ELSE 'other'
    END as pattern,
    COUNT(*) as count
  FROM vehicle_fitments 
  WHERE (display_trim ILIKE '%Front%' OR display_trim ILIKE '%Rear%')
    AND certification_status = 'certified'
  GROUP BY pattern
  ORDER BY count DESC
`;

console.log("Modification ID patterns:");
for (const r of modPatterns) {
  console.log(`  ${r.pattern}: ${r.count} records`);
}

// 6. Sample of what proper staggered data looks like
console.log("\n\n6. PROPER STAGGERED DATA FORMAT (for comparison)\n");

const properStaggered = await sql`
  SELECT display_trim, oem_tire_sizes, make, model, year
  FROM vehicle_fitments 
  WHERE jsonb_typeof(oem_tire_sizes::jsonb) = 'object'
    AND certification_status = 'certified'
    AND display_trim NOT ILIKE '%Front%'
    AND display_trim NOT ILIKE '%Rear%'
  LIMIT 5
`;

console.log("Examples of correctly-formatted staggered records:");
for (const r of properStaggered) {
  console.log(`${r.year} ${r.make} ${r.model} - "${r.display_trim}"`);
  console.log(`  tireSizes: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log("");
}

await sql.end();
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("                        AUDIT COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
