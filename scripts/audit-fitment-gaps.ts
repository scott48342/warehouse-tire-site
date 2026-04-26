import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function auditFitmentGaps() {
  console.log('🔍 Auditing vehicle fitments for 2000-2026...\n');

  // Find records with "Base" trim or empty/null trim
  const baseTrimsResult = await pool.query(`
    SELECT year, make, model, submodel 
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (LOWER(submodel) = 'base' OR submodel = '' OR submodel IS NULL)
    ORDER BY make, model, year
  `);

  console.log(`❌ Records with "Base" or empty trim: ${baseTrimsResult.rowCount}`);
  if (baseTrimsResult.rowCount && baseTrimsResult.rowCount > 0) {
    const grouped: Record<string, any[]> = {};
    for (const r of baseTrimsResult.rows) {
      const key = `${r.make} ${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    
    console.log('\nBy Make/Model (top 30):');
    const sorted = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 30);
    for (const [key, records] of sorted) {
      const years = [...new Set(records.map(r => r.year))].sort((a, b) => a - b);
      const yearRange = years.length > 3 
        ? `${Math.min(...years)}-${Math.max(...years)} (${years.length} years)`
        : years.join(', ');
      console.log(`  ${key}: ${records.length} records | Years: ${yearRange}`);
    }
    if (Object.keys(grouped).length > 30) {
      console.log(`  ... and ${Object.keys(grouped).length - 30} more models`);
    }
  }

  // Find records missing wheel data (text comparison only)
  const missingWheelResult = await pool.query(`
    SELECT year, make, model, submodel
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes::text = '[]' 
        OR oem_wheel_sizes::text = 'null'
        OR oem_wheel_sizes::text = ''
      )
    ORDER BY make, model, year
  `);

  console.log(`\n❌ Records missing wheel sizes: ${missingWheelResult.rowCount}`);
  if (missingWheelResult.rowCount && missingWheelResult.rowCount > 0) {
    const grouped: Record<string, any[]> = {};
    for (const r of missingWheelResult.rows) {
      const key = `${r.make} ${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    
    console.log('\nBy Make/Model (top 20):');
    const sorted = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 20);
    for (const [key, records] of sorted) {
      console.log(`  ${key}: ${records.length} records`);
    }
    if (Object.keys(grouped).length > 20) {
      console.log(`  ... and ${Object.keys(grouped).length - 20} more models`);
    }
  }

  // Find records missing tire data
  const missingTireResult = await pool.query(`
    SELECT year, make, model, submodel
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (
        oem_tire_sizes IS NULL 
        OR oem_tire_sizes::text = '[]' 
        OR oem_tire_sizes::text = 'null'
        OR oem_tire_sizes::text = ''
      )
    ORDER BY make, model, year
  `);

  console.log(`\n❌ Records missing tire sizes: ${missingTireResult.rowCount}`);
  if (missingTireResult.rowCount && missingTireResult.rowCount > 0) {
    const grouped: Record<string, any[]> = {};
    for (const r of missingTireResult.rows) {
      const key = `${r.make} ${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    
    console.log('\nBy Make/Model (top 20):');
    const sorted = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 20);
    for (const [key, records] of sorted) {
      console.log(`  ${key}: ${records.length} records`);
    }
    if (Object.keys(grouped).length > 20) {
      console.log(`  ... and ${Object.keys(grouped).length - 20} more models`);
    }
  }

  // Find records missing bolt pattern
  const missingBoltResult = await pool.query(`
    SELECT year, make, model, submodel
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND (bolt_pattern IS NULL OR bolt_pattern = '')
    ORDER BY make, model, year
  `);

  console.log(`\n❌ Records missing bolt pattern: ${missingBoltResult.rowCount}`);
  if (missingBoltResult.rowCount && missingBoltResult.rowCount > 0) {
    const grouped: Record<string, any[]> = {};
    for (const r of missingBoltResult.rows) {
      const key = `${r.make} ${r.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    
    console.log('\nBy Make/Model (top 20):');
    const sorted = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).slice(0, 20);
    for (const [key, records] of sorted) {
      console.log(`  ${key}: ${records.length} records`);
    }
    if (Object.keys(grouped).length > 20) {
      console.log(`  ... and ${Object.keys(grouped).length - 20} more models`);
    }
  }

  // Summary
  const totalResult = await pool.query(`SELECT COUNT(*) as count FROM vehicle_fitments WHERE year >= 2000`);
  const completeResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND submodel IS NOT NULL 
      AND LOWER(submodel) NOT IN ('base', '')
      AND bolt_pattern IS NOT NULL AND bolt_pattern != ''
      AND oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes::text NOT IN ('[]', 'null', '')
      AND oem_tire_sizes IS NOT NULL AND oem_tire_sizes::text NOT IN ('[]', 'null', '')
  `);

  const total = parseInt(totalResult.rows[0].count);
  const complete = parseInt(completeResult.rows[0].count);

  console.log('\n📊 Summary:');
  console.log(`  Total 2000+ records: ${total.toLocaleString()}`);
  console.log(`  Complete records: ${complete.toLocaleString()}`);
  console.log(`  Completion rate: ${((complete / total) * 100).toFixed(1)}%`);
  console.log(`  Gaps to fix: ${(total - complete).toLocaleString()}`);

  await pool.end();
}

auditFitmentGaps().catch(console.error);
