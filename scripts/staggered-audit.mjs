#!/usr/bin/env node
/**
 * Audit current staggered vehicle data
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function audit() {
  console.log('='.repeat(60));
  console.log('TIER A STAGGERED DATA AUDIT');
  console.log('='.repeat(60));
  
  // Check Camaro
  console.log('\n=== CHEVROLET CAMARO (2020+) ===');
  const camaro = await pool.query(`
    SELECT year, modification_id as mod, display_trim, 
           wheel_diameter as dia, wheel_width as width, 
           tire_size, axle, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Chevrolet' AND model = 'Camaro'
    AND year >= 2020
    ORDER BY year DESC, modification_id, axle
  `);
  
  if (camaro.rows.length === 0) {
    console.log('  ❌ NO DATA FOUND');
  } else {
    const byTrim = {};
    for (const row of camaro.rows) {
      const key = `${row.year} ${row.mod}`;
      if (!byTrim[key]) byTrim[key] = [];
      byTrim[key].push(row);
    }
    for (const [key, rows] of Object.entries(byTrim)) {
      const hasAxle = rows.some(r => r.axle);
      const widths = [...new Set(rows.map(r => r.width))].filter(Boolean);
      const staggered = widths.length > 1 || rows.some(r => r.axle);
      console.log(`  ${key}: ${staggered ? '✓ STAGGERED' : '○ square'} widths=${widths.join('/')} axle=${hasAxle}`);
    }
  }
  
  // Check Challenger
  console.log('\n=== DODGE CHALLENGER (2020+) ===');
  const challenger = await pool.query(`
    SELECT year, modification_id as mod, display_trim,
           wheel_diameter as dia, wheel_width as width,
           tire_size, axle, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Dodge' AND model = 'Challenger'
    AND year >= 2020
    ORDER BY year DESC, modification_id, axle
  `);
  
  if (challenger.rows.length === 0) {
    console.log('  ❌ NO DATA FOUND');
  } else {
    const byTrim = {};
    for (const row of challenger.rows) {
      const key = `${row.year} ${row.mod}`;
      if (!byTrim[key]) byTrim[key] = [];
      byTrim[key].push(row);
    }
    for (const [key, rows] of Object.entries(byTrim)) {
      const hasAxle = rows.some(r => r.axle);
      const widths = [...new Set(rows.map(r => r.width))].filter(Boolean);
      const staggered = widths.length > 1 || rows.some(r => r.axle);
      console.log(`  ${key}: ${staggered ? '✓ STAGGERED' : '○ square'} widths=${widths.join('/')} axle=${hasAxle}`);
    }
  }
  
  // Check Mustang
  console.log('\n=== FORD MUSTANG (2020+) ===');
  const mustang = await pool.query(`
    SELECT year, modification_id as mod, display_trim,
           wheel_diameter as dia, wheel_width as width,
           tire_size, axle, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Ford' AND model = 'Mustang'
    AND year >= 2020
    ORDER BY year DESC, modification_id, axle
  `);
  
  if (mustang.rows.length === 0) {
    console.log('  ❌ NO DATA FOUND');
  } else {
    const byTrim = {};
    for (const row of mustang.rows) {
      const key = `${row.year} ${row.mod}`;
      if (!byTrim[key]) byTrim[key] = [];
      byTrim[key].push(row);
    }
    for (const [key, rows] of Object.entries(byTrim)) {
      const hasAxle = rows.some(r => r.axle);
      const widths = [...new Set(rows.map(r => r.width))].filter(Boolean);
      const staggered = widths.length > 1 || rows.some(r => r.axle);
      console.log(`  ${key}: ${staggered ? '✓ STAGGERED' : '○ square'} widths=${widths.join('/')} axle=${hasAxle}`);
    }
  }
  
  // Check Corvette
  console.log('\n=== CHEVROLET CORVETTE (2020+) ===');
  const corvette = await pool.query(`
    SELECT year, modification_id as mod, display_trim,
           wheel_diameter as dia, wheel_width as width,
           tire_size, axle, bolt_pattern
    FROM vehicle_fitments
    WHERE make = 'Chevrolet' AND model = 'Corvette'
    AND year >= 2020
    ORDER BY year DESC, modification_id, axle
  `);
  
  if (corvette.rows.length === 0) {
    console.log('  ❌ NO DATA FOUND');
  } else {
    const byTrim = {};
    for (const row of corvette.rows) {
      const key = `${row.year} ${row.mod}`;
      if (!byTrim[key]) byTrim[key] = [];
      byTrim[key].push(row);
    }
    for (const [key, rows] of Object.entries(byTrim)) {
      const hasAxle = rows.some(r => r.axle);
      const widths = [...new Set(rows.map(r => r.width))].filter(Boolean);
      const staggered = widths.length > 1 || rows.some(r => r.axle);
      console.log(`  ${key}: ${staggered ? '✓ STAGGERED' : '○ square'} widths=${widths.join('/')} axle=${hasAxle}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const totalCamaro = await pool.query(`SELECT COUNT(DISTINCT modification_id) as cnt FROM vehicle_fitments WHERE make='Chevrolet' AND model='Camaro' AND year >= 2020`);
  const totalChallenger = await pool.query(`SELECT COUNT(DISTINCT modification_id) as cnt FROM vehicle_fitments WHERE make='Dodge' AND model='Challenger' AND year >= 2020`);
  const totalMustang = await pool.query(`SELECT COUNT(DISTINCT modification_id) as cnt FROM vehicle_fitments WHERE make='Ford' AND model='Mustang' AND year >= 2020`);
  const totalCorvette = await pool.query(`SELECT COUNT(DISTINCT modification_id) as cnt FROM vehicle_fitments WHERE make='Chevrolet' AND model='Corvette' AND year >= 2020`);
  
  console.log(`Camaro trims:     ${totalCamaro.rows[0].cnt}`);
  console.log(`Challenger trims: ${totalChallenger.rows[0].cnt}`);
  console.log(`Mustang trims:    ${totalMustang.rows[0].cnt}`);
  console.log(`Corvette trims:   ${totalCorvette.rows[0].cnt}`);
  
  await pool.end();
}

audit().catch(console.error);
