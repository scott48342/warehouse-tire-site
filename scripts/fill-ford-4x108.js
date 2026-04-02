const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fill() {
  // Ford 4x108 specs: 63.4mm CB, M12x1.5 thread, conical seat, offset 15-45mm typical
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET center_bore_mm = 63.4, 
        thread_size = 'M12x1.5', 
        seat_type = 'conical', 
        offset_min_mm = 15, 
        offset_max_mm = 45 
    WHERE bolt_pattern = '4x108' AND center_bore_mm IS NULL
    RETURNING year, make, model
  `);

  console.log(`✅ Updated ${result.rowCount} Ford 4x108 records`);
  console.log(`   Centerbore: 63.4mm`);
  console.log(`   Thread: M12x1.5`);
  console.log(`   Seat: conical`);
  console.log(`   Offset: 15-45mm`);

  await pool.end();
}

fill().catch(e => { console.error(e); process.exit(1); });
