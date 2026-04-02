const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function fix() {
  // 2008 Chrysler 300: LX platform = 71.5mm centerbore
  const chryslerResult = await pool.query(`
    UPDATE vehicle_fitments 
    SET center_bore_mm = 71.5
    WHERE year = 2008 AND LOWER(make) = 'chrysler' AND LOWER(model) = '300'
      AND center_bore_mm IS NULL
    RETURNING display_trim
  `);
  console.log(`✅ 2008 Chrysler 300: Updated ${chryslerResult.rowCount} trims with 71.5mm centerbore`);
  chryslerResult.rows.forEach(r => console.log(`   - ${r.display_trim}`));

  // 2015 Ford F-250: 8x170 pattern = 124.9mm centerbore
  const f250Result = await pool.query(`
    UPDATE vehicle_fitments 
    SET center_bore_mm = 124.9
    WHERE year = 2015 AND LOWER(make) = 'ford' AND LOWER(model) = 'f-250'
      AND center_bore_mm IS NULL
    RETURNING display_trim
  `);
  console.log(`\n✅ 2015 Ford F-250: Updated ${f250Result.rowCount} trims with 124.9mm centerbore`);
  f250Result.rows.forEach(r => console.log(`   - ${r.display_trim}`));

  await pool.end();
}

fix().catch(e => { console.error(e); process.exit(1); });
