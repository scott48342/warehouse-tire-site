#!/usr/bin/env node
/**
 * Seed QA Test Vehicles Table
 * 
 * Creates the qa_test_vehicles table if it doesn't exist
 * and populates it with a diverse set of test vehicles.
 * 
 * Usage: node scripts/nightly-qa/seed-test-vehicles.mjs
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: POSTGRES_URL or DATABASE_URL environment variable required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Test vehicle pool - diverse coverage across categories
const TEST_VEHICLES = [
  // ============================================================
  // HALF-TON TRUCKS (Canaries)
  // ============================================================
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'half-ton', is_canary: true },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', category: 'half-ton', is_canary: true },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', category: 'half-ton', is_canary: true },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'SLT', category: 'half-ton', is_canary: true },
  { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5', category: 'half-ton', is_canary: true },
  { year: 2023, make: 'Ford', model: 'F-150', trim: 'Lariat', category: 'half-ton' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 1500', trim: 'High Country', category: 'half-ton' },
  { year: 2023, make: 'Ram', model: '1500', trim: 'Laramie', category: 'half-ton' },
  { year: 2020, make: 'Ford', model: 'F-150', trim: 'XL', category: 'half-ton' },
  { year: 2019, make: 'Toyota', model: 'Tundra', trim: 'Limited', category: 'half-ton' },
  
  // ============================================================
  // HD TRUCKS (Canaries)
  // ============================================================
  { year: 2024, make: 'Ford', model: 'F-250', trim: 'XLT', category: 'hd', is_canary: true },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', category: 'hd', is_canary: true },
  { year: 2024, make: 'Ram', model: '2500', trim: 'Big Horn', category: 'hd', is_canary: true },
  { year: 2023, make: 'Ford', model: 'F-350', trim: 'Lariat', category: 'hd' },
  { year: 2023, make: 'GMC', model: 'Sierra 3500 HD', trim: 'Denali', category: 'hd' },
  
  // ============================================================
  // MIDSIZE TRUCKS
  // ============================================================
  { year: 2024, make: 'Ford', model: 'Ranger', trim: 'XLT', category: 'midsize', is_canary: true },
  { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'LT', category: 'midsize', is_canary: true },
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport', category: 'midsize' },
  { year: 2024, make: 'Jeep', model: 'Gladiator', trim: 'Rubicon', category: 'midsize', is_canary: true },
  { year: 2023, make: 'GMC', model: 'Canyon', trim: 'AT4', category: 'midsize' },
  
  // ============================================================
  // JEEP/BRONCO
  // ============================================================
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', category: 'jeep', is_canary: true },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Wildtrak', category: 'bronco', is_canary: true },
  { year: 2023, make: 'Jeep', model: 'Wrangler', trim: 'Sahara', category: 'jeep' },
  { year: 2022, make: 'Ford', model: 'Bronco', trim: 'Big Bend', category: 'bronco' },
  
  // ============================================================
  // STAGGERED (Performance - Canaries)
  // ============================================================
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'staggered', is_canary: true, is_performance: true },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'Dark Horse', category: 'staggered', is_canary: true, is_performance: true },
  { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', category: 'staggered', is_canary: true, is_performance: true },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS', category: 'staggered', is_canary: true, is_performance: true },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: '1LE', category: 'staggered', is_performance: true },
  { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1', category: 'staggered', is_performance: true },
  { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', category: 'staggered', is_canary: true, is_performance: true },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T', category: 'staggered', is_performance: true },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'Widebody', category: 'staggered', is_performance: true },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'Hellcat', category: 'staggered', is_performance: true },
  
  // ============================================================
  // SUVs
  // ============================================================
  { year: 2024, make: 'Toyota', model: '4Runner', trim: 'TRD Pro', category: 'suv', is_canary: true },
  { year: 2024, make: 'Ford', model: 'Explorer', trim: 'XLT', category: 'suv' },
  { year: 2024, make: 'Chevrolet', model: 'Tahoe', trim: 'LT', category: 'suv' },
  { year: 2023, make: 'Jeep', model: 'Grand Cherokee', trim: 'Limited', category: 'suv' },
  { year: 2024, make: 'GMC', model: 'Yukon', trim: 'Denali', category: 'suv' },
  
  // ============================================================
  // CARS
  // ============================================================
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE', category: 'car', is_canary: true },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', category: 'car' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'Si', category: 'car' },
  { year: 2023, make: 'Mazda', model: '3', trim: 'Turbo', category: 'car' },
  { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'N Line', category: 'car' },
  
  // ============================================================
  // EVs
  // ============================================================
  { year: 2024, make: 'Ford', model: 'F-150 Lightning', trim: 'Lariat', category: 'ev', is_canary: true },
  { year: 2024, make: 'Chevrolet', model: 'Silverado EV', trim: 'RST', category: 'ev' },
  { year: 2024, make: 'Rivian', model: 'R1T', trim: 'Adventure', category: 'ev' },
  { year: 2024, make: 'BMW', model: 'iX', trim: 'xDrive50', category: 'ev' },
  { year: 2024, make: 'Tesla', model: 'Model Y', trim: 'Performance', category: 'ev' },
];

async function main() {
  console.log('Creating qa_test_vehicles table...');
  
  // Create table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS qa_test_vehicles (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      make VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      trim VARCHAR(100),
      category VARCHAR(50) NOT NULL,
      is_performance BOOLEAN DEFAULT FALSE,
      is_canary BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      expected_staggered BOOLEAN DEFAULT FALSE,
      expected_bolt_pattern VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(year, make, model, trim)
    )
  `);
  
  console.log('Seeding test vehicles...');
  
  let inserted = 0;
  let skipped = 0;
  
  for (const vehicle of TEST_VEHICLES) {
    try {
      await pool.query(`
        INSERT INTO qa_test_vehicles (year, make, model, trim, category, is_performance, is_canary)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (year, make, model, trim) DO UPDATE SET
          category = EXCLUDED.category,
          is_performance = EXCLUDED.is_performance,
          is_canary = EXCLUDED.is_canary,
          updated_at = NOW()
      `, [
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.trim || null,
        vehicle.category,
        vehicle.is_performance || false,
        vehicle.is_canary || false,
      ]);
      inserted++;
    } catch (err) {
      console.log(`  Skipped: ${vehicle.year} ${vehicle.make} ${vehicle.model} - ${err.message}`);
      skipped++;
    }
  }
  
  console.log(`\nDone! Inserted/updated: ${inserted}, Skipped: ${skipped}`);
  
  // Show summary
  const result = await pool.query(`
    SELECT category, COUNT(*) as count, SUM(CASE WHEN is_canary THEN 1 ELSE 0 END) as canaries
    FROM qa_test_vehicles
    WHERE is_active = true
    GROUP BY category
    ORDER BY count DESC
  `);
  
  console.log('\nTest vehicle pool:');
  console.log('─'.repeat(40));
  for (const row of result.rows) {
    console.log(`  ${row.category.padEnd(15)} ${row.count} vehicles (${row.canaries} canaries)`);
  }
  
  const total = await pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN is_canary THEN 1 ELSE 0 END) as canaries FROM qa_test_vehicles WHERE is_active = true');
  console.log('─'.repeat(40));
  console.log(`  TOTAL:         ${total.rows[0].total} vehicles (${total.rows[0].canaries} canaries)`);
  
  await pool.end();
}

main().catch(console.error);
