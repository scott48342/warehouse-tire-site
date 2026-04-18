import { config } from 'dotenv';
config({ path: '.env.local' });

const { sql } = await import('@vercel/postgres');

// Add Altitude Lux trim (check if exists first)
const altitudeLuxWheels = [
  { axle: "both", width: 7, offset: 41, diameter: 18, isStock: true },
  { axle: "both", width: 7, offset: 41, diameter: 17, isStock: false }
];
const altitudeLuxTires = ['225/60R18', '225/65R17'];

// Check if Altitude Lux exists
const existingAL = await sql`
  SELECT modification_id FROM vehicle_fitments 
  WHERE modification_id = 'jeep_cherokee_2023_altitude_lux'
`;

if (existingAL.rows.length > 0) {
  await sql`
    UPDATE vehicle_fitments SET
      thread_size = 'M12x1.25',
      oem_wheel_sizes = ${JSON.stringify(altitudeLuxWheels)}::jsonb,
      oem_tire_sizes = ${JSON.stringify(altitudeLuxTires)}::jsonb
    WHERE modification_id = 'jeep_cherokee_2023_altitude_lux'
  `;
  console.log('Updated Altitude Lux');
} else {
  await sql`
    INSERT INTO vehicle_fitments (
      modification_id, year, make, model, display_trim, raw_trim,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm,
      oem_wheel_sizes, oem_tire_sizes, source
    ) VALUES (
      'jeep_cherokee_2023_altitude_lux',
      2023, 'jeep', 'cherokee', 'Altitude Lux', 'Altitude Lux',
      '5x110', 65.1, 'M12x1.25', 'conical',
      35, 52,
      ${JSON.stringify(altitudeLuxWheels)}::jsonb,
      ${JSON.stringify(altitudeLuxTires)}::jsonb,
      'manual'
    )
  `;
  console.log('Inserted Altitude Lux');
}

// Add Trailhawk trim
const trailhawkWheels = [
  { axle: "both", width: 7.5, offset: 41, diameter: 17, isStock: true }
];
const trailhawkTires = ['245/65R17'];

const existingTH = await sql`
  SELECT modification_id FROM vehicle_fitments 
  WHERE modification_id = 'jeep_cherokee_2023_trailhawk'
`;

if (existingTH.rows.length > 0) {
  await sql`
    UPDATE vehicle_fitments SET
      thread_size = 'M12x1.25',
      oem_wheel_sizes = ${JSON.stringify(trailhawkWheels)}::jsonb,
      oem_tire_sizes = ${JSON.stringify(trailhawkTires)}::jsonb
    WHERE modification_id = 'jeep_cherokee_2023_trailhawk'
  `;
  console.log('Updated Trailhawk');
} else {
  await sql`
    INSERT INTO vehicle_fitments (
      modification_id, year, make, model, display_trim, raw_trim,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm,
      oem_wheel_sizes, oem_tire_sizes, source
    ) VALUES (
      'jeep_cherokee_2023_trailhawk',
      2023, 'jeep', 'cherokee', 'Trailhawk', 'Trailhawk',
      '5x110', 65.1, 'M12x1.25', 'conical',
      35, 52,
      ${JSON.stringify(trailhawkWheels)}::jsonb,
      ${JSON.stringify(trailhawkTires)}::jsonb,
      'manual'
    )
  `;
  console.log('Inserted Trailhawk');
}

// Verify
const all = await sql`
  SELECT modification_id, display_trim, thread_size, oem_tire_sizes
  FROM vehicle_fitments 
  WHERE year = 2023 AND LOWER(make) = 'jeep' AND LOWER(model) = 'cherokee'
`;
console.log('\n✅ Cherokee fitment data:');
console.log(JSON.stringify(all.rows, null, 2));
