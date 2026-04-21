import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Priority vehicles to add/fix
const priorityVehicles = [
  {
    year: 2024, make: 'Nissan', model: 'Frontier',
    modification_id: 'frontier-2024-base',
    display_trim: 'Base',
    bolt_pattern: '6x114.3', center_bore_mm: 66.1,
    offset_min_mm: 10, offset_max_mm: 45,
    oem_tire_sizes: ['265/70R17', '265/65R18', '275/55R20'],
    oem_wheel_sizes: [
      { diameter: 17, width: 7.5, offset: 30 },
      { diameter: 18, width: 7.5, offset: 30 },
      { diameter: 20, width: 8.5, offset: 35 }
    ]
  },
  {
    year: 2023, make: 'GMC', model: 'Yukon',
    modification_id: 'yukon-2023-base',
    display_trim: 'Base',
    bolt_pattern: '6x139.7', center_bore_mm: 78.1,
    offset_min_mm: 20, offset_max_mm: 44,
    oem_tire_sizes: ['275/65R18', '275/60R20', '285/45R22'],
    oem_wheel_sizes: [
      { diameter: 18, width: 8.5, offset: 24 },
      { diameter: 20, width: 9, offset: 24 },
      { diameter: 22, width: 9, offset: 28 }
    ]
  }
];

async function fixPriority() {
  const client = await pool.connect();
  
  try {
    for (const v of priorityVehicles) {
      // Check if exists
      const existing = await client.query(
        `SELECT id FROM vehicle_fitments WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3`,
        [v.year, v.make, v.model]
      );
      
      if (existing.rows.length > 0) {
        // Update existing
        await client.query(`
          UPDATE vehicle_fitments SET
            oem_tire_sizes = $1,
            oem_wheel_sizes = $2,
            updated_at = NOW()
          WHERE year = $3 AND make ILIKE $4 AND model ILIKE $5
        `, [JSON.stringify(v.oem_tire_sizes), JSON.stringify(v.oem_wheel_sizes), v.year, v.make, v.model]);
        console.log(`✅ Updated: ${v.year} ${v.make} ${v.model}`);
      } else {
        // Insert new
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, display_trim,
            bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
            oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'priority-fix', NOW(), NOW())
        `, [v.year, v.make, v.model, v.modification_id, v.display_trim,
            v.bolt_pattern, v.center_bore_mm, v.offset_min_mm, v.offset_max_mm,
            JSON.stringify(v.oem_tire_sizes), JSON.stringify(v.oem_wheel_sizes)]);
        console.log(`✅ Added: ${v.year} ${v.make} ${v.model}`);
      }
    }
    
    console.log('\nDone! Both vehicles now have fitment data.');
  } finally {
    client.release();
    await pool.end();
  }
}

fixPriority().catch(console.error);
