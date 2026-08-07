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
    // 1. FIX LOWERCASE MAKES - Delete duplicates first
    // ============================================
    console.log('--- 1. MODEL NAME FIXES ---\n');
    
    // For lowercase makes, we need to delete them if there's already a proper case version
    const lowercaseMakes = ['chevrolet', 'gmc', 'ram', 'ford', 'dodge'];
    
    for (const lcMake of lowercaseMakes) {
      const properMake = lcMake.charAt(0).toUpperCase() + lcMake.slice(1);
      if (lcMake === 'gmc') continue; // GMC is special
      
      // Find records that would be duplicates
      const dupes = await client.query(`
        SELECT lc.id, lc.year, lc.model, lc.display_trim
        FROM vehicle_fitments lc
        WHERE lc.make = $1
        AND EXISTS (
          SELECT 1 FROM vehicle_fitments uc 
          WHERE uc.make = $2 AND uc.year = lc.year AND uc.model = lc.model 
            AND COALESCE(uc.display_trim, '') = COALESCE(lc.display_trim, '')
        )
      `, [lcMake, properMake]);
      
      if (dupes.rows.length > 0) {
        console.log(`Deleting ${dupes.rows.length} duplicate "${lcMake}" records (proper case exists)`);
        if (!dryRun) {
          for (const d of dupes.rows) {
            await client.query(`DELETE FROM vehicle_fitments WHERE id = $1`, [d.id]);
          }
          console.log(`  ✅ Deleted`);
        }
      }
      
      // Now update remaining lowercase to proper case
      const remaining = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1
      `, [lcMake]);
      
      if (parseInt(remaining.rows[0].cnt) > 0) {
        console.log(`Updating ${remaining.rows[0].cnt} "${lcMake}" -> "${properMake}"`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET make = $1, updated_at = NOW() WHERE make = $2`, [properMake, lcMake]);
          console.log(`  ✅ Updated`);
        }
      }
    }
    
    // GMC special handling
    const gmcDupes = await client.query(`
      SELECT lc.id FROM vehicle_fitments lc
      WHERE lc.make = 'gmc'
      AND EXISTS (
        SELECT 1 FROM vehicle_fitments uc 
        WHERE uc.make = 'GMC' AND uc.year = lc.year AND uc.model = lc.model 
          AND COALESCE(uc.display_trim, '') = COALESCE(lc.display_trim, '')
      )
    `);
    if (gmcDupes.rows.length > 0) {
      console.log(`Deleting ${gmcDupes.rows.length} duplicate "gmc" records`);
      if (!dryRun) {
        for (const d of gmcDupes.rows) {
          await client.query(`DELETE FROM vehicle_fitments WHERE id = $1`, [d.id]);
        }
        console.log(`  ✅ Deleted`);
      }
    }
    const gmcRemaining = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'gmc'`);
    if (parseInt(gmcRemaining.rows[0].cnt) > 0) {
      console.log(`Updating ${gmcRemaining.rows[0].cnt} "gmc" -> "GMC"`);
      if (!dryRun) {
        await client.query(`UPDATE vehicle_fitments SET make = 'GMC', updated_at = NOW() WHERE make = 'gmc'`);
        console.log(`  ✅ Updated`);
      }
    }
    
    // ============================================
    // 1b. FIX RAM MODEL NAMES
    // ============================================
    console.log('\n--- 1b. RAM MODEL FIXES ---\n');
    
    const ramModelFixes = [
      { from: 'Ram 1500', to: '1500' },
      { from: 'Ram 2500', to: '2500' },
      { from: 'Ram 3500', to: '3500' },
      { from: '1500-classic', to: '1500 Classic' },
      { from: '1500-trx', to: '1500 TRX' },
      { from: 'ram-1500-classic', to: '1500 Classic' },
      { from: 'promaster-1500', to: 'ProMaster 1500' },
      { from: 'c-v', to: 'C/V' },
    ];
    
    for (const fix of ramModelFixes) {
      // Check for duplicates first
      const dupes = await client.query(`
        SELECT lc.id FROM vehicle_fitments lc
        WHERE lc.make = 'RAM' AND lc.model = $1
        AND EXISTS (
          SELECT 1 FROM vehicle_fitments uc 
          WHERE uc.make = 'RAM' AND uc.model = $2 AND uc.year = lc.year
            AND COALESCE(uc.display_trim, '') = COALESCE(lc.display_trim, '')
        )
      `, [fix.from, fix.to]);
      
      if (dupes.rows.length > 0) {
        console.log(`Deleting ${dupes.rows.length} duplicate RAM "${fix.from}" records`);
        if (!dryRun) {
          for (const d of dupes.rows) {
            await client.query(`DELETE FROM vehicle_fitments WHERE id = $1`, [d.id]);
          }
        }
      }
      
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'RAM' AND model = $1
      `, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`RAM "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'RAM' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 1c. FIX DODGE RAM MODEL NAMES
    // ============================================
    console.log('\n--- 1c. DODGE RAM MODEL FIXES ---\n');
    
    const dodgeRamFixes = [
      { from: 'ram-1500', to: 'Ram 1500' },
      { from: 'ram-2500', to: 'Ram 2500' },
      { from: 'ram-3500', to: 'Ram 3500' },
    ];
    
    for (const fix of dodgeRamFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'Dodge' AND model = $1
      `, [fix.from]);
      if (parseInt(result.rows[0].cnt) > 0) {
        console.log(`Dodge "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
        if (!dryRun) {
          await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = 'Dodge' AND model = $2`, [fix.to, fix.from]);
          console.log(`  ✅ Fixed`);
        }
      }
    }
    
    // ============================================
    // 1d. FIX CHEVY MODEL NAMES
    // ============================================
    console.log('\n--- 1d. CHEVY MODEL FIXES ---\n');
    
    const chevyModelFixes = [
      { from: 'avalanche-1500', to: 'Avalanche 1500' },
      { from: 'avalanche-2500', to: 'Avalanche 2500' },
      { from: 'express-1500', to: 'Express 1500' },
      { from: 'express-2500', to: 'Express 2500' },
      { from: 'silverado-2500', to: 'Silverado 2500' },
      { from: 'suburban-1500', to: 'Suburban 1500' },
      { from: 'suburban-2500', to: 'Suburban 2500' },
      { from: 'savana-2500', to: 'Savana 2500' },
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
    
    // GMC savana
    const gmcSavana = await client.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = 'GMC' AND model = 'savana-2500'`);
    if (parseInt(gmcSavana.rows[0].cnt) > 0) {
      console.log(`GMC "savana-2500" -> "Savana 2500": ${gmcSavana.rows[0].cnt} records`);
      if (!dryRun) {
        await client.query(`UPDATE vehicle_fitments SET model = 'Savana 2500', updated_at = NOW() WHERE make = 'GMC' AND model = 'savana-2500'`);
        console.log(`  ✅ Fixed`);
      }
    }
    
    // ============================================
    // 2. FIX CORVETTE HUB BORE
    // ============================================
    console.log('\n\n--- 2. CORVETTE HUB BORE FIX ---\n');
    
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
      console.log(`  ✅ Fixed to 70.3mm`);
    }
    
    // ============================================
    // 3. FIX MISSING HUB BORES
    // ============================================
    console.log('\n\n--- 3. MISSING HUB BORE FIXES ---\n');
    
    const f350Check = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make = 'Ford' AND model ILIKE '%F-350%' AND center_bore_mm IS NULL
    `);
    console.log(`F-350 records with missing hub bore: ${f350Check.rows[0].cnt}`);
    
    if (!dryRun && parseInt(f350Check.rows[0].cnt) > 0) {
      await client.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = 142.0, updated_at = NOW()
        WHERE make = 'Ford' AND model ILIKE '%F-350%' AND center_bore_mm IS NULL
      `);
      console.log(`  ✅ Fixed to 142.0mm`);
    }
    
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
        console.log(`  ✅ Fixed to 70.5mm`);
      }
    }
    
    // ============================================
    // 4. ADD MISSING BRONCO SPORT
    // ============================================
    console.log('\n\n--- 4. ADD BRONCO SPORT 2021-2024 ---\n');
    
    const broncoSportYears = [2021, 2022, 2023, 2024];
    const broncoSportTrims = ['Base', 'Big Bend', 'Outer Banks', 'Badlands'];
    
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
              ) VALUES ($1, $2, 'Ford', 'Bronco Sport', $3, $4,
                '5x108', 63.4, 'M12x1.5', 'Conical', 40, 55, $5, $6,
                'complete', 'HIGH', 'manual-research', NOW(), NOW())
            `, [uuidv4(), year, trim, modId,
              JSON.stringify([{ diameter: 17, width: 7, offset: 45 }, { diameter: 18, width: 7.5, offset: 48 }]),
              JSON.stringify(['225/65R17', '225/60R18'])]);
          }
          broncoAdded++;
        }
      }
    }
    console.log(`Bronco Sport records to add: ${broncoAdded}`);
    if (!dryRun && broncoAdded > 0) console.log(`  ✅ Added`);
    
    // ============================================
    // 5. ADD MISSING CRUZE
    // ============================================
    console.log('\n\n--- 5. ADD CRUZE 2011-2017, 2019 ---\n');
    
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
              ) VALUES ($1, $2, 'Chevrolet', 'Cruze', $3, $4,
                '5x105', 56.6, 'M12x1.5', 'Conical', 35, 50, $5, $6,
                'complete', 'MEDIUM', 'manual-research', NOW(), NOW())
            `, [uuidv4(), year, trim, modId,
              JSON.stringify([{ diameter: 16, width: 6.5, offset: 39 }, { diameter: 17, width: 7, offset: 42 }]),
              JSON.stringify(['P215/60R16', 'P225/50R17'])]);
          }
          cruzeAdded++;
        }
      }
    }
    console.log(`Cruze records to add: ${cruzeAdded}`);
    if (!dryRun && cruzeAdded > 0) console.log(`  ✅ Added`);
    
    console.log(dryRun ? '\n\n--- DRY RUN COMPLETE ---' : '\n\n--- ALL FIXES APPLIED ---');
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
