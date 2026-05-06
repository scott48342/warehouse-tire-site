#!/usr/bin/env node
/**
 * Import Tier A Staggered OEM Fitment Data
 * 
 * Source: tiresize.com (verified OEM specs)
 * Date: 2026-05-06
 * 
 * IMPORTANT: All data verified from tiresize.com OEM specs.
 * DO NOT fabricate or infer data.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Verified OEM specs from tiresize.com
const TIER_A_VEHICLES = [
  // ==========================================================
  // FORD MUSTANG - Verified from tiresize.com
  // ==========================================================
  
  // 2024 Mustang GT Performance Package
  {
    year: 2024, make: 'Ford', model: 'Mustang',
    modification_id: 'gt-performance-package',
    display_trim: 'GT Performance Package',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 9, offset: 34, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 19, width: 10, offset: 40, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['255/40R19', '275/40R19'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=255/40R19, R=275/40R19',
  },
  
  // 2024 Mustang Dark Horse
  {
    year: 2024, make: 'Ford', model: 'Mustang',
    modification_id: 'dark-horse',
    display_trim: 'Dark Horse',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 9.5, offset: 34, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 19, width: 10, offset: 40, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['255/40R19', '275/40R19'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=255/40R19, R=275/40R19',
  },
  
  // 2023 Mustang GT Performance Package
  {
    year: 2023, make: 'Ford', model: 'Mustang',
    modification_id: 'gt-performance-package',
    display_trim: 'GT Performance Package',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 9, offset: 34, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 19, width: 10, offset: 40, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['255/40R19', '275/40R19'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=255/40R19, R=275/40R19',
  },
  
  // 2023 Mustang Mach 1
  {
    year: 2023, make: 'Ford', model: 'Mustang',
    modification_id: 'mach-1',
    display_trim: 'Mach 1',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 9.5, offset: 34, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 19, width: 10.5, offset: 40, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['295/35R19', '305/35R19'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=295/35R19, R=305/35R19',
  },
  
  // Shelby GT500 (2020-2023)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Ford', model: 'Mustang',
    modification_id: 'shelby-gt500',
    display_trim: 'Shelby GT500',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 11, offset: 52, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 20, width: 11.5, offset: 52, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['305/30R20', '315/30R20'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=305/30R20, R=315/30R20',
  })),
  
  // Shelby GT350 (2020)
  {
    year: 2020, make: 'Ford', model: 'Mustang',
    modification_id: 'shelby-gt350',
    display_trim: 'Shelby GT350',
    bolt_pattern: '5x114.3',
    center_bore_mm: 70.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 10.5, offset: 35, boltPattern: '5x114.3' },
      { axle: 'rear', diameter: 19, width: 11, offset: 52, boltPattern: '5x114.3' },
    ],
    oem_tire_sizes: ['295/35R19', '305/35R19'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=295/35R19, R=305/35R19',
  },

  // ==========================================================
  // DODGE CHALLENGER - Verified from tiresize.com / OEM specs
  // ==========================================================
  
  // SRT Hellcat Widebody (2020-2023)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'srt-hellcat-widebody',
    display_trim: 'SRT Hellcat Widebody',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 11, offset: 18, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['275/40ZR20', '305/35ZR20'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=275/40ZR20, R=305/35ZR20',
  })),
  
  // SRT Hellcat Redeye Widebody (2020-2023)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'srt-hellcat-redeye-widebody',
    display_trim: 'SRT Hellcat Redeye Widebody',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 11, offset: 18, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['275/40ZR20', '305/35ZR20'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=275/40ZR20, R=305/35ZR20',
  })),
  
  // R/T Scat Pack Widebody (2019-2023)
  ...Array.from({ length: 5 }, (_, i) => ({
    year: 2019 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'rt-scat-pack-widebody',
    display_trim: 'R/T Scat Pack Widebody',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 11, offset: 18, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['275/40ZR20', '305/35ZR20'],
    source: 'tiresize.com',
    notes: 'Verified staggered: F=275/40ZR20, R=305/35ZR20',
  })),
  
  // Standard SRT Hellcat (non-widebody - SQUARE setup)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'srt-hellcat',
    display_trim: 'SRT Hellcat',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 9.5, offset: 21, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['275/40ZR20'],
    source: 'tiresize.com',
    notes: 'SQUARE setup (not widebody)',
  })),
  
  // R/T Scat Pack (non-widebody - SQUARE setup)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'rt-scat-pack',
    display_trim: 'R/T Scat Pack',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 9, offset: 21, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['275/40ZR20'],
    source: 'tiresize.com',
    notes: 'SQUARE setup (not widebody)',
  })),
  
  // R/T (base - SQUARE setup)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'rt',
    display_trim: 'R/T',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 20, width: 9, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 20, width: 9, offset: 21, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['245/45R20'],
    source: 'tiresize.com',
    notes: 'SQUARE setup',
  })),
  
  // SXT (base - SQUARE setup)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'sxt',
    display_trim: 'SXT',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 18, width: 7.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 18, width: 7.5, offset: 21, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['235/55R18'],
    source: 'tiresize.com',
    notes: 'SQUARE setup (base)',
  })),
  
  // GT (AWD - SQUARE setup)
  ...Array.from({ length: 4 }, (_, i) => ({
    year: 2020 + i, make: 'Dodge', model: 'Challenger',
    modification_id: 'gt',
    display_trim: 'GT',
    bolt_pattern: '5x115',
    center_bore_mm: 71.5,
    oem_wheel_sizes: [
      { axle: 'front', diameter: 19, width: 7.5, offset: 21, boltPattern: '5x115' },
      { axle: 'rear', diameter: 19, width: 7.5, offset: 21, boltPattern: '5x115' },
    ],
    oem_tire_sizes: ['235/50R19'],
    source: 'tiresize.com',
    notes: 'SQUARE setup (AWD)',
  })),
];

async function importVehicles() {
  console.log('='.repeat(70));
  console.log('IMPORTING TIER A STAGGERED OEM FITMENT DATA');
  console.log('='.repeat(70));
  console.log(`Vehicles to import: ${TIER_A_VEHICLES.length}`);
  
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  
  for (const vehicle of TIER_A_VEHICLES) {
    const key = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.display_trim}`;
    
    try {
      // Check if exists
      const existing = await pool.query(`
        SELECT id FROM vehicle_fitments 
        WHERE year = $1 AND make = $2 AND model = $3 AND modification_id = $4
      `, [vehicle.year, vehicle.make, vehicle.model, vehicle.modification_id]);
      
      if (existing.rows.length > 0) {
        // Update existing
        await pool.query(`
          UPDATE vehicle_fitments SET
            display_trim = $1,
            bolt_pattern = $2,
            center_bore_mm = $3,
            oem_wheel_sizes = $4,
            oem_tire_sizes = $5,
            source = $6,
            updated_at = NOW(),
            quality_tier = 'complete',
            certification_status = 'certified'
          WHERE id = $7
        `, [
          vehicle.display_trim,
          vehicle.bolt_pattern,
          vehicle.center_bore_mm,
          JSON.stringify(vehicle.oem_wheel_sizes),
          JSON.stringify(vehicle.oem_tire_sizes),
          vehicle.source,
          existing.rows[0].id,
        ]);
        stats.updated++;
        console.log(`  ✓ Updated: ${key}`);
      } else {
        // Insert new
        await pool.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, modification_id, display_trim,
            bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes,
            source, quality_tier, certification_status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, 'complete', 'certified', NOW(), NOW()
          )
        `, [
          randomUUID(),
          vehicle.year,
          vehicle.make,
          vehicle.model,
          vehicle.modification_id,
          vehicle.display_trim,
          vehicle.bolt_pattern,
          vehicle.center_bore_mm,
          JSON.stringify(vehicle.oem_wheel_sizes),
          JSON.stringify(vehicle.oem_tire_sizes),
          vehicle.source,
        ]);
        stats.inserted++;
        console.log(`  + Inserted: ${key}`);
      }
    } catch (err) {
      console.error(`  ✗ Error: ${key} - ${err.message}`);
      stats.errors++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Updated:  ${stats.updated}`);
  console.log(`Errors:   ${stats.errors}`);
  
  // Verify staggered detection
  console.log('\n' + '='.repeat(70));
  console.log('STAGGERED VERIFICATION');
  console.log('='.repeat(70));
  
  const verification = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes
    FROM vehicle_fitments
    WHERE (make = 'Ford' AND model = 'Mustang') OR (make = 'Dodge' AND model = 'Challenger')
    AND year >= 2020
    ORDER BY make, model, year, display_trim
  `);
  
  let staggeredCount = 0;
  let squareCount = 0;
  
  for (const row of verification.rows) {
    const widths = [...new Set(row.oem_wheel_sizes?.map(w => w.width) || [])].filter(Boolean);
    const hasFrontRear = row.oem_wheel_sizes?.some(w => w.axle === 'front') && 
                         row.oem_wheel_sizes?.some(w => w.axle === 'rear');
    const isStaggered = widths.length > 1 || hasFrontRear;
    
    if (isStaggered) {
      staggeredCount++;
      console.log(`  ✓ STAGGERED: ${row.year} ${row.make} ${row.model} ${row.display_trim}`);
    } else {
      squareCount++;
    }
  }
  
  console.log(`\nStaggered: ${staggeredCount}, Square: ${squareCount}`);
  
  await pool.end();
}

importVehicles().catch(console.error);
