/**
 * Add 2024 Nissan Frontier fitment data
 * 
 * Source: wheel-size.com screenshot
 * Bolt: 6x114.3, Hub: 66.1mm, Thread: M12x1.25, Offset: +30
 */

import pg from 'pg';
import { randomUUID } from 'crypto';
const { Pool } = pg;

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ POSTGRES_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const FRONTIER_FITMENTS = [
  // PRO-X (the one failing QA)
  { trim: 'PRO-X', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // PRO-4X
  { trim: 'PRO-4X', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // Hardbody Edition
  { trim: 'Hardbody Edition', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // SL
  { trim: 'SL', tireSize: '265/65R17', wheelSize: '17x7.5' },
  // SV
  { trim: 'SV', tireSize: '265/65R17', wheelSize: '17x7.5' },
  // S (16" base)
  { trim: 'S', tireSize: '265/70R16', wheelSize: '16x7' },
];

// Common specs for all 2024 Frontier
const COMMON = {
  year: 2024,
  make: 'Nissan',
  model: 'Frontier',
  boltPattern: '6x114.3',
  centerBoreMm: 66.1,
  threadSize: 'M12x1.25',
  seatType: 'conical',
  offsetMinMm: 20,
  offsetMaxMm: 40,
  source: 'manual-import',
};

async function addFrontierFitment() {
  console.log('Adding 2024 Nissan Frontier fitment data...\n');

  for (const f of FRONTIER_FITMENTS) {
    const modificationId = `nissan-frontier-${f.trim.toLowerCase().replace(/\s+/g, '-')}-${randomUUID().slice(0, 8)}`;
    
    // Parse wheel size
    const wheelMatch = f.wheelSize.match(/(\d+)x([\d.]+)/);
    const wheelDia = wheelMatch ? parseInt(wheelMatch[1]) : 17;
    const wheelWidth = wheelMatch ? parseFloat(wheelMatch[2]) : 7.5;

    // OEM sizes as JSONB
    const oemWheelSizes = JSON.stringify([{
      diameter: wheelDia,
      width: wheelWidth,
      offset: 30,
      isStaggered: false,
    }]);
    
    const oemTireSizes = JSON.stringify([{
      size: f.tireSize,
      loadIndex: 115,
      speedRating: 'S',
    }]);

    try {
      // Check if exists
      const existing = await pool.query(`
        SELECT id FROM vehicle_fitments 
        WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4
      `, [COMMON.year, COMMON.make, COMMON.model, f.trim]);

      if (existing.rows.length > 0) {
        console.log(`  ⏭️  ${f.trim} exists, updating...`);
        await pool.query(`
          UPDATE vehicle_fitments SET
            bolt_pattern = $1,
            center_bore_mm = $2,
            thread_size = $3,
            seat_type = $4,
            offset_min_mm = $5,
            offset_max_mm = $6,
            oem_wheel_sizes = $7,
            oem_tire_sizes = $8,
            source = $9,
            updated_at = NOW()
          WHERE id = $10
        `, [
          COMMON.boltPattern,
          COMMON.centerBoreMm,
          COMMON.threadSize,
          COMMON.seatType,
          COMMON.offsetMinMm,
          COMMON.offsetMaxMm,
          oemWheelSizes,
          oemTireSizes,
          COMMON.source,
          existing.rows[0].id,
        ]);
      } else {
        await pool.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, 
            modification_id, raw_trim, display_trim,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm,
            oem_wheel_sizes, oem_tire_sizes,
            source, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13,
            $14, $15,
            $16, NOW(), NOW()
          )
        `, [
          randomUUID(),
          COMMON.year, COMMON.make, COMMON.model,
          modificationId, f.trim, f.trim,
          COMMON.boltPattern, COMMON.centerBoreMm, COMMON.threadSize, COMMON.seatType,
          COMMON.offsetMinMm, COMMON.offsetMaxMm,
          oemWheelSizes, oemTireSizes,
          COMMON.source,
        ]);
        console.log(`  ✅ Added ${COMMON.year} ${COMMON.make} ${COMMON.model} ${f.trim}`);
      }
    } catch (err) {
      console.error(`  ❌ Error with ${f.trim}:`, err.message);
    }
  }

  // Verify
  const result = await pool.query(`
    SELECT display_trim, bolt_pattern, center_bore_mm, oem_tire_sizes 
    FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'Nissan' AND model = 'Frontier'
    ORDER BY display_trim
  `);
  
  console.log('\n📋 2024 Nissan Frontier fitments in DB:');
  for (const row of result.rows) {
    const tireSize = row.oem_tire_sizes?.[0]?.size || 'N/A';
    console.log(`   ${row.display_trim}: ${row.bolt_pattern}, ${row.center_bore_mm}mm, ${tireSize}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
}

addFrontierFitment().catch(console.error);
