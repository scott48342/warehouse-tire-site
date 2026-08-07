require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const records = [];

// ============================================
// DODGE GRAND CARAVAN (2000-2020)
// 5x114.3, 71.5mm hub, M12x1.5
// ============================================
for (let year = 2000; year <= 2020; year++) {
  // Gen 4: 2001-2007, Gen 5: 2008-2020
  const trims = year >= 2008 
    ? ['SE', 'SXT', 'Crew', 'R/T', 'GT'] 
    : ['SE', 'Sport', 'ES', 'EX'];
  
  for (const trim of trims) {
    records.push({
      year, make: 'Dodge', model: 'Grand Caravan', display_trim: trim,
      bolt_pattern: '5x114.3', center_bore_mm: 71.5, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 38, offset_max_mm: 50,
      oem_wheel_sizes: [
        { diameter: 16, width: 6.5, offset: 40 },
        { diameter: 17, width: 6.5, offset: 40 }
      ],
      oem_tire_sizes: ['P215/65R16', 'P225/65R17']
    });
  }
}

// ============================================
// DODGE CARAVAN (2000-2007)
// 5x114.3, 71.5mm hub, M12x1.5 (same as Grand Caravan, shorter wheelbase)
// ============================================
for (let year = 2000; year <= 2007; year++) {
  const trims = ['SE', 'SXT', 'Sport'];
  for (const trim of trims) {
    records.push({
      year, make: 'Dodge', model: 'Caravan', display_trim: trim,
      bolt_pattern: '5x114.3', center_bore_mm: 71.5, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 38, offset_max_mm: 50,
      oem_wheel_sizes: [
        { diameter: 15, width: 6.5, offset: 40 },
        { diameter: 16, width: 6.5, offset: 40 }
      ],
      oem_tire_sizes: ['P205/70R15', 'P215/65R16']
    });
  }
}

// ============================================
// CHEVROLET EXPRESS (2000-2026)
// 1500: 6x139.7, 78.1mm hub (same as Silverado)
// 2500/3500: 8x165.1, 121mm hub
// ============================================
for (let year = 2000; year <= 2026; year++) {
  // Express 1500 (discontinued after 2014)
  if (year <= 2014) {
    for (const trim of ['LS', 'LT', 'Cargo', 'Passenger']) {
      records.push({
        year, make: 'Chevrolet', model: 'Express 1500', display_trim: trim,
        bolt_pattern: '6x139.7', center_bore_mm: 78.1, thread_size: 'M14x1.5', seat_type: 'Conical',
        offset_min_mm: 28, offset_max_mm: 45,
        oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 31 }, { diameter: 17, width: 7.5, offset: 28 }],
        oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
      });
    }
  }
  
  // Express 2500
  for (const trim of ['LS', 'LT', 'Cargo', 'Passenger']) {
    records.push({
      year, make: 'Chevrolet', model: 'Express 2500', display_trim: trim,
      bolt_pattern: '8x165.1', center_bore_mm: 121.0, thread_size: 'M14x1.5', seat_type: 'Conical',
      offset_min_mm: 28, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 36 }, { diameter: 17, width: 7.5, offset: 36 }],
      oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
    });
  }
  
  // Express 3500
  for (const trim of ['LS', 'LT', 'Cargo', 'Passenger', 'Cutaway']) {
    records.push({
      year, make: 'Chevrolet', model: 'Express 3500', display_trim: trim,
      bolt_pattern: '8x165.1', center_bore_mm: 121.0, thread_size: 'M14x1.5', seat_type: 'Conical',
      offset_min_mm: 28, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 36 }, { diameter: 17, width: 7.5, offset: 36 }],
      oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
    });
  }
}

// ============================================
// GMC SAVANA (2000-2026)
// Same specs as Express (badge engineering)
// ============================================
for (let year = 2000; year <= 2026; year++) {
  // Savana 1500 (discontinued after 2014)
  if (year <= 2014) {
    for (const trim of ['SL', 'SLE', 'Cargo', 'Passenger']) {
      records.push({
        year, make: 'GMC', model: 'Savana 1500', display_trim: trim,
        bolt_pattern: '6x139.7', center_bore_mm: 78.1, thread_size: 'M14x1.5', seat_type: 'Conical',
        offset_min_mm: 28, offset_max_mm: 45,
        oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 31 }, { diameter: 17, width: 7.5, offset: 28 }],
        oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
      });
    }
  }
  
  // Savana 2500
  for (const trim of ['SL', 'SLE', 'Cargo', 'Passenger']) {
    records.push({
      year, make: 'GMC', model: 'Savana 2500', display_trim: trim,
      bolt_pattern: '8x165.1', center_bore_mm: 121.0, thread_size: 'M14x1.5', seat_type: 'Conical',
      offset_min_mm: 28, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 36 }, { diameter: 17, width: 7.5, offset: 36 }],
      oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
    });
  }
  
  // Savana 3500
  for (const trim of ['SL', 'SLE', 'Cargo', 'Passenger', 'Cutaway']) {
    records.push({
      year, make: 'GMC', model: 'Savana 3500', display_trim: trim,
      bolt_pattern: '8x165.1', center_bore_mm: 121.0, thread_size: 'M14x1.5', seat_type: 'Conical',
      offset_min_mm: 28, offset_max_mm: 50,
      oem_wheel_sizes: [{ diameter: 16, width: 7, offset: 36 }, { diameter: 17, width: 7.5, offset: 36 }],
      oem_tire_sizes: ['LT245/75R16', 'LT245/70R17']
    });
  }
}

// ============================================
// LINCOLN TOWN CAR (2000-2011)
// 5x114.3, 70.5mm hub, M12x1.5
// ============================================
for (let year = 2000; year <= 2011; year++) {
  const trims = year >= 2003 
    ? ['Signature', 'Signature Limited', 'Executive', 'Cartier', 'Ultimate']
    : ['Executive', 'Signature', 'Cartier'];
  
  for (const trim of trims) {
    records.push({
      year, make: 'Lincoln', model: 'Town Car', display_trim: trim,
      bolt_pattern: '5x114.3', center_bore_mm: 70.5, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 40, offset_max_mm: 55,
      oem_wheel_sizes: [
        { diameter: 16, width: 7, offset: 44 },
        { diameter: 17, width: 7, offset: 44 }
      ],
      oem_tire_sizes: ['P225/60R16', 'P225/55R17']
    });
  }
}

// ============================================
// FORD E-150 (2000-2014)
// 5x135, 87.1mm hub, M14x2.0 (same as F-150)
// ============================================
for (let year = 2000; year <= 2014; year++) {
  const trims = ['XL', 'XLT', 'Cargo', 'Passenger'];
  for (const trim of trims) {
    records.push({
      year, make: 'Ford', model: 'E-150', display_trim: trim,
      bolt_pattern: '5x135', center_bore_mm: 87.1, thread_size: 'M14x2.0', seat_type: 'Conical',
      offset_min_mm: 35, offset_max_mm: 50,
      oem_wheel_sizes: [
        { diameter: 16, width: 7, offset: 44 },
        { diameter: 17, width: 7.5, offset: 44 }
      ],
      oem_tire_sizes: ['P235/75R16', 'P245/70R17']
    });
  }
}

// ============================================
// JEEP PATRIOT (2007-2017)
// 5x114.3, 67.1mm hub, M12x1.5
// ============================================
for (let year = 2007; year <= 2017; year++) {
  const trims = ['Sport', 'Latitude', 'Limited', 'High Altitude'];
  for (const trim of trims) {
    records.push({
      year, make: 'Jeep', model: 'Patriot', display_trim: trim,
      bolt_pattern: '5x114.3', center_bore_mm: 67.1, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 35, offset_max_mm: 50,
      oem_wheel_sizes: [
        { diameter: 16, width: 6.5, offset: 40 },
        { diameter: 17, width: 6.5, offset: 40 }
      ],
      oem_tire_sizes: ['P205/70R16', 'P215/60R17']
    });
  }
}

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== ADDING MISSING DOMESTIC (2000-2026) ===\n');
    console.log(`Total records to process: ${records.length}\n`);
    
    // Group by model for summary
    const byModel = {};
    records.forEach(r => {
      const key = `${r.make} ${r.model}`;
      if (!byModel[key]) byModel[key] = { years: new Set(), trims: new Set() };
      byModel[key].years.add(r.year);
      byModel[key].trims.add(r.display_trim);
    });
    
    console.log('Models to add:');
    Object.entries(byModel).forEach(([model, data]) => {
      const yearRange = `${Math.min(...data.years)}-${Math.max(...data.years)}`;
      console.log(`  ${model}: ${yearRange} [${[...data.trims].join(', ')}]`);
    });
    console.log('');
    
    let added = 0, skipped = 0;
    
    for (const r of records) {
      const existing = await client.query(`
        SELECT id FROM vehicle_fitments 
        WHERE make = $1 AND model = $2 AND year = $3 AND display_trim = $4
      `, [r.make, r.model, r.year, r.display_trim]);
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      if (!dryRun) {
        const modId = `${r.make.toLowerCase()}-${r.model.toLowerCase().replace(/\s+/g, '-')}-${r.display_trim.toLowerCase().replace(/[\s\/]+/g, '-')}-${uuidv4().slice(0, 8)}`;
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
    
    console.log(`\n✅ Added: ${added}`);
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
