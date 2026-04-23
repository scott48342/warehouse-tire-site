// Check flagged records in detail
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  
  try {
    // Check BMW 5-series with flagged wheel/tire mismatch
    console.log('\n=== BMW 5-series (1980s) ===');
    const bmw = await client.query(`
      SELECT year, model, display_trim, 
             oem_wheel_sizes, oem_tire_sizes,
             bolt_pattern, center_bore_mm
      FROM vehicle_fitments 
      WHERE make = 'BMW' AND model = '5-Series' AND year BETWEEN 1980 AND 1990
      ORDER BY year
      LIMIT 10
    `);
    bmw.rows.forEach(r => {
      console.log(`${r.year} ${r.model} ${r.display_trim || ''}`);
      console.log('  Wheels:', JSON.stringify(r.oem_wheel_sizes));
      console.log('  Tires:', JSON.stringify(r.oem_tire_sizes));
      console.log('  Bolt:', r.bolt_pattern, 'Hub:', r.center_bore_mm);
    });

    // Check Hummer H1 
    console.log('\n=== Hummer H1 ===');
    const hummer = await client.query(`
      SELECT year, model, display_trim,
             bolt_pattern, center_bore_mm, oem_wheel_sizes
      FROM vehicle_fitments 
      WHERE make = 'Hummer' AND model = 'H1'
      ORDER BY year
      LIMIT 10
    `);
    hummer.rows.forEach(r => {
      console.log(`${r.year} ${r.model}: Bolt ${r.bolt_pattern}, Hub ${r.center_bore_mm}mm, Wheels ${JSON.stringify(r.oem_wheel_sizes)}`);
    });

    // Summary of makes in DB (case check)
    console.log('\n=== Make casing in DB ===');
    const makes = await client.query(`
      SELECT make, COUNT(*)::int as count
      FROM vehicle_fitments 
      WHERE LOWER(make) IN ('chevrolet', 'hummer', 'bmw', 'toyota', 'lincoln', 'buick')
      GROUP BY make
      ORDER BY count DESC
    `);
    console.table(makes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
