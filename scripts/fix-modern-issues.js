require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== FIXING MODERN ISSUES ===\n');
    
    // ============================================
    // 1. FIX MODEL NAME INCONSISTENCIES
    // ============================================
    console.log('--- 1. MODEL NAME FIXES ---\n');
    
    // Fix lowercase makes
    const makeFixes = [
      { from: 'chevrolet', to: 'Chevrolet' },
      { from: 'gmc', to: 'GMC' },
      { from: 'ram', to: 'RAM' },
      { from: 'ford', to: 'Ford' },
      { from: 'dodge', to: 'Dodge' },
    ];
    
    for (const fix of makeFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1
      `, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`Make "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET make = $1, updated_at = NOW() WHERE make = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // Fix RAM model names - "Ram 1500" should just be "1500" under make "RAM"
    // But actually the pattern "RAM Ram 1500" is redundant - should be "RAM 1500"
    const ramModelFixes = [
      { make: 'RAM', from: 'Ram 1500', to: '1500' },
      { make: 'RAM', from: 'Ram 2500', to: '2500' },
      { make: 'RAM', from: 'Ram 3500', to: '3500' },
      { make: 'RAM', from: 'ram-1500', to: '1500' },
      { make: 'RAM', from: 'ram-2500', to: '2500' },
      { make: 'RAM', from: 'ram-3500', to: '3500' },
      { make: 'RAM', from: '1500-classic', to: '1500 Classic' },
      { make: 'RAM', from: '1500-trx', to: '1500 TRX' },
      { make: 'RAM', from: 'ram-1500-classic', to: '1500 Classic' },
      { make: 'RAM', from: 'promaster-1500', to: 'ProMaster 1500' },
      { make: 'RAM', from: 'promaster', to: 'ProMaster' },
      { make: 'RAM', from: 'c-v', to: 'C/V' },
    ];
    
    for (const fix of ramModelFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1 AND model = $2
      `, [fix.make, fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`${fix.make} "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = $2 AND model = $3`, [fix.to, fix.make, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // Also fix Dodge ram models (pre-2010)
    const dodgeRamFixes = [
      { make: 'Dodge', from: 'ram-1500', to: 'Ram 1500' },
      { make: 'Dodge', from: 'ram-2500', to: 'Ram 2500' },
      { make: 'Dodge', from: 'ram-3500', to: 'Ram 3500' },
    ];
    
    for (const fix of dodgeRamFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1 AND model = $2
      `, [fix.make, fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`${fix.make} "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = $2 AND model = $3`, [fix.to, fix.make, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // Fix Chevy model names with hyphens
    const chevyModelFixes = [
      { from: 'avalanche-1500', to: 'Avalanche 1500' },
      { from: 'avalanche-2500', to: 'Avalanche 2500' },
      { from: 'express-1500', to: 'Express 1500' },
      { from: 'express-2500', to: 'Express 2500' },
      { from: 'silverado-2500', to: 'Silverado 2500' },
      { from: 'suburban-1500', to: 'Suburban 1500' },
      { from: 'suburban-2500', to: 'Suburban 2500' },
    ];
    
    for (const fix of chevyModelFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = $1
      `, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`Chevrolet "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'Chevrolet' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // Fix GMC model names
    const gmcModelFixes = [
      { from: 'savana-2500', to: 'Savana 2500' },
    ];
    
    for (const fix of gmcModelFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'GMC' AND model = $1
      `, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`GMC "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'GMC' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 2. FIX CORVETTE HUB BORE
    // ============================================
    console.log('\n\n--- 2. CORVETTE HUB BORE FIX ---\n');
    
    // C8 Corvette (2020+) should be 70.3mm hub bore
    const corvetteCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make = 'Chevrolet' AND model ILIKE '%corvette%' 
        AND year >= 2020 AND center_bore_mm != 70.3
    `);
    console.log(`C8 Corvette records with incorrect hub bore: ${corvetteCheck.rows[0].cnt}`);
    
    if (!dryRun && parseInt(corvetteCheck.rows[0].cnt) > 0) {
      await client.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = 70.3, updated_at = NOW()
        WHERE make = 'Chevrolet' AND model ILIKE '%corvette%' 
          AND year >= 2020 AND center_bore_mm != 70.3
      `);
      console.log(`  ✅ Fixed ${corvetteCheck.rows[0].cnt} records to 70.3mm`);
    }
    
    // ============================================
    // 3. FIX MISSING HUB BORES (F-350 DRW)
    // ============================================
    console.log('\n\n--- 3. F-350 DRW HUB BORE FIX ---\n');
    
    // F-350 Super Duty DRW (Dually) uses 8x200 bolt pattern, 142mm hub bore
    const f350Check = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make = 'Ford' AND model ILIKE '%F-350%' 
        AND center_bore_mm IS NULL
    `);
    console.log(`F-350 records with missing hub bore: ${f350Check.rows[0].cnt}`);
    
    if (!dryRun && parseInt(f350Check.rows[0].cnt) > 0) {
      // DRW (dually) F-350s use 8x200, 142mm hub
      await client.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = 142.0, updated_at = NOW()
        WHERE make = 'Ford' AND model ILIKE '%F-350%' 
          AND center_bore_mm IS NULL
          AND display_trim ILIKE '%DRW%'
      `);
      console.log(`  ✅ Fixed DRW records to 142.0mm`);
    }
    
    // Fix Ford GT hub bore (5x114.3, 70.5mm)
    const fordGTCheck = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make = 'Ford' AND model = 'GT' AND center_bore_mm IS NULL
    `);
    if (parseInt(fordGTCheck.rows[0].cnt) > 0) {
      console.log(`Ford GT records with missing hub bore: ${fordGTCheck.rows[0].cnt}`);
      if (!dryRun) {
        await client.query(`
          UPDATE vehicle_fitments 
          SET center_bore_mm = 70.5, updated_at = NOW()
          WHERE make = 'Ford' AND model = 'GT' AND center_bore_mm IS NULL
        `);
        console.log(`  ✅ Fixed Ford GT to 70.5mm`);
      }
    }
    
    // ============================================
    // 4. ADD MISSING BRONCO SPORT (2021-2024)
    // ============================================
    console.log('\n\n--- 4. ADD BRONCO SPORT 2021-2024 ---\n');
    
    // Ford Bronco Sport: 5x108, 63.4mm hub, M12x1.5
    const broncoSportYears = [2021, 2022, 2023, 2024];
    const broncoSportTrims = ['Base', 'Big Bend', 'Outer Banks', 'Badlands', 'Heritage'];
    
    let broncoAdded = 0;
    for (const year of broncoSportYears) {
      for (const trim of broncoSportTrims) {
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments 
          WHERE make = 'Ford' AND model = 'Bronco Sport' AND year = $1 AND display_trim = $2
        `, [year, trim]);
        
        if (existing.rows.length === 0) {
          if (!dryRun) {
            const modId = `ford-bronco-sport-${trim.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().slice(0, 8)}`;
            await client.query(`
              INSERT INTO vehicle_fitments (
                id, year, make, model, display_trim, modification_id,
                bolt_pattern, center_bore_mm, thread_size, seat_type,
                offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
                quality_tier, confidence_tag, source, created_at, updated_at
              ) VALUES (
                $1, $2, 'Ford', 'Bronco Sport', $3, $4,
                '5x108', 63.4, 'M12x1.5', 'Conical',
                40, 55, $5, $6,
                'complete', 'HIGH', 'manual-research', NOW(), NOW()
              )
            `, [
              uuidv4(), year, trim, modId,
              JSON.stringify([{ diameter: 17, width: 7, offset: 45 }, { diameter: 18, width: 7.5, offset: 48 }]),
              JSON.stringify(['225/65R17', '225/60R18'])
            ]);
          }
          broncoAdded++;
        }
      }
    }
    console.log(`Bronco Sport records to add: ${broncoAdded}`);
    if (!dryRun && broncoAdded > 0) {
      console.log(`  ✅ Added ${broncoAdded} records`);
    }
    
    // ============================================
    // 5. ADD MISSING CRUZE (2011-2017, 2019)
    // ============================================
    console.log('\n\n--- 5. ADD CRUZE 2011-2017, 2019 ---\n');
    
    // Chevy Cruze: 5x105, 56.6mm hub, M12x1.5
    const cruzeYears = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2019];
    const cruzeTrims = ['LS', 'LT', 'LTZ', 'Eco'];
    
    let cruzeAdded = 0;
    for (const year of cruzeYears) {
      for (const trim of cruzeTrims) {
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments 
          WHERE make = 'Chevrolet' AND model ILIKE '%cruze%' AND year = $1 AND display_trim = $2
        `, [year, trim]);
        
        if (existing.rows.length === 0) {
          if (!dryRun) {
            const modId = `chevrolet-cruze-${trim.toLowerCase()}-${uuidv4().slice(0, 8)}`;
            await client.query(`
              INSERT INTO vehicle_fitments (
                id, year, make, model, display_trim, modification_id,
                bolt_pattern, center_bore_mm, thread_size, seat_type,
                offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
                quality_tier, confidence_tag, source, created_at, updated_at
              ) VALUES (
                $1, $2, 'Chevrolet', 'Cruze', $3, $4,
                '5x105', 56.6, 'M12x1.5', 'Conical',
                35, 50, $5, $6,
                'complete', 'MEDIUM', 'manual-research', NOW(), NOW()
              )
            `, [
              uuidv4(), year, trim, modId,
              JSON.stringify([{ diameter: 16, width: 6.5, offset: 39 }, { diameter: 17, width: 7, offset: 42 }, { diameter: 18, width: 7.5, offset: 42 }]),
              JSON.stringify(['P215/60R16', 'P225/50R17', 'P225/45R18'])
            ]);
          }
          cruzeAdded++;
        }
      }
    }
    console.log(`Cruze records to add: ${cruzeAdded}`);
    if (!dryRun && cruzeAdded > 0) {
      console.log(`  ✅ Added ${cruzeAdded} records`);
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    if (dryRun) {
      console.log('\n\n--- DRY RUN COMPLETE ---');
      console.log('Run without --dry-run to apply fixes.');
    } else {
      console.log('\n\n--- ALL FIXES APPLIED ---');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
