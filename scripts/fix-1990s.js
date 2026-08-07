require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== FIXING 1990s FITMENT DATA ===\n');
    
    // ============================================
    // 1. FIX MODEL NAME INCONSISTENCIES
    // ============================================
    console.log('--- 1. MODEL NAME STANDARDIZATION ---\n');
    
    const modelFixes = [
      // Pontiac
      { make: 'Pontiac', from: 'grand-prix', to: 'Grand Prix' },
      { make: 'Pontiac', from: 'firebird', to: 'Firebird' },
      { make: 'Pontiac', from: 'bonneville', to: 'Bonneville' },
      // Toyota
      { make: 'Toyota', from: '4runner', to: '4Runner' },
      { make: 'Toyota', from: 'camry', to: 'Camry' },
      { make: 'Toyota', from: 'tacoma', to: 'Tacoma' },
      { make: 'Toyota', from: 'rav4', to: 'RAV4' },
      // Honda
      { make: 'Honda', from: 'accord', to: 'Accord' },
      { make: 'Honda', from: 'civic', to: 'Civic' },
      { make: 'Honda', from: 'cr-v', to: 'CR-V' },
      // Nissan
      { make: 'Nissan', from: 'altima', to: 'Altima' },
      { make: 'Nissan', from: 'maxima', to: 'Maxima' },
      { make: 'Nissan', from: 'pathfinder', to: 'Pathfinder' },
      { make: 'Nissan', from: 'sentra', to: 'Sentra' },
      // Mitsubishi
      { make: 'Mitsubishi', from: 'eclipse', to: 'Eclipse' },
      { make: 'Mitsubishi', from: 'galant', to: 'Galant' },
      { make: 'Mitsubishi', from: 'montero', to: 'Montero' },
      { make: 'Mitsubishi', from: '3000gt', to: '3000GT' },
      // Subaru
      { make: 'Subaru', from: 'forester', to: 'Forester' },
      { make: 'Subaru', from: 'legacy', to: 'Legacy' },
      { make: 'Subaru', from: 'outback', to: 'Outback' },
      // Lexus
      { make: 'Lexus', from: 'es', to: 'ES' },
      { make: 'Lexus', from: 'gs', to: 'GS' },
      { make: 'Lexus', from: 'is', to: 'IS' },
      { make: 'Lexus', from: 'ls', to: 'LS' },
      { make: 'Lexus', from: 'lx', to: 'LX' },
      { make: 'Lexus', from: 'rx', to: 'RX' },
      // Isuzu
      { make: 'Isuzu', from: 'rodeo', to: 'Rodeo' },
      { make: 'Isuzu', from: 'trooper', to: 'Trooper' },
      // Oldsmobile
      { make: 'Oldsmobile', from: 'cutlass', to: 'Cutlass' },
      { make: 'Oldsmobile', from: 'bravada', to: 'Bravada' },
      { make: 'Oldsmobile', from: 'intrigue', to: 'Intrigue' },
      { make: 'Oldsmobile', from: 'alero', to: 'Alero' },
      // Mercury
      { make: 'Mercury', from: 'sable', to: 'Sable' },
      { make: 'Mercury', from: 'grand-marquis', to: 'Grand Marquis' },
      { make: 'Mercury', from: 'cougar', to: 'Cougar' },
      { make: 'Mercury', from: 'mountaineer', to: 'Mountaineer' },
      // Plymouth
      { make: 'Plymouth', from: 'voyager', to: 'Voyager' },
      { make: 'Plymouth', from: 'prowler', to: 'Prowler' },
      // Buick
      { make: 'Buick', from: 'lesabre', to: 'LeSabre' },
      // Chevrolet
      { make: 'Chevrolet', from: 'tahoe', to: 'Tahoe' },
      { make: 'Chevrolet', from: 'corvette', to: 'Corvette' },
      { make: 'Chevrolet', from: 'camaro', to: 'Camaro' },
      { make: 'Chevrolet', from: 'suburban', to: 'Suburban' },
      { make: 'Chevrolet', from: 'malibu', to: 'Malibu' },
      { make: 'Chevrolet', from: 'impala', to: 'Impala' },
      { make: 'Chevrolet', from: 'lumina', to: 'Lumina' },
      { make: 'Chevrolet', from: 'caprice', to: 'Caprice' },
      // Ford
      { make: 'Ford', from: 'explorer', to: 'Explorer' },
      { make: 'Ford', from: 'mustang', to: 'Mustang' },
      { make: 'Ford', from: 'ranger', to: 'Ranger' },
      { make: 'Ford', from: 'f-150', to: 'F-150' },
      { make: 'Ford', from: 'f-250', to: 'F-250' },
      { make: 'Ford', from: 'f-350', to: 'F-350' },
      { make: 'Ford', from: 'expedition', to: 'Expedition' },
      { make: 'Ford', from: 'bronco', to: 'Bronco' },
      // Dodge
      { make: 'Dodge', from: 'durango', to: 'Durango' },
      { make: 'Dodge', from: 'stealth', to: 'Stealth' },
      // GMC
      { make: 'GMC', from: 'yukon', to: 'Yukon' },
      // Lincoln
      { make: 'Lincoln', from: 'continental', to: 'Continental' },
      { make: 'Lincoln', from: 'navigator', to: 'Navigator' },
      // Cadillac
      { make: 'Cadillac', from: 'escalade', to: 'Escalade' },
      { make: 'Cadillac', from: 'eldorado', to: 'Eldorado' },
      // Porsche
      { make: 'Porsche', from: 'boxster', to: 'Boxster' },
      // Suzuki
      { make: 'Suzuki', from: 'samurai', to: 'Samurai' },
      { make: 'Suzuki', from: 'grand-vitara', to: 'Grand Vitara' },
      // Audi
      { make: 'Audi', from: 'a3', to: 'A3' },
      { make: 'Audi', from: 'a4', to: 'A4' },
      { make: 'Audi', from: 'a6', to: 'A6' },
      // VW
      { make: 'Volkswagen', from: 'golf', to: 'Golf' },
      { make: 'Volkswagen', from: 'gti', to: 'GTI' },
      { make: 'Volkswagen', from: 'jetta', to: 'Jetta' },
      { make: 'Volkswagen', from: 'passat', to: 'Passat' },
      // Mercedes
      { make: 'Mercedes', from: 'c-class', to: 'C-Class' },
      { make: 'Mercedes', from: 'e-class', to: 'E-Class' },
      { make: 'Mercedes', from: 's-class', to: 'S-Class' },
      // Acura
      { make: 'Acura', from: 'tl', to: 'TL' },
      // Jeep
      { make: 'Jeep', from: 'wrangler', to: 'Wrangler' },
    ];
    
    for (const fix of modelFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments 
        WHERE make = $1 AND model = $2 AND year >= 1990 AND year <= 1999
      `, [fix.make, fix.from]);
      
      if (parseInt(result.rows[0].cnt) > 0) {
        // Check if target already exists to avoid duplicates
        const existing = await client.query(`
          SELECT COUNT(*) as cnt FROM vehicle_fitments 
          WHERE make = $1 AND model = $2 AND year >= 1990 AND year <= 1999
        `, [fix.make, fix.to]);
        
        if (parseInt(existing.rows[0].cnt) > 0) {
          // Delete the lowercase version since proper case exists
          console.log(`Deleting ${result.rows[0].cnt} duplicate "${fix.make} ${fix.from}" (keeping "${fix.to}")`);
          if (!dryRun) {
            await client.query(`DELETE FROM vehicle_fitments WHERE make = $1 AND model = $2 AND year >= 1990 AND year <= 1999`, [fix.make, fix.from]);
          }
        } else {
          // Rename to proper case
          console.log(`${fix.make} "${fix.from}" -> "${fix.to}": ${result.rows[0].cnt} records`);
          if (!dryRun) {
            await client.query(`UPDATE vehicle_fitments SET model = $1, updated_at = NOW() WHERE make = $2 AND model = $3 AND year >= 1990 AND year <= 1999`, [fix.to, fix.make, fix.from]);
          }
        }
      }
    }
    
    // ============================================
    // 2. ADD MISSING MODELS
    // ============================================
    console.log('\n\n--- 2. ADDING MISSING MODELS ---\n');
    
    const newRecords = [];
    
    // Chevrolet C/K 1500 (1990-1998) - 5x127 (5x5"), 78.1mm hub
    for (let year = 1990; year <= 1998; year++) {
      for (const trim of ['Base', 'Cheyenne', 'Silverado', 'WT']) {
        newRecords.push({
          year, make: 'Chevrolet', model: 'C/K 1500', display_trim: trim,
          bolt_pattern: '5x127', center_bore_mm: 78.1, thread_size: 'M14x1.5', seat_type: 'Conical',
          offset_min_mm: 0, offset_max_mm: 30,
          oem_wheel_sizes: [{ diameter: 15, width: 7, offset: 6 }, { diameter: 16, width: 7, offset: 6 }],
          oem_tire_sizes: ['P235/75R15', 'P245/75R16', 'LT265/75R16']
        });
      }
    }
    
    // GMC C/K 1500 (1990-1998) - same specs as Chevy
    for (let year = 1990; year <= 1998; year++) {
      for (const trim of ['Base', 'SL', 'SLE', 'SLT']) {
        newRecords.push({
          year, make: 'GMC', model: 'C/K 1500', display_trim: trim,
          bolt_pattern: '5x127', center_bore_mm: 78.1, thread_size: 'M14x1.5', seat_type: 'Conical',
          offset_min_mm: 0, offset_max_mm: 30,
          oem_wheel_sizes: [{ diameter: 15, width: 7, offset: 6 }, { diameter: 16, width: 7, offset: 6 }],
          oem_tire_sizes: ['P235/75R15', 'P245/75R16', 'LT265/75R16']
        });
      }
    }
    
    // GMC Safari (1990-1999) - 5x127, 78.1mm hub (same as Chevy Astro)
    for (let year = 1990; year <= 1999; year++) {
      for (const trim of ['SL', 'SLE', 'SLT']) {
        newRecords.push({
          year, make: 'GMC', model: 'Safari', display_trim: trim,
          bolt_pattern: '5x127', center_bore_mm: 78.1, thread_size: 'M12x1.5', seat_type: 'Conical',
          offset_min_mm: 35, offset_max_mm: 50,
          oem_wheel_sizes: [{ diameter: 15, width: 6.5, offset: 40 }],
          oem_tire_sizes: ['P205/75R15', 'P215/70R15']
        });
      }
    }
    
    // Pontiac Sunfire (1995-1999) - 5x100, 57.1mm hub
    for (let year = 1995; year <= 1999; year++) {
      for (const trim of ['SE', 'GT']) {
        newRecords.push({
          year, make: 'Pontiac', model: 'Sunfire', display_trim: trim,
          bolt_pattern: '5x100', center_bore_mm: 57.1, thread_size: 'M12x1.5', seat_type: 'Conical',
          offset_min_mm: 35, offset_max_mm: 50,
          oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 42 }, { diameter: 15, width: 6, offset: 42 }, { diameter: 16, width: 6.5, offset: 42 }],
          oem_tire_sizes: ['P195/70R14', 'P195/65R15', 'P205/55R16']
        });
      }
    }
    
    // Pontiac Trans Am (1991-1999) - 5x120.65, 70.3mm hub
    for (let year = 1991; year <= 1999; year++) {
      for (const trim of ['Base', 'GTA', 'WS6']) {
        // WS6 only from 1996+
        if (trim === 'WS6' && year < 1996) continue;
        // GTA discontinued after 1992
        if (trim === 'GTA' && year > 1992) continue;
        
        newRecords.push({
          year, make: 'Pontiac', model: 'Trans Am', display_trim: trim,
          bolt_pattern: '5x120.65', center_bore_mm: 70.3, thread_size: 'M12x1.5', seat_type: 'Conical',
          offset_min_mm: 35, offset_max_mm: 55,
          oem_wheel_sizes: [{ diameter: 16, width: 8, offset: 50 }, { diameter: 17, width: 9, offset: 50 }],
          oem_tire_sizes: ['P245/50R16', 'P275/40R17']
        });
      }
    }
    
    // Pontiac Grand Prix (1991-1999) - 5x115, 70.3mm hub
    for (let year = 1991; year <= 1999; year++) {
      for (const trim of ['SE', 'GT', 'GTP']) {
        // GTP only from 1997+
        if (trim === 'GTP' && year < 1997) continue;
        
        newRecords.push({
          year, make: 'Pontiac', model: 'Grand Prix', display_trim: trim,
          bolt_pattern: '5x115', center_bore_mm: 70.3, thread_size: 'M12x1.5', seat_type: 'Conical',
          offset_min_mm: 40, offset_max_mm: 55,
          oem_wheel_sizes: [{ diameter: 16, width: 6.5, offset: 45 }, { diameter: 17, width: 6.5, offset: 45 }],
          oem_tire_sizes: ['P225/60R16', 'P225/55R17']
        });
      }
    }
    
    // Add records
    let added = 0, skipped = 0;
    for (const r of newRecords) {
      const existing = await client.query(`
        SELECT id FROM vehicle_fitments 
        WHERE make = $1 AND model = $2 AND year = $3 AND display_trim = $4
      `, [r.make, r.model, r.year, r.display_trim]);
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      if (!dryRun) {
        const modId = `${r.make.toLowerCase()}-${r.model.toLowerCase().replace(/[\s\/]+/g, '-')}-${r.display_trim.toLowerCase()}-${uuidv4().slice(0, 8)}`;
        await client.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, display_trim, modification_id,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            quality_tier, confidence_tag, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        `, [
          uuidv4(), r.year, r.make, r.model, r.display_trim, modId,
          r.bolt_pattern, r.center_bore_mm, r.thread_size, r.seat_type,
          r.offset_min_mm, r.offset_max_mm,
          JSON.stringify(r.oem_wheel_sizes), JSON.stringify(r.oem_tire_sizes),
          'complete', 'HIGH', 'manual-research'
        ]);
      }
      added++;
    }
    
    console.log(`\nNew records to add: ${newRecords.length}`);
    console.log(`✅ Added: ${added}`);
    console.log(`⏭️  Skipped (already exist): ${skipped}`);
    
    if (dryRun) {
      console.log('\nRun without --dry-run to apply changes.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
