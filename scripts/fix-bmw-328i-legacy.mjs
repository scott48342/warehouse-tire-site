/**
 * Add 2007 BMW 328i (3 Series) to legacy fitment tables
 * Data source: TireGuide screenshot from Scott
 * 
 * Specs:
 * - Base: 205/55R16, 16x7 wheel
 * - Sport Pkg: 225/45R17 front (17x8), 255/40R17 rear (17x8.5) 
 * - Bolt: 5x120
 * - Hub bore: 72.6mm
 * - Offset: +46
 * - Lug: M12x1.5
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if we already have this vehicle
    const existing = await client.query(`
      SELECT id FROM vehicles 
      WHERE year = 2007 AND LOWER(make) = 'bmw' AND LOWER(model) = '3 series'
      LIMIT 1
    `);

    let vehicleId;

    if (existing.rows.length > 0) {
      vehicleId = existing.rows[0].id;
      console.log('Vehicle already exists, id:', vehicleId);
    } else {
      // Insert into vehicles table
      const vehicleResult = await client.query(`
        INSERT INTO vehicles (year, make, model, trim, slug, created_at, updated_at, imported_at)
        VALUES (2007, 'BMW', '3 Series', '328i', 'bmw-3-series-328i-2007', NOW(), NOW(), NOW())
        RETURNING id
      `);
      vehicleId = vehicleResult.rows[0].id;
      console.log('Created vehicle, id:', vehicleId);
    }

    // Check/insert vehicle_fitment
    const fitmentExists = await client.query(`
      SELECT id FROM vehicle_fitment WHERE vehicle_id = $1 LIMIT 1
    `, [vehicleId]);

    if (fitmentExists.rows.length === 0) {
      await client.query(`
        INSERT INTO vehicle_fitment (vehicle_id, bolt_pattern, center_bore, stud_holes, pcd, fastener_type, thread_size)
        VALUES ($1, '5x120', 72.6, 5, 120, 'bolt', 'M12x1.5')
      `, [vehicleId]);
      console.log('Created vehicle_fitment');
    } else {
      console.log('vehicle_fitment already exists');
    }

    // Clear and re-insert wheel specs
    await client.query(`DELETE FROM vehicle_wheel_specs WHERE vehicle_id = $1`, [vehicleId]);

    // OEM wheel specs from screenshot
    const wheelSpecs = [
      // Base - 16"
      { diameter: 16, width: 7, offset: 46, tire: '205/55R16', isStock: true, axle: 'both' },
      // Sport Pkg - 17" (staggered capable)
      { diameter: 17, width: 8, offset: 46, tire: '225/45R17', isStock: true, axle: 'front' },
      { diameter: 17, width: 8.5, offset: 46, tire: '255/40R17', isStock: true, axle: 'rear' },
      // Plus sizes - 18"
      { diameter: 18, width: 8, offset: 35, tire: '225/40R18', isStock: false, axle: 'front' },
      { diameter: 18, width: 8.5, offset: 35, tire: '245/35R18', isStock: false, axle: 'rear' },
      // Plus sizes - 19"
      { diameter: 19, width: 8, offset: 35, tire: '225/35R19', isStock: false, axle: 'front' },
      { diameter: 19, width: 8.5, offset: 35, tire: '245/30R19', isStock: false, axle: 'rear' },
    ];

    for (const spec of wheelSpecs) {
      await client.query(`
        INSERT INTO vehicle_wheel_specs (vehicle_id, rim_diameter, rim_width, "offset", tire_size, is_stock, axle)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [vehicleId, spec.diameter, spec.width, spec.offset, spec.tire, spec.isStock, spec.axle]);
    }
    console.log('Created', wheelSpecs.length, 'wheel specs');

    await client.query('COMMIT');
    console.log('✅ Done! 2007 BMW 3 Series (328i) added to legacy tables');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(e => { console.error(e); process.exit(1); });
