const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // All Nexen patterns
    const nexen = await pool.query(
      "SELECT pattern_key, utqg, mileage_warranty FROM tire_pattern_specs WHERE pattern_key LIKE 'nexen%'"
    );
    console.log('Nexen patterns in DB:', nexen.rows.length);
    nexen.rows.forEach(row => 
      console.log('  ', row.pattern_key, '→ UTQG=' + (row.utqg || 'null') + ', warranty=' + row.mileage_warranty)
    );
    
  } finally {
    await pool.end();
  }
}

main();
