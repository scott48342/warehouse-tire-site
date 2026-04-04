/**
 * Create tire_pattern_specs table and populate from WheelPros data
 * 
 * This table caches tire specs by brand + pattern name for cross-referencing
 * TireWeb results with WheelPros spec data.
 * 
 * Usage: node scripts/create-tire-pattern-specs.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  console.log('=== Creating tire_pattern_specs table ===\n');
  
  // Create table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tire_pattern_specs (
      id SERIAL PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      pattern_name VARCHAR(200) NOT NULL,
      pattern_key VARCHAR(300) NOT NULL UNIQUE, -- LOWER(brand || ':' || pattern_name)
      
      -- Spec fields
      utqg VARCHAR(50),
      treadwear INTEGER,
      traction VARCHAR(10),
      temperature VARCHAR(10),
      tread_depth NUMERIC(4,1),
      terrain VARCHAR(100),
      mileage_warranty INTEGER,
      
      -- Metadata
      source VARCHAR(50) DEFAULT 'wheelpros',
      sample_sku VARCHAR(50),
      sample_count INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✓ Table created');
  
  // Create index
  await pool.query(`
    CREATE INDEX IF NOT EXISTS tire_pattern_specs_brand_idx ON tire_pattern_specs(LOWER(brand))
  `);
  console.log('✓ Index created');
  
  // Populate from WheelPros data
  // Extract pattern name from tire_description (first word after brand)
  const insertResult = await pool.query(`
    INSERT INTO tire_pattern_specs (brand, pattern_name, pattern_key, utqg, treadwear, traction, temperature, tread_depth, terrain, mileage_warranty, sample_sku, sample_count)
    SELECT 
      MAX(brand_desc) as brand,
      MAX(SPLIT_PART(tire_description, ' ', 1)) as pattern_name,
      pattern_key,
      MAX(raw->>'utqg') as utqg,
      MAX(NULLIF(raw->>'treadwear', '')::numeric)::integer as treadwear,
      MAX(raw->>'traction') as traction,
      MAX(raw->>'temperature') as temperature,
      MAX(NULLIF(raw->>'tread_depth', '')::numeric) as tread_depth,
      MAX(terrain) as terrain,
      MAX(NULLIF(mileage_warranty, '')::integer) as mileage_warranty,
      MIN(sku) as sample_sku,
      COUNT(*) as sample_count
    FROM (
      SELECT 
        *,
        LOWER(brand_desc || ':' || SPLIT_PART(tire_description, ' ', 1)) as pattern_key
      FROM wp_tires
      WHERE raw->>'utqg' IS NOT NULL 
        AND raw->>'utqg' != ''
        AND brand_desc IS NOT NULL
        AND tire_description IS NOT NULL
    ) sub
    GROUP BY pattern_key
    ON CONFLICT (pattern_key) DO UPDATE SET
      utqg = COALESCE(EXCLUDED.utqg, tire_pattern_specs.utqg),
      treadwear = COALESCE(EXCLUDED.treadwear, tire_pattern_specs.treadwear),
      traction = COALESCE(EXCLUDED.traction, tire_pattern_specs.traction),
      temperature = COALESCE(EXCLUDED.temperature, tire_pattern_specs.temperature),
      tread_depth = COALESCE(EXCLUDED.tread_depth, tire_pattern_specs.tread_depth),
      terrain = COALESCE(EXCLUDED.terrain, tire_pattern_specs.terrain),
      mileage_warranty = COALESCE(EXCLUDED.mileage_warranty, tire_pattern_specs.mileage_warranty),
      sample_count = EXCLUDED.sample_count,
      updated_at = NOW()
  `);
  console.log(`✓ Populated ${insertResult.rowCount} patterns from WheelPros`);
  
  // Show stats
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_patterns,
      COUNT(utqg) as with_utqg,
      COUNT(mileage_warranty) as with_warranty,
      COUNT(terrain) as with_terrain,
      COUNT(tread_depth) as with_tread_depth
    FROM tire_pattern_specs
  `);
  console.log('\n=== Stats ===');
  console.log(stats.rows[0]);
  
  // Show sample data
  const samples = await pool.query(`
    SELECT brand, pattern_name, utqg, mileage_warranty, terrain, tread_depth
    FROM tire_pattern_specs
    ORDER BY sample_count DESC
    LIMIT 10
  `);
  console.log('\n=== Top Patterns (by size count) ===');
  console.table(samples.rows);
  
  await pool.end();
}

main().catch(console.error);
