import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// 2025 Acura Integra specs
const integra = {
  year: 2025,
  make: 'acura',
  model: 'integra',
  modification_id: 'integra-2025-base',
  display_trim: 'Base',
  bolt_pattern: '5x114.3',
  center_bore_mm: 64.1,
  offset_min_mm: 40,
  offset_max_mm: 55,
  oem_tire_sizes: ['215/55R17', '235/40R18', '245/35R19'],
  oem_wheel_sizes: [
    { diameter: 17, width: 7, offset: 55 },
    { diameter: 18, width: 8, offset: 50 },
    { diameter: 19, width: 8.5, offset: 45 }
  ]
};

async function add() {
  const client = await pool.connect();
  
  try {
    // Check if exists
    const existing = await client.query(
      `SELECT id FROM vehicle_fitments WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3`,
      [integra.year, integra.make, integra.model]
    );
    
    if (existing.rows.length > 0) {
      console.log('2025 Acura Integra already exists - updating...');
      await client.query(`
        UPDATE vehicle_fitments SET
          oem_tire_sizes = $1,
          oem_wheel_sizes = $2,
          bolt_pattern = $3,
          center_bore_mm = $4,
          updated_at = NOW()
        WHERE year = $5 AND make ILIKE $6 AND model ILIKE $7
      `, [
        JSON.stringify(integra.oem_tire_sizes),
        JSON.stringify(integra.oem_wheel_sizes),
        integra.bolt_pattern,
        integra.center_bore_mm,
        integra.year, integra.make, integra.model
      ]);
    } else {
      console.log('Adding 2025 Acura Integra...');
      await client.query(`
        INSERT INTO vehicle_fitments (
          year, make, model, modification_id, display_trim,
          bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
          oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'priority-fix', NOW(), NOW())
      `, [
        integra.year, integra.make, integra.model, 
        integra.modification_id, integra.display_trim,
        integra.bolt_pattern, integra.center_bore_mm,
        integra.offset_min_mm, integra.offset_max_mm,
        JSON.stringify(integra.oem_tire_sizes),
        JSON.stringify(integra.oem_wheel_sizes)
      ]);
    }
    
    console.log('✅ Done!');
    
    // Verify
    const verify = await client.query(`
      SELECT year, make, model, oem_tire_sizes FROM vehicle_fitments
      WHERE year = 2025 AND make ILIKE 'acura' AND model ILIKE 'integra'
    `);
    console.log('Verification:', verify.rows[0]);
    
  } finally {
    client.release();
    await pool.end();
  }
}

add().catch(console.error);
