import { Pool } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// 2020 Mercedes-AMG GT specifications
// Staggered fitment: front narrower than rear
const amgGT = {
  year: 2020,
  make: 'mercedes-benz',
  model: 'amg-gt',
  modificationId: `manual_${randomUUID().slice(0, 12)}`,
  rawTrim: 'Base',
  displayTrim: 'Base',
  submodel: null,
  boltPattern: '5x112',
  centerBoreMm: 66.6,
  threadSize: 'M14x1.5',
  seatType: 'ball',
  offsetMinMm: 25,
  offsetMaxMm: 55,
  // Staggered: front 265, rear 295
  oemWheelSizes: [
    { width: 9.5, diameter: 19, axle: 'front' },
    { width: 11, diameter: 19, axle: 'rear' },
    { width: 10, diameter: 20, axle: 'front' },
    { width: 12, diameter: 20, axle: 'rear' }
  ],
  // Staggered tire sizes (front/rear)
  oemTireSizes: [
    '265/35ZR19', // front
    '295/30ZR19', // rear
    '265/35ZR20', // front alt
    '295/30ZR20'  // rear alt
  ],
  source: 'manual-fix'
};

async function addAMGGT() {
  const result = await pool.query(
    `INSERT INTO vehicle_fitments (
      id, year, make, model, modification_id, raw_trim, display_trim, submodel,
      bolt_pattern, center_bore_mm, thread_size, seat_type, 
      offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
      source, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    )
    ON CONFLICT (year, make, model, modification_id) DO UPDATE SET
      bolt_pattern = EXCLUDED.bolt_pattern,
      center_bore_mm = EXCLUDED.center_bore_mm,
      thread_size = EXCLUDED.thread_size,
      seat_type = EXCLUDED.seat_type,
      offset_min_mm = EXCLUDED.offset_min_mm,
      offset_max_mm = EXCLUDED.offset_max_mm,
      oem_wheel_sizes = EXCLUDED.oem_wheel_sizes,
      oem_tire_sizes = EXCLUDED.oem_tire_sizes,
      updated_at = NOW()`,
    [
      amgGT.year, amgGT.make, amgGT.model, amgGT.modificationId,
      amgGT.rawTrim, amgGT.displayTrim, amgGT.submodel,
      amgGT.boltPattern, amgGT.centerBoreMm, amgGT.threadSize, amgGT.seatType,
      amgGT.offsetMinMm, amgGT.offsetMaxMm,
      JSON.stringify(amgGT.oemWheelSizes), JSON.stringify(amgGT.oemTireSizes),
      amgGT.source
    ]
  );
  console.log('Added 2020 Mercedes-AMG GT:', result.rowCount, 'row inserted');
  
  // Verify
  const check = await pool.query(
    `SELECT year, make, model, display_trim, bolt_pattern, oem_tire_sizes, oem_wheel_sizes 
     FROM vehicle_fitments WHERE year = 2020 AND make = 'mercedes-benz' AND model = 'amg-gt'`
  );
  console.log('Verification:', JSON.stringify(check.rows[0], null, 2));
  
  await pool.end();
}

addAMGGT();
