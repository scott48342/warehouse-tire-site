/**
 * 1. Add 2019 Ford Edge to vehicle_fitments
 * 2. Remove invalid vehicles from unresolved_fitment_searches
 * 
 * 2019 Ford Edge specs from TireGuide:
 * - Bolt: 5x108
 * - Hub: 63.4mm
 * - Lug: M14x1.5
 * - Offset: +44
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // ========================================
    // 1. ADD 2019 FORD EDGE
    // ========================================
    console.log('--- Adding 2019 Ford Edge ---');

    const trims = [
      { name: 'SE', wheels: [{ d: 18, w: 8, o: 44 }], tires: ['245/60R18'] },
      { name: 'SEL', wheels: [{ d: 18, w: 8, o: 44 }], tires: ['245/60R18'] },
      { name: 'ST', wheels: [{ d: 20, w: 8, o: 44 }, { d: 21, w: 9, o: 44 }], tires: ['245/50R20', '265/40R21'] },
      { name: 'Titanium', wheels: [{ d: 19, w: 8, o: 44 }, { d: 20, w: 8, o: 44 }], tires: ['245/55R19', '245/50R20'] },
    ];

    for (const trim of trims) {
      // Check if already exists
      const existing = await client.query(`
        SELECT id FROM vehicle_fitments 
        WHERE year = 2019 AND LOWER(make) = 'ford' AND LOWER(model) = 'edge' 
        AND LOWER(display_trim) = LOWER($1)
      `, [trim.name]);

      if (existing.rows.length > 0) {
        console.log(`  ${trim.name} already exists, skipping`);
        continue;
      }

      const oemWheelSizes = trim.wheels.map(w => ({
        diameter: w.d,
        width: w.w,
        offset: w.o,
        axle: 'both',
        isStock: true
      }));

      await client.query(`
        INSERT INTO vehicle_fitments (
          year, make, model, display_trim, modification_id,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          oem_wheel_sizes, oem_tire_sizes,
          quality_tier, certification_status, source
        ) VALUES (
          2019, 'Ford', 'Edge', $1, $2,
          '5x108', 63.4, 'M14x1.5', 'conical',
          $3, $4,
          'complete', 'certified', 'manual_import'
        )
      `, [
        trim.name,
        `ford-edge-${trim.name.toLowerCase()}-2019-manual`,
        JSON.stringify(oemWheelSizes),
        JSON.stringify(trim.tires),
      ]);
      console.log(`  ✅ Added ${trim.name}`);
    }

    // ========================================
    // 2. REMOVE INVALID UNRESOLVED ENTRIES
    // ========================================
    console.log('\n--- Removing invalid unresolved entries ---');

    const invalidVehicles = [
      { year: 2012, make: 'jeep', model: 'gladiator', reason: 'Gladiator is 2019+' },
      { year: 2019, make: 'cadillac', model: 'lyriq', reason: 'Lyriq is 2023+' },
      { year: 2013, make: 'buick', model: 'encore gx', reason: 'Encore GX is 2020+' },
    ];

    for (const v of invalidVehicles) {
      const result = await client.query(`
        DELETE FROM unresolved_fitment_searches 
        WHERE year = $1 AND LOWER(make) = $2 AND LOWER(model) = $3
        RETURNING id
      `, [v.year, v.make, v.model]);
      
      if (result.rowCount > 0) {
        console.log(`  ✅ Removed ${v.year} ${v.make} ${v.model} (${v.reason})`);
      } else {
        console.log(`  - ${v.year} ${v.make} ${v.model} not found`);
      }
    }

    // Also remove the malformed Yukon XL entry
    const yukonResult = await client.query(`
      DELETE FROM unresolved_fitment_searches 
      WHERE year = 2015 AND LOWER(make) = 'gmc' AND LOWER(model) = 'yukon xl'
      AND trim LIKE '%railway%'
      RETURNING id
    `);
    if (yukonResult.rowCount > 0) {
      console.log(`  ✅ Removed malformed 2015 GMC Yukon XL entry`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Done!');

    // Verify Edge was added
    const verify = await pool.query(`
      SELECT display_trim FROM vehicle_fitments 
      WHERE year = 2019 AND LOWER(make) = 'ford' AND LOWER(model) = 'edge'
    `);
    console.log('\n2019 Ford Edge trims now:', verify.rows.map(r => r.display_trim).join(', '));

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
