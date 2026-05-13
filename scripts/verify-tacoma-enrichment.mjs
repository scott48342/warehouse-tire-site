#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

async function main() {
  console.log('═'.repeat(60));
  console.log('VERIFICATION: 2024 Toyota Tacoma Config Enrichment');
  console.log('═'.repeat(60));
  
  // Check total rows
  const total = await pool.query(`
    SELECT COUNT(*) as count FROM vehicle_fitment_configurations
    WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
  `);
  console.log(`\n✅ Total config rows: ${total.rows[0].count}`);
  
  // Check for duplicates (same tire_size appearing twice)
  const dupes = await pool.query(`
    SELECT tire_size, COUNT(*) as cnt
    FROM vehicle_fitment_configurations
    WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
    GROUP BY tire_size
    HAVING COUNT(*) > 1
  `);
  if (dupes.rows.length === 0) {
    console.log('✅ No duplicate sizes');
  } else {
    console.log('❌ Duplicate sizes found:');
    dupes.rows.forEach(r => console.log(`   ${r.tire_size}: ${r.cnt} occurrences`));
  }
  
  // List all unique tire sizes
  const sizes = await pool.query(`
    SELECT DISTINCT tire_size, wheel_diameter, is_optional, source
    FROM vehicle_fitment_configurations
    WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
    ORDER BY wheel_diameter, tire_size
  `);
  console.log('\n📋 All tire sizes:');
  sizes.rows.forEach(r => {
    const tag = r.source === 'usaf_enrichment' ? ' [NEW - USAF]' : '';
    console.log(`   ${r.tire_size} (${r.wheel_diameter}") optional=${r.is_optional}${tag}`);
  });
  
  // Check diameter groups
  const diameters = await pool.query(`
    SELECT DISTINCT wheel_diameter
    FROM vehicle_fitment_configurations
    WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
    ORDER BY wheel_diameter
  `);
  const diameterList = diameters.rows.map(r => `${r.wheel_diameter}"`).join(', ');
  console.log(`\n✅ Diameter groups: ${diameterList}`);
  
  // Verify USAF rows
  const usafRows = await pool.query(`
    SELECT id, tire_size, wheel_diameter, axle_position, is_default, is_optional, source
    FROM vehicle_fitment_configurations
    WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
      AND source = 'usaf_enrichment'
    ORDER BY wheel_diameter
  `);
  console.log(`\n✅ USAF enrichment rows: ${usafRows.rows.length}`);
  usafRows.rows.forEach(r => {
    console.log(`   ${r.tire_size} (${r.wheel_diameter}")`);
    console.log(`     ID: ${r.id}`);
    console.log(`     axle_position: ${r.axle_position}`);
    console.log(`     is_default: ${r.is_default}`);
    console.log(`     is_optional: ${r.is_optional}`);
  });
  
  console.log('\n' + '═'.repeat(60));
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
