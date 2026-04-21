/**
 * Batch Fitment Enrichment Data
 * 
 * This file contains researched fitment data for bulk updates.
 * Run with: node scripts/tire-enrichment/batch-enrich-data.mjs
 */

import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const dbUrl = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// ===== RESEARCHED FITMENT DATA =====
// Format: { make, model, years: [array], tireSizes: [], wheelSizes: [] }

const FITMENT_DATA = [
  // BMW X7 (2019-2026)
  {
    make: 'bmw',
    model: 'x7',
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['285/45R21', '275/40R22', '315/35R22', '275/35R23', '315/30R23'],
    wheelSizes: [
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
      { diameter: 22, width: 9.5, axle: 'front', isStock: true },
      { diameter: 22, width: 10.5, axle: 'rear', isStock: true },
      { diameter: 23, width: 9.5, axle: 'front', isStock: true },
      { diameter: 23, width: 10.5, axle: 'rear', isStock: true },
    ]
  },
  
  // Audi Q6 e-tron (2025-2027)
  {
    make: 'audi',
    model: 'q6-e-tron',
    years: [2025, 2026, 2027],
    tireSizes: ['235/55R19', '255/50R19', '255/45R20', '285/40R21'],
    wheelSizes: [
      { diameter: 19, width: 8.0, axle: 'square', isStock: true },
      { diameter: 20, width: 8.5, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi A6 e-tron (2025-2027)
  {
    make: 'audi',
    model: 'a6-e-tron',
    years: [2025, 2026, 2027],
    tireSizes: ['225/55R18', '245/45R19', '255/40R20', '265/35R21'],
    wheelSizes: [
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi S6 e-tron (2025-2027)
  {
    make: 'audi',
    model: 's6-e-tron',
    years: [2025, 2026, 2027],
    tireSizes: ['245/45R19', '265/40R20', '275/35R21'],
    wheelSizes: [
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // BMW 2-Series (2020-2025)
  {
    make: 'bmw',
    model: '2-series',
    years: [2020, 2021, 2022, 2023, 2024, 2025],
    tireSizes: ['225/45R17', '225/40R18', '245/35R19', '255/30R20'],
    wheelSizes: [
      { diameter: 17, width: 7.5, axle: 'square', isStock: true },
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
    ]
  },
  
  // BMW i4 (2022-2025)
  {
    make: 'bmw',
    model: 'i4',
    years: [2022, 2023, 2024, 2025],
    tireSizes: ['225/55R17', '245/45R18', '255/40R19', '275/35R20'],
    wheelSizes: [
      { diameter: 17, width: 7.5, axle: 'square', isStock: true },
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
    ]
  },
  
  // BMW i5 (2024-2025)
  {
    make: 'bmw',
    model: 'i5',
    years: [2024, 2025],
    tireSizes: ['245/45R19', '255/40R20', '275/35R21'],
    wheelSizes: [
      { diameter: 19, width: 8.0, axle: 'square', isStock: true },
      { diameter: 20, width: 8.5, axle: 'square', isStock: true },
      { diameter: 21, width: 9.0, axle: 'square', isStock: true },
    ]
  },
  
  // BMW i7 (2023-2025)
  {
    make: 'bmw',
    model: 'i7',
    years: [2023, 2024, 2025],
    tireSizes: ['245/50R19', '255/45R20', '275/40R21'],
    wheelSizes: [
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // BMW iX (2022-2025)
  {
    make: 'bmw',
    model: 'ix',
    years: [2022, 2023, 2024, 2025],
    tireSizes: ['255/55R19', '255/50R20', '275/40R21', '275/35R22'],
    wheelSizes: [
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
      { diameter: 22, width: 10.0, axle: 'square', isStock: true },
    ]
  },
  
  // BMW X1 (2016-2025)
  {
    make: 'bmw',
    model: 'x1',
    years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tireSizes: ['225/55R17', '225/50R18', '245/45R19', '255/40R20'],
    wheelSizes: [
      { diameter: 17, width: 7.0, axle: 'square', isStock: true },
      { diameter: 18, width: 7.5, axle: 'square', isStock: true },
      { diameter: 19, width: 8.0, axle: 'square', isStock: true },
    ]
  },
  
  // BMW X2 (2018-2025)
  {
    make: 'bmw',
    model: 'x2',
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tireSizes: ['225/55R17', '225/50R18', '245/45R19', '255/40R20'],
    wheelSizes: [
      { diameter: 17, width: 7.0, axle: 'square', isStock: true },
      { diameter: 18, width: 7.5, axle: 'square', isStock: true },
      { diameter: 19, width: 8.0, axle: 'square', isStock: true },
    ]
  },
  
  // BMW X4 (2019-2025)
  {
    make: 'bmw',
    model: 'x4',
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tireSizes: ['245/50R18', '245/45R19', '255/40R20', '275/35R21'],
    wheelSizes: [
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi A8 (2019-2026)
  {
    make: 'audi',
    model: 'a8',
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['235/55R18', '245/50R19', '255/45R20', '275/35R21'],
    wheelSizes: [
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 9.0, axle: 'square', isStock: true },
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi Q3 (2019-2026)
  {
    make: 'audi',
    model: 'q3',
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['215/65R17', '235/55R18', '235/50R19', '235/45R20'],
    wheelSizes: [
      { diameter: 17, width: 7.0, axle: 'square', isStock: true },
      { diameter: 18, width: 7.5, axle: 'square', isStock: true },
      { diameter: 19, width: 8.0, axle: 'square', isStock: true },
      { diameter: 20, width: 8.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi RS3 (2017-2026)
  {
    make: 'audi',
    model: 'rs3',
    years: [2017, 2018, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['235/40R18', '255/30R19', '255/25R20'],
    wheelSizes: [
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
      { diameter: 20, width: 8.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi S3 (2015-2026)
  {
    make: 'audi',
    model: 's3',
    years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['225/45R17', '225/40R18', '235/35R19'],
    wheelSizes: [
      { diameter: 17, width: 7.5, axle: 'square', isStock: true },
      { diameter: 18, width: 8.0, axle: 'square', isStock: true },
      { diameter: 19, width: 8.5, axle: 'square', isStock: true },
    ]
  },
  
  // Audi RS6 (2020-2026)
  {
    make: 'audi',
    model: 'rs6',
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['275/35R21', '285/30R22'],
    wheelSizes: [
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
      { diameter: 22, width: 10.0, axle: 'square', isStock: true },
    ]
  },
  
  // Audi RS7 (2020-2026)
  {
    make: 'audi',
    model: 'rs7',
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tireSizes: ['275/35R21', '285/30R22'],
    wheelSizes: [
      { diameter: 21, width: 9.5, axle: 'square', isStock: true },
      { diameter: 22, width: 10.0, axle: 'square', isStock: true },
    ]
  },
];

// ===== UPDATE FUNCTION =====
async function updateVehicle(make, model, year, tireSizes, wheelSizes) {
  const result = await pool.query(`
    UPDATE vehicle_fitments
    SET 
      oem_tire_sizes = $4::jsonb,
      oem_wheel_sizes = CASE 
        WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN $5::jsonb
        ELSE oem_wheel_sizes
      END,
      updated_at = NOW()
    WHERE LOWER(make) = LOWER($1) 
      AND LOWER(model) = LOWER($2)
      AND year = $3
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    RETURNING id
  `, [make, model, year, JSON.stringify(tireSizes), JSON.stringify(wheelSizes)]);
  
  return result.rowCount;
}

// ===== MAIN =====
async function main() {
  console.log('=== Batch Fitment Enrichment ===\n');
  
  let totalUpdated = 0;
  
  for (const data of FITMENT_DATA) {
    console.log(`${data.make} ${data.model}:`);
    
    for (const year of data.years) {
      const count = await updateVehicle(
        data.make, 
        data.model, 
        year, 
        data.tireSizes, 
        data.wheelSizes
      );
      
      if (count > 0) {
        console.log(`  ${year}: ${count} trims updated`);
        totalUpdated += count;
      }
    }
  }
  
  console.log(`\n✅ Total updated: ${totalUpdated} records`);
  
  // Check remaining
  const remaining = await pool.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'
  `);
  console.log(`📊 Still missing: ${remaining.rows[0].count} records`);
  
  pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
  process.exit(1);
});
