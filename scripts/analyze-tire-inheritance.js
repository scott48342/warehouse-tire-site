const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function analyze() {
  // Check what tire data we have
  console.log('📊 TIRE SIZE DATA ANALYSIS\n');

  // Count records with tire data
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb) as has_tires,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as missing_tires
    FROM vehicle_fitments
  `);
  
  const s = stats.rows[0];
  console.log(`Total records: ${s.total}`);
  console.log(`Has tire data: ${s.has_tires} (${(s.has_tires/s.total*100).toFixed(1)}%)`);
  console.log(`Missing tires: ${s.missing_tires} (${(s.missing_tires/s.total*100).toFixed(1)}%)\n`);

  // Sample what tire data looks like
  console.log('📋 Sample tire data format:\n');
  const samples = await pool.query(`
    SELECT year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb
    ORDER BY year DESC
    LIMIT 5
  `);
  
  samples.rows.forEach(r => {
    console.log(`${r.year} ${r.make} ${r.model} ${r.display_trim}`);
    console.log(`  Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`  Tires:  ${JSON.stringify(r.oem_tire_sizes)}\n`);
  });

  // Check if we can inherit by make+model (same model across years)
  console.log('\n📈 INHERITANCE POTENTIAL (same make+model)\n');
  
  const inheritance = await pool.query(`
    WITH model_tire_stats AS (
      SELECT 
        make, model,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb) as has_data,
        COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as missing
      FROM vehicle_fitments
      GROUP BY make, model
    )
    SELECT * FROM model_tire_stats 
    WHERE has_data > 0 AND missing > 0
    ORDER BY missing DESC
    LIMIT 20
  `);

  console.log('Models with PARTIAL tire data (can inherit):\n');
  console.log('MAKE          MODEL              | HAS DATA | MISSING | FILLABLE');
  console.log('────────────────────────────────┼──────────┼─────────┼─────────');
  inheritance.rows.forEach(r => {
    const fillable = r.has_data >= 3 ? '✅' : '⚠️';
    console.log(`${(r.make + ' ' + r.model).padEnd(31)} | ${String(r.has_data).padStart(8)} | ${String(r.missing).padStart(7)} | ${fillable}`);
  });

  // Check if we have wheel-to-tire mappings we could use
  console.log('\n\n📐 WHEEL SIZE → TIRE SIZE PATTERNS\n');
  
  const wheelTire = await pool.query(`
    SELECT 
      oem_wheel_sizes,
      oem_tire_sizes,
      COUNT(*) as occurrences
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb
      AND oem_wheel_sizes IS NOT NULL
      AND oem_wheel_sizes != '[]'::jsonb
    GROUP BY oem_wheel_sizes, oem_tire_sizes
    ORDER BY COUNT(*) DESC
    LIMIT 15
  `);

  console.log('Most common wheel→tire mappings:\n');
  wheelTire.rows.forEach(r => {
    console.log(`Wheels: ${JSON.stringify(r.oem_wheel_sizes).substring(0,40).padEnd(40)} → Tires: ${JSON.stringify(r.oem_tire_sizes).substring(0,50)} (${r.occurrences}x)`);
  });

  await pool.end();
}

analyze().catch(e => { console.error(e); process.exit(1); });
