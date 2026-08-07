require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Ford Taurus 1986-1989 (1990 already exists)
// 5x108, 63.4mm hub, M12x1.5, 35-50mm offset
const fordTaurus = [];
for (let year = 1986; year <= 1989; year++) {
  fordTaurus.push({
    year,
    make: 'Ford',
    model: 'Taurus',
    display_trim: 'Base',
    bolt_pattern: '5x108',
    center_bore_mm: 63.4,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 35,
    offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 42 }, { diameter: 15, width: 6, offset: 42 }],
    oem_tire_sizes: ['P195/70R14', 'P205/65R15'],
    quality_tier: 'complete',
    confidence_tag: 'MEDIUM'
  });
}

// Ford Escort 1981-1989 (1990 already exists)
// 4x100, 54.1mm hub (changed from 4x108 in early years)
const fordEscort = [];
// 1981-1990: 4x100, 54.1mm hub
for (let year = 1981; year <= 1989; year++) {
  fordEscort.push({
    year,
    make: 'Ford',
    model: 'Escort',
    display_trim: 'Base',
    bolt_pattern: '4x100',
    center_bore_mm: 54.1,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 35,
    offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 13, width: 5, offset: 42 }, { diameter: 14, width: 5.5, offset: 42 }],
    oem_tire_sizes: ['P165/80R13', 'P175/70R14'],
    quality_tier: 'complete',
    confidence_tag: 'MEDIUM'
  });
}

// Pontiac Grand Am 1985-1991 (N-body)
// 5x100, 57.1mm hub, M12x1.5
const pontiacGrandAm = [];
for (let year = 1985; year <= 1990; year++) {
  pontiacGrandAm.push({
    year,
    make: 'Pontiac',
    model: 'Grand Am',
    display_trim: 'Base',
    bolt_pattern: '5x100',
    center_bore_mm: 57.1,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 35,
    offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 5.5, offset: 38 }, { diameter: 15, width: 6, offset: 38 }],
    oem_tire_sizes: ['P185/80R13', 'P195/70R14', 'P205/60R15'],
    quality_tier: 'complete',
    confidence_tag: 'MEDIUM'
  });
  // SE trim
  pontiacGrandAm.push({
    year,
    make: 'Pontiac',
    model: 'Grand Am',
    display_trim: 'SE',
    bolt_pattern: '5x100',
    center_bore_mm: 57.1,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 35,
    offset_max_mm: 50,
    oem_wheel_sizes: [{ diameter: 14, width: 6, offset: 38 }, { diameter: 15, width: 6, offset: 38 }],
    oem_tire_sizes: ['P195/70R14', 'P205/60R15'],
    quality_tier: 'complete',
    confidence_tag: 'MEDIUM'
  });
}

// Buick Grand National GNX and T-Type (1984-1987)
// Same platform as Regal - 5x120.65, 70.3mm, M12x1.5
const buickGN = [];
for (let year = 1984; year <= 1987; year++) {
  // T-Type (1984-1987)
  buickGN.push({
    year,
    make: 'Buick',
    model: 'Grand National',
    display_trim: 'T-Type',
    bolt_pattern: '5x120.65',
    center_bore_mm: 70.3,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 3,
    offset_max_mm: 38,
    oem_wheel_sizes: [{ diameter: 15, width: 7, offset: 0 }],
    oem_tire_sizes: ['P215/65R15', 'P245/50VR16'],
    quality_tier: 'complete',
    confidence_tag: 'HIGH'
  });
}
// GNX (1987 only - 547 made)
buickGN.push({
  year: 1987,
  make: 'Buick',
  model: 'Grand National',
  display_trim: 'GNX',
  bolt_pattern: '5x120.65',
  center_bore_mm: 70.3,
  thread_size: 'M12x1.5',
  seat_type: 'Conical',
  offset_min_mm: 0,
  offset_max_mm: 38,
  oem_wheel_sizes: [{ diameter: 16, width: 8, offset: 0 }],
  oem_tire_sizes: ['P245/50VR16'],
  quality_tier: 'verified',
  confidence_tag: 'HIGH'
});

// Chevy Monte Carlo SS (1983-1988)
// Same G-body specs
const monteCarloSS = [];
for (let year = 1983; year <= 1988; year++) {
  monteCarloSS.push({
    year,
    make: 'Chevrolet',
    model: 'Monte Carlo',
    display_trim: 'SS',
    bolt_pattern: '5x120.65',
    center_bore_mm: 70.3,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 0,
    offset_max_mm: 38,
    oem_wheel_sizes: [{ diameter: 15, width: 7, offset: 0 }],
    oem_tire_sizes: ['P215/65R15', 'P225/70R15'],
    quality_tier: 'complete',
    confidence_tag: 'HIGH'
  });
}

// Chevy El Camino SS (1980-1987)
const elCaminoSS = [];
for (let year = 1980; year <= 1987; year++) {
  elCaminoSS.push({
    year,
    make: 'Chevrolet',
    model: 'El Camino',
    display_trim: 'SS',
    bolt_pattern: '5x120.65',
    center_bore_mm: 70.3,
    thread_size: 'M12x1.5',
    seat_type: 'Conical',
    offset_min_mm: 0,
    offset_max_mm: 38,
    oem_wheel_sizes: [{ diameter: 15, width: 7, offset: 0 }],
    oem_tire_sizes: ['P215/65R15', 'P225/70R15'],
    quality_tier: 'complete',
    confidence_tag: 'HIGH'
  });
}

const allRecords = [
  ...fordTaurus,
  ...fordEscort,
  ...pontiacGrandAm,
  ...buickGN,
  ...monteCarloSS,
  ...elCaminoSS
];

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== ADDING RECORDS ===');
    console.log(`\nTotal records to add: ${allRecords.length}\n`);
    
    // Group by model for display
    const byModel = {};
    allRecords.forEach(r => {
      const key = `${r.make} ${r.model} ${r.display_trim}`;
      if (!byModel[key]) byModel[key] = [];
      byModel[key].push(r.year);
    });
    
    console.log('Records by model/trim:');
    Object.entries(byModel).forEach(([key, years]) => {
      const range = years.length > 1 ? `${Math.min(...years)}-${Math.max(...years)}` : years[0];
      console.log(`  ${key}: ${range} (${years.length} records)`);
    });
    
    if (!dryRun) {
      let added = 0;
      let skipped = 0;
      
      for (const r of allRecords) {
        // Check if record already exists
        const existing = await client.query(`
          SELECT id FROM vehicle_fitments 
          WHERE year = $1 AND make = $2 AND model = $3 AND COALESCE(display_trim, 'Base') = $4
        `, [r.year, r.make, r.model, r.display_trim]);
        
        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }
        
        const modId = `${r.make.toLowerCase()}-${r.model.toLowerCase().replace(/\s+/g, '-')}-${r.display_trim.toLowerCase().replace(/\s+/g, '-')}-${uuidv4().slice(0, 8)}`;
        
        await client.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, display_trim, modification_id,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm,
            oem_wheel_sizes, oem_tire_sizes,
            quality_tier, confidence_tag,
            source,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12,
            $13, $14,
            $15, $16,
            $17,
            NOW(), NOW()
          )
        `, [
          uuidv4(), r.year, r.make, r.model, r.display_trim, modId,
          r.bolt_pattern, r.center_bore_mm, r.thread_size, r.seat_type,
          r.offset_min_mm, r.offset_max_mm,
          JSON.stringify(r.oem_wheel_sizes), JSON.stringify(r.oem_tire_sizes),
          r.quality_tier, r.confidence_tag,
          'manual-research'
        ]);
        added++;
      }
      
      console.log(`\n✅ Added: ${added}`);
      console.log(`⏭️  Skipped (already exist): ${skipped}`);
    } else {
      console.log('\nRun without --dry-run to add records.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
