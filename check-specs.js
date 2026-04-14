const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // Check Delinte patterns
    const delinte = await pool.query(
      "SELECT pattern_key, utqg, mileage_warranty FROM tire_pattern_specs WHERE pattern_key LIKE 'delinte%'"
    );
    console.log('Delinte patterns:', delinte.rows.length);
    delinte.rows.forEach(row => 
      console.log('  ', row.pattern_key, '→ UTQG=' + (row.utqg || 'null') + ', warranty=' + row.mileage_warranty)
    );
    
    // Check recent additions (updated in last day)
    const recent = await pool.query(
      "SELECT pattern_key, utqg, source, updated_at FROM tire_pattern_specs ORDER BY updated_at DESC FETCH FIRST 10 ROWS ONLY"
    );
    console.log('\nRecent patterns:');
    recent.rows.forEach(row => 
      console.log('  ', row.pattern_key, '→ UTQG=' + (row.utqg || 'null'), 'source=' + row.source)
    );
    
  } finally {
    await pool.end();
  }
}

main();
