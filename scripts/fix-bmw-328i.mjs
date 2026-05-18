import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";
const client = postgres(connectionString);
const db = drizzle(client);

// Fix the base 328i record
console.log("Updating 2007 BMW 3 Series 328i base record...");

await db.execute(sql`
  UPDATE vehicle_fitments
  SET 
    oem_wheel_sizes = '[
      {"axle": "both", "width": 7, "diameter": 16, "offset": 46, "isStock": true}
    ]'::jsonb,
    oem_tire_sizes = '["205/55R16"]'::jsonb,
    thread_size = 'M12x1.5',
    seat_type = 'ball',
    offset_min_mm = '46',
    offset_max_mm = '46',
    updated_at = NOW(),
    last_modified_by = 'clawd-fix',
    last_modified_reason = 'Corrected per Tire Guide data - base model is non-staggered 205/55R16 on 16x7'
  WHERE modification_id = 'bmw-3-series-328i-9947bf10'
    AND year = 2007
`);

console.log("✓ Base 328i updated");

// Check if sport package exists, if not create it
const existing = await db.execute(sql`
  SELECT id FROM vehicle_fitments 
  WHERE year = 2007 
    AND make = 'BMW' 
    AND model = '3 Series'
    AND modification_id = 'bmw-3-series-328i-sport-pkg'
`);

if (existing.length === 0) {
  console.log("Creating 328i Sport Package record (staggered)...");
  
  await db.execute(sql`
    INSERT INTO vehicle_fitments (
      id, year, make, model, modification_id, raw_trim, display_trim, submodel,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm,
      oem_wheel_sizes, oem_tire_sizes,
      source, quality_tier, certification_status, certified_at,
      certified_by_script_version, is_locked, dataset_version,
      created_at, updated_at, last_modified_by, last_modified_reason, confidence_tag
    ) VALUES (
      gen_random_uuid(),
      2007,
      'BMW',
      '3 Series',
      'bmw-3-series-328i-sport-pkg',
      '328i w/Sport Pkg',
      '328i Sport Package',
      'E90',
      '5x120',
      '72.6',
      'M12x1.5',
      'ball',
      '34',
      '46',
      '[
        {"axle": "front", "width": 8, "diameter": 17, "offset": 34, "isStock": true},
        {"axle": "rear", "width": 8.5, "diameter": 17, "offset": 37, "isStock": true}
      ]'::jsonb,
      '["225/45R17", "255/40R17"]'::jsonb,
      'tire-guide-manual',
      'complete',
      'certified',
      NOW(),
      'v1.0.0-tire-guide',
      true,
      'v1.0.0-tire-guide',
      NOW(),
      NOW(),
      'clawd-fix',
      'Added staggered sport package per Tire Guide data',
      'HIGH'
    )
  `);
  
  console.log("✓ Sport Package record created");
} else {
  console.log("Sport package record already exists, updating...");
  
  await db.execute(sql`
    UPDATE vehicle_fitments
    SET 
      oem_wheel_sizes = '[
        {"axle": "front", "width": 8, "diameter": 17, "offset": 34, "isStock": true},
        {"axle": "rear", "width": 8.5, "diameter": 17, "offset": 37, "isStock": true}
      ]'::jsonb,
      oem_tire_sizes = '["225/45R17", "255/40R17"]'::jsonb,
      thread_size = 'M12x1.5',
      seat_type = 'ball',
      updated_at = NOW(),
      last_modified_by = 'clawd-fix',
      last_modified_reason = 'Corrected per Tire Guide data'
    WHERE modification_id = 'bmw-3-series-328i-sport-pkg'
      AND year = 2007
  `);
  
  console.log("✓ Sport Package updated");
}

// Verify the changes
console.log("\n=== Verification ===\n");

const results = await db.execute(sql`
  SELECT modification_id, display_trim, oem_wheel_sizes, oem_tire_sizes, thread_size, seat_type
  FROM vehicle_fitments
  WHERE year = 2007
    AND make = 'BMW'
    AND model = '3 Series'
    AND (modification_id LIKE '%328i%')
  ORDER BY modification_id
`);

for (const r of results) {
  console.log(`${r.display_trim} (${r.modification_id}):`);
  console.log(`  Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
  console.log(`  Tires: ${JSON.stringify(r.oem_tire_sizes)}`);
  console.log(`  Thread: ${r.thread_size} (${r.seat_type})`);
  console.log('');
}

await client.end();
console.log("Done!");
