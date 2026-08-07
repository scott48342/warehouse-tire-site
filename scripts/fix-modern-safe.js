require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== FIXING MODERN ISSUES (SAFE) ===\n');
    
    // ============================================
    // 1. DELETE ALL LOWERCASE MAKE DUPLICATES
    // ============================================
    console.log('--- 1. CLEANING UP LOWERCASE MAKE RECORDS ---\n');
    
    // Just delete all lowercase make records - they're duplicates
    const lcMakes = await client.query(`
      SELECT id, year, make, model, display_trim FROM vehicle_fitments
      WHERE make ~ '^[a-z]'
      ORDER BY make, model, year
    `);
    
    console.log(`Found ${lcMakes.rows.length} records with lowercase makes`);
    
    if (!dryRun && lcMakes.rows.length > 0) {
      // Delete them
      await client.query(`DELETE FROM vehicle_fitments WHERE make ~ '^[a-z]'`);
      console.log(`  ✅ Deleted ${lcMakes.rows.length} lowercase make records`);
    }
    
    // ============================================
    // 2. FIX RAM MODEL NAMES
    // ============================================
    console.log('\n--- 2. RAM MODEL FIXES ---\n');
    
    const ramFixes = [
      { from: 'Ram 1500', to: '1500' },
      { from: 'Ram 2500', to: '2500' },
      { from: 'Ram 3500', to: '3500' },
      { from: '1500-classic', to: '1500 Classic' },
      { from: '1500-trx', to: '1500 TRX' },
      { from: 'ram-1500-classic', to: '1500 Classic' },
      { from: 'promaster-1500', to: 'ProMaster 1500' },
      { from: 'c-v', to: 'C/V' },
    ];
    
    for (const fix of ramFixes) {
      const result = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'RAM' AND model = $1`, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`RAM "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'RAM' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 3. FIX DODGE RAM MODEL NAMES  
    // ============================================
    console.log('\n--- 3. DODGE RAM MODEL FIXES ---\n');
    
    const dodgeFixes = [
      { from: 'ram-1500', to: 'Ram 1500' },
      { from: 'ram-2500', to: 'Ram 2500' },
      { from: 'ram-3500', to: 'Ram 3500' },
    ];
    
    for (const fix of dodgeFixes) {
      const result = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Dodge' AND model = $1`, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`Dodge "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'Dodge' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 4. FIX CHEVY/GMC HYPHENATED MODEL NAMES
    // ============================================
    console.log('\n--- 4. CHEVY/GMC MODEL FIXES ---\n');
    
    const modelFixes = [
      { make: 'Chevrolet', from: 'avalanche-1500', to: 'Avalanche 1500' },
      { make: 'Chevrolet', from: 'avalanche-2500', to: 'Avalanche 2500' },
      { make: 'Chevrolet', from: 'express-1500', to: 'Express 1500' },
      { make: 'Chevrolet', from: 'express-2500', to: 'Express 2500' },
      { make: 'Chevrolet', from: 'silverado-2500', to: 'Silverado 2500' },
      { make: 'Chevrolet', from: 'suburban-1500', to: 'Suburban 1500' },
      { make: 'Chevrolet', from: 'suburban-2500', to: 'Suburban 2500' },
      { make: 'GMC', from: 'savana-2500', to: 'Savana 2500' },
    ];
    
    for (const fix of modelFixes) {
      const result = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1 AND model = $2`, [fix.make, fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`${fix.make} "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = $2 AND model = $3`, [fix.to, fix.make, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 5. FIX CORVETTE HUB BORE
    // ============================================
    console.log('\n--- 5. CORVETTE HUB BORE FIX ---\n');
    
    const corvetteCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make = 'Chevrolet' AND model ILIKE '%corvette%' 
        AND year >= 2020 AND center_bore_mm != 70.3
    `);
    console.log(`C8 Corvette records to fix: ${corvetteCheck.rows[0].cnt}`);
    
    if (!dryRun && parseInt(corvetteCheck.rows[0].cnt) > 0) {
      await client.query(`
        UPDATE vehicle_fitments SET center_bore_mm = 70.3, updated_at = NOW()
        WHERE make = 'Chevrolet' AND model ILIKE '%corvette%' AND year >= 2020 AND center_bore_mm != 70.3
      `);
      console.log(`  ✅ Fixed to 70.3mm`);
    }
    
    // ============================================
    // 6. FIX F-350 DRW HUB BORE
    // ============================================
    console.log('\n--- 6. F-350 DRW HUB BORE FIX ---\n');
    
    const f350Check = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Ford' AND model ILIKE '%F-350%' AND center_bore_mm IS NULL`);
    console.log(`F-350 records to fix: ${f350Check.rows[0].cnt}`);
    
    if (!dryRun && parseInt(f350Check.rows[0].cnt) > 0) {
      await client.query(`UPDATE vehicle_fitments SET center_bore_mm = 142.0, updated_at = NOW() WHERE make = 'Ford' AND model ILIKE '%F-350%' AND center_bore_mm IS NULL`);
      console.log(`  ✅ Fixed to 142.0mm`);
    }
    
    // ============================================
    // 7. FIX FORD GT HUB BORE
    // ============================================
    const gtCheck = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Ford' AND model = 'GT' AND center_bore_mm IS NULL`);
    if (parseInt(gtCheck.rows[0].cnt) > 0) {
      console.log(`\n--- 7. FORD GT HUB BORE FIX ---\n`);
      console.log(`Ford GT records to fix: ${gtCheck.rows[0].cnt}`);
      if (!dryRun) {
        await client.query(`UPDATE vehicle_fitments SET center_bore_mm = 70.5, updated_at = NOW() WHERE make = 'Ford' AND model = 'GT' AND center_bore_mm IS NULL`);
        console.log(`  ✅ Fixed to 70.5mm`);
      }
    }
    
    // ============================================
    // 8. ADD BRONCO SPORT
    // ============================================
    console.log('\n--- 8. ADD BRONCO SPORT 2021-2024 ---\n');
    
    let broncoAdded = 0;
    for (const year of [2021, 2022, 2023, 2024]) {
      for (const trim of ['Base', 'Big Bend', 'Outer Banks', 'Badlands']) {
        const existing = await client.query(`SELECT id FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Bronco Sport' AND year = $1 AND display_trim = $2`, [year, trim]);
        if (existing.rows.length === 0) {
          if (!dryRun) {
            await client.query(`
              INSERT INTO vehicle_fitments (id, year, make, model, display_trim, modification_id, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, quality_tier, confidence_tag, source, created_at, updated_at)
              VALUES ($1, $2, 'Ford', 'Bronco Sport', $3, $4, '5x108', 63.4, 'M12x1.5', 'Conical', 40, 55, $5, $6, 'complete', 'HIGH', 'manual-research', NOW(), NOW())
            `, [uuidv4(), year, trim, `ford-bronco-sport-${trim.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().slice(0, 8)}`,
              JSON.stringify([{ diameter: 17, width: 7, offset: 45 }, { diameter: 18, width: 7.5, offset: 48 }]),
              JSON.stringify(['225/65R17', '225/60R18'])]);
          }
          broncoAdded++;
        }
      }
    }
    console.log(`Bronco Sport records added: ${broncoAdded}`);
    if (!dryRun && broncoAdded > 0) console.log(`  ✅ Added`);
    
    // ============================================
    // 9. ADD CRUZE
    // ============================================
    console.log('\n--- 9. ADD CRUZE 2011-2017, 2019 ---\n');
    
    let cruzeAdded = 0;
    for (const year of [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2019]) {
      for (const trim of ['LS', 'LT', 'LTZ', 'Eco']) {
        const existing = await client.query(`SELECT id FROM vehicle_fitments WHERE make = 'Chevrolet' AND model ILIKE '%cruze%' AND year = $1 AND display_trim = $2`, [year, trim]);
        if (existing.rows.length === 0) {
          if (!dryRun) {
            await client.query(`
              INSERT INTO vehicle_fitments (id, year, make, model, display_trim, modification_id, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, quality_tier, confidence_tag, source, created_at, updated_at)
              VALUES ($1, $2, 'Chevrolet', 'Cruze', $3, $4, '5x105', 56.6, 'M12x1.5', 'Conical', 35, 50, $5, $6, 'complete', 'MEDIUM', 'manual-research', NOW(), NOW())
            `, [uuidv4(), year, trim, `chevrolet-cruze-${trim.toLowerCase()}-${uuidv4().slice(0, 8)}`,
              JSON.stringify([{ diameter: 16, width: 6.5, offset: 39 }, { diameter: 17, width: 7, offset: 42 }]),
              JSON.stringify(['P215/60R16', 'P225/50R17'])]);
          }
          cruzeAdded++;
        }
      }
    }
    console.log(`Cruze records added: ${cruzeAdded}`);
    if (!dryRun && cruzeAdded > 0) console.log(`  ✅ Added`);
    
    console.log(dryRun ? '\n\n--- DRY RUN COMPLETE ---' : '\n\n--- ALL FIXES APPLIED ---');
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
