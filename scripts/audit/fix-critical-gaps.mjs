/**
 * Fix critical US vehicle gaps
 * Toyota Corolla, Highlander, Subaru Outback
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Known tire and wheel sizes for critical vehicles
const CRITICAL_FIXES = {
  // Toyota Corolla 2019-2026
  'toyota|corolla': {
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tires: ['195/65R15', '205/55R16', '225/40R18'],
    wheels: [
      { diameter: 15, width: 6, offset: 45 },
      { diameter: 16, width: 6.5, offset: 45 },
      { diameter: 18, width: 7.5, offset: 40 }
    ],
    bolt: '5x114.3',
    hub: 60.1
  },
  
  // Toyota Highlander 2020-2026
  'toyota|highlander': {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tires: ['235/65R18', '235/55R20'],
    wheels: [
      { diameter: 18, width: 7.5, offset: 45 },
      { diameter: 20, width: 8, offset: 40 }
    ],
    bolt: '5x114.3',
    hub: 60.1
  },
  
  // Subaru Outback 2020-2026
  'subaru|outback': {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tires: ['225/65R17', '225/60R18'],
    wheels: [
      { diameter: 17, width: 7, offset: 48 },
      { diameter: 18, width: 7, offset: 48 }
    ],
    bolt: '5x114.3',
    hub: 56.1
  },
  
  // Also fix Toyota Corolla Cross (might be lumped in)
  'toyota|corolla-cross': {
    years: [2022, 2023, 2024, 2025, 2026],
    tires: ['215/60R17', '225/50R18'],
    wheels: [
      { diameter: 17, width: 7, offset: 40 },
      { diameter: 18, width: 7, offset: 40 }
    ],
    bolt: '5x114.3',
    hub: 60.1
  },
  
  // Also fix Ford Mustang wheel specs (84% wheels)
  'ford|mustang': {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    tires: ['235/55R17', '255/40R19', '275/40R19', '305/30R19'],
    wheels: [
      { diameter: 17, width: 8, offset: 45 },
      { diameter: 19, width: 9, offset: 45 },
      { diameter: 19, width: 9.5, offset: 45 },
      { diameter: 19, width: 10, offset: 40 }
    ],
    bolt: '5x114.3',
    hub: 70.5
  }
};

async function fix() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('FIXING CRITICAL US VEHICLE GAPS');
  console.log('='.repeat(80));

  try {
    let totalUpdated = 0;
    
    for (const [key, data] of Object.entries(CRITICAL_FIXES)) {
      const [make, model] = key.split('|');
      console.log(`\n🔧 Fixing ${make} ${model}...`);
      
      for (const year of data.years) {
        // Find records for this year/make/model that are missing data
        const records = await client.query(`
          SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
          FROM vehicle_fitments
          WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
        `, [year, make, `%${model}%`]);
        
        if (records.rows.length === 0) {
          // No records exist - create one
          await client.query(`
            INSERT INTO vehicle_fitments (
              year, make, model, modification_id, display_trim,
              bolt_pattern, center_bore_mm,
              oem_tire_sizes, oem_wheel_sizes,
              source, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'audit-fix', NOW(), NOW())
          `, [
            year, make, model, `${model}-${year}-base`, 'Base',
            data.bolt, data.hub,
            JSON.stringify(data.tires), JSON.stringify(data.wheels)
          ]);
          console.log(`  + Added ${year} ${make} ${model} (new record)`);
          totalUpdated++;
          continue;
        }
        
        // Update existing records that are missing tire/wheel data
        for (const row of records.rows) {
          const needsTires = !row.oem_tire_sizes || row.oem_tire_sizes.length === 0;
          const needsWheels = !row.oem_wheel_sizes || row.oem_wheel_sizes.length === 0;
          
          if (needsTires || needsWheels) {
            await client.query(`
              UPDATE vehicle_fitments
              SET oem_tire_sizes = COALESCE(
                    CASE WHEN oem_tire_sizes IS NULL OR jsonb_array_length(oem_tire_sizes) = 0 
                         THEN $1::jsonb ELSE oem_tire_sizes END
                  ),
                  oem_wheel_sizes = COALESCE(
                    CASE WHEN oem_wheel_sizes IS NULL OR jsonb_array_length(oem_wheel_sizes) = 0 
                         THEN $2::jsonb ELSE oem_wheel_sizes END
                  ),
                  bolt_pattern = COALESCE(bolt_pattern, $3),
                  center_bore_mm = COALESCE(center_bore_mm, $4),
                  updated_at = NOW()
              WHERE id = $5
            `, [
              JSON.stringify(data.tires),
              JSON.stringify(data.wheels),
              data.bolt,
              data.hub,
              row.id
            ]);
            console.log(`  ✓ Updated ${year} ${make} ${model} - ${row.display_trim}`);
            totalUpdated++;
          }
        }
      }
    }
    
    console.log(`\n✅ Total records updated: ${totalUpdated}`);
    
    // Verify fixes
    console.log('\n' + '='.repeat(80));
    console.log('📊 VERIFICATION\n');
    
    for (const [key, data] of Object.entries(CRITICAL_FIXES)) {
      const [make, model] = key.split('|');
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires,
          COUNT(CASE WHEN oem_wheel_sizes IS NOT NULL AND jsonb_array_length(oem_wheel_sizes) > 0 THEN 1 END) as has_wheels
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 2020 AND year <= 2026
      `, [make, `%${model}%`]);
      
      const row = result.rows[0];
      const tiresCoverage = row.total > 0 ? (row.has_tires / row.total * 100).toFixed(0) : 0;
      const wheelsCoverage = row.total > 0 ? (row.has_wheels / row.total * 100).toFixed(0) : 0;
      
      console.log(`${make} ${model}: ${row.total} trims, ${tiresCoverage}% tires, ${wheelsCoverage}% wheels`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(console.error);
