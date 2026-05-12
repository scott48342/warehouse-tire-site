/**
 * Add 2007 BMW 328i trim to vehicle_fitments
 * The wheel search works but the trim doesn't show in the selector
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function addTrim() {
  // Check if 328i already exists
  const existing = await pool.query(`
    SELECT id, display_trim FROM vehicle_fitments 
    WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
    AND (LOWER(display_trim) LIKE '%328%' OR modification_id LIKE '%328%')
  `);
  
  if (existing.rows.length > 0) {
    console.log('328i trim already exists:', existing.rows[0]);
    await pool.end();
    return;
  }

  // Get the base specs from existing 3 Series record
  const baseRecord = await pool.query(`
    SELECT bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, lug_thread, lug_seat_type
    FROM vehicle_fitments 
    WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
    AND certification_status = 'certified'
    LIMIT 1
  `);

  if (baseRecord.rows.length === 0) {
    console.log('No base record found!');
    await pool.end();
    return;
  }

  const base = baseRecord.rows[0];
  console.log('Using base specs:', base.bolt_pattern, base.center_bore_mm + 'mm');

  // OEM specs from TireGuide screenshot for 328i specifically
  const oemWheelSizes = [
    { diameter: 16, width: 7, offset: 46, axle: 'both', isStock: true },
    { diameter: 17, width: 8, offset: 46, axle: 'front', isStock: true },
    { diameter: 17, width: 8.5, offset: 46, axle: 'rear', isStock: true },
    { diameter: 18, width: 8, offset: 35, axle: 'front', isStock: false },
    { diameter: 18, width: 8.5, offset: 35, axle: 'rear', isStock: false },
    { diameter: 19, width: 8, offset: 35, axle: 'front', isStock: false },
    { diameter: 19, width: 8.5, offset: 35, axle: 'rear', isStock: false },
  ];

  const oemTireSizes = [
    '205/55R16',
    '225/45R17',
    '255/40R17',
    '225/40R18',
    '245/35R18',
    '225/35R19',
    '245/30R19',
  ];

  // Insert 328i trim
  await pool.query(`
    INSERT INTO vehicle_fitments (
      year, make, model, display_trim, modification_id,
      bolt_pattern, center_bore_mm, lug_thread, lug_seat_type,
      oem_wheel_sizes, oem_tire_sizes,
      quality_tier, certification_status, source
    ) VALUES (
      2007, 'BMW', '3 Series', '328i', 'bmw-3-series-328i-2007-manual',
      $1, $2, $3, $4,
      $5, $6,
      'complete', 'certified', 'manual_import'
    )
  `, [
    base.bolt_pattern,
    base.center_bore_mm,
    base.lug_thread || 'M12x1.5',
    base.lug_seat_type || 'cone',
    JSON.stringify(oemWheelSizes),
    JSON.stringify(oemTireSizes),
  ]);

  console.log('✅ Added 2007 BMW 3 Series 328i trim');

  // Verify
  const verify = await pool.query(`
    SELECT display_trim, modification_id FROM vehicle_fitments 
    WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
  `);
  console.log('\nAll 2007 BMW 3 Series trims now:');
  verify.rows.forEach(r => console.log(`  - ${r.display_trim} (${r.modification_id})`));

  await pool.end();
}

addTrim().catch(e => { console.error(e); process.exit(1); });
