require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Ford Edge: 2007-2026
// Gen 1: 2007-2014 - 5x114.3, 63.4mm hub
// Gen 2: 2015-2024 - 5x108, 63.4mm hub (changed bolt pattern!)
// Discontinued after 2024

const edgeRecords = [];

// Gen 1 (2007-2014): 5x114.3
for (let year = 2007; year <= 2014; year++) {
  const trims = year >= 2011 ? ['SE', 'SEL', 'Limited', 'Sport'] : ['SE', 'SEL', 'Limited'];
  for (const trim of trims) {
    edgeRecords.push({
      year, make: 'Ford', model: 'Edge', display_trim: trim,
      bolt_pattern: '5x114.3', center_bore_mm: 63.4, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 40, offset_max_mm: 55,
      oem_wheel_sizes: [{ diameter: 17, width: 7.5, offset: 44 }, { diameter: 18, width: 8, offset: 44 }, { diameter: 20, width: 8, offset: 44 }],
      oem_tire_sizes: ['P235/65R17', 'P245/60R18', 'P245/50R20']
    });
  }
}

// Gen 2 (2015-2024): 5x108
for (let year = 2015; year <= 2024; year++) {
  const trims = ['SE', 'SEL', 'Titanium', 'ST'];
  // ST only from 2019+
  const actualTrims = year >= 2019 ? trims : trims.filter(t => t !== 'ST');
  for (const trim of actualTrims) {
    edgeRecords.push({
      year, make: 'Ford', model: 'Edge', display_trim: trim,
      bolt_pattern: '5x108', center_bore_mm: 63.4, thread_size: 'M12x1.5', seat_type: 'Conical',
      offset_min_mm: 40, offset_max_mm: 55,
      oem_wheel_sizes: [{ diameter: 18, width: 8, offset: 48 }, { diameter: 19, width: 8.5, offset: 48 }, { diameter: 20, width: 8.5, offset: 48 }, { diameter: 21, width: 9, offset: 48 }],
      oem_tire_sizes: ['P235/60R18', 'P245/55R19', 'P245/50R20', 'P265/40R21']
    });
  }
}

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== ADDING FORD EDGE ===\n');
    console.log(`Total records to add: ${edgeRecords.length}\n`);
    
    let added = 0, skipped = 0;
    
    for (const r of edgeRecords) {
      const existing = await client.query(`
        SELECT id FROM vehicle_fitments 
        WHERE make = $1 AND model = $2 AND year = $3 AND display_trim = $4
      `, [r.make, r.model, r.year, r.display_trim]);
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      if (!dryRun) {
        const modId = `ford-edge-${r.display_trim.toLowerCase()}-${uuidv4().slice(0, 8)}`;
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
    
    console.log(`✅ Added: ${added}`);
    console.log(`⏭️  Skipped (already exist): ${skipped}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
