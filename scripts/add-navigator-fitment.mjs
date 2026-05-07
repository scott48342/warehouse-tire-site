#!/usr/bin/env node
/**
 * Add 2024 Lincoln Navigator fitment data
 * From screenshot specs provided 2026-05-07
 */

import pg from 'pg';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

function generateModificationId(year, make, model, trim) {
  const slug = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hash = createHash('md5').update(slug).digest('hex').substring(0, 8);
  return `${slug}-${hash}`;
}

async function main() {
  console.log('=== Adding 2024 Lincoln Navigator Fitment Data ===\n');

  // Common specs for all Navigator trims
  const baseSpecs = {
    year: 2024,
    make: 'Lincoln',
    model: 'Navigator',
    boltPattern: '6x135',
    centerBoreMm: 87,
    threadSize: 'M14x1.5',
    seatType: 'conical',
    offsetMinMm: 44,
    offsetMaxMm: 44,
    source: 'manual_import',
  };

  const trims = [
    { 
      trim: 'Reserve',
      wheelSizes: ['22x9.5'],
      tireSizes: ['285/45R22'],
    },
    { 
      trim: 'Black Label',
      wheelSizes: ['22x9.5'],
      tireSizes: ['285/45R22'],
    },
    { 
      trim: 'L Reserve',
      wheelSizes: ['22x9.5'],
      tireSizes: ['285/45R22'],
    },
    { 
      trim: 'L Black Label',
      wheelSizes: ['22x9.5'],
      tireSizes: ['285/45R22'],
    },
    { 
      trim: 'Premiere',
      wheelSizes: ['20x8.5', '22x9.5'],
      tireSizes: ['275/55R20', '285/45R22'],
    },
  ];

  for (const t of trims) {
    const modificationId = generateModificationId(baseSpecs.year, baseSpecs.make, baseSpecs.model, t.trim);
    
    // Check if already exists
    const { rows: existing } = await pool.query(`
      SELECT id FROM vehicle_fitments 
      WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4
    `, [baseSpecs.year, baseSpecs.make, baseSpecs.model, t.trim]);
    
    if (existing.length > 0) {
      console.log(`  Skipping ${t.trim} (already exists)`);
      continue;
    }
    
    const result = await pool.query(`
      INSERT INTO vehicle_fitments (
        id, year, make, model, modification_id, raw_trim, display_trim,
        bolt_pattern, center_bore_mm, thread_size, seat_type,
        offset_min_mm, offset_max_mm,
        oem_wheel_sizes, oem_tire_sizes,
        source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13,
        $14::jsonb, $15::jsonb,
        $16, NOW(), NOW()
      )
    `, [
      randomUUID(),
      baseSpecs.year,
      baseSpecs.make,
      baseSpecs.model,
      modificationId,
      t.trim,
      t.trim,
      baseSpecs.boltPattern,
      baseSpecs.centerBoreMm,
      baseSpecs.threadSize,
      baseSpecs.seatType,
      baseSpecs.offsetMinMm,
      baseSpecs.offsetMaxMm,
      JSON.stringify(t.wheelSizes),
      JSON.stringify(t.tireSizes),
      baseSpecs.source,
    ]);
    
    console.log(`  Added ${t.trim}: ${t.tireSizes.join(', ')}`);
  }

  // Verify
  const { rows } = await pool.query(`
    SELECT display_trim, oem_tire_sizes, oem_wheel_sizes 
    FROM vehicle_fitments 
    WHERE year = 2024 AND make = 'Lincoln' AND model = 'Navigator'
  `);
  
  console.log('\n=== Verification ===');
  for (const row of rows) {
    console.log(`  ${row.display_trim}: wheels=${row.oem_wheel_sizes?.join(',')}, tires=${row.oem_tire_sizes?.join(',')}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
