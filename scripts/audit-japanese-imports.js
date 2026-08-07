require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const japaneseMakes = ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Isuzu', 'Datsun', 'Acura', 'Lexus', 'Infiniti'];

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== JAPANESE IMPORT COVERAGE (1980-1990) ===\n');
    
    // Current coverage
    console.log('--- CURRENT COVERAGE ---\n');
    
    for (const make of japaneseMakes) {
      const result = await client.query(`
        SELECT model, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND year >= 1980 AND year <= 1990
        GROUP BY model
        ORDER BY model
      `, [make]);
      
      if (result.rows.length > 0) {
        console.log(`\n${make.toUpperCase()} (${result.rows.reduce((a, r) => a + parseInt(r.cnt), 0)} total records):`);
        result.rows.forEach(r => {
          const years = r.min_year === r.max_year ? r.min_year : `${r.min_year}-${r.max_year}`;
          const gap = r.max_year - r.min_year + 1 < 11 ? ` ⚠️ Gap (only ${r.cnt} of 11 years)` : '';
          console.log(`  ${r.model}: ${years} (${r.cnt} records)${gap}`);
        });
      } else {
        console.log(`\n${make.toUpperCase()}: NO RECORDS`);
      }
    }
    
    // Popular 80s Japanese cars that should be covered
    console.log('\n\n--- MISSING POPULAR 80s JAPANESE VEHICLES ---\n');
    
    const popularModels = [
      // Toyota
      { make: 'Toyota', model: 'Corolla', years: '1980-1990' },
      { make: 'Toyota', model: 'Camry', years: '1983-1990' },
      { make: 'Toyota', model: 'Celica', years: '1980-1990' },
      { make: 'Toyota', model: 'Supra', years: '1980-1990' },
      { make: 'Toyota', model: 'MR2', years: '1985-1990' },
      { make: 'Toyota', model: 'Cressida', years: '1980-1990' },
      { make: 'Toyota', model: 'Pickup', years: '1980-1990' },
      { make: 'Toyota', model: 'Tercel', years: '1980-1990' },
      // Honda
      { make: 'Honda', model: 'Civic', years: '1980-1990' },
      { make: 'Honda', model: 'Accord', years: '1980-1990' },
      { make: 'Honda', model: 'Prelude', years: '1980-1990' },
      { make: 'Honda', model: 'CRX', years: '1984-1990' },
      // Nissan/Datsun
      { make: 'Nissan', model: '300ZX', years: '1984-1990' },
      { make: 'Nissan', model: '240SX', years: '1989-1990' },
      { make: 'Nissan', model: 'Maxima', years: '1985-1990' },
      { make: 'Nissan', model: 'Sentra', years: '1982-1990' },
      { make: 'Nissan', model: 'Stanza', years: '1982-1990' },
      { make: 'Nissan', model: 'Pickup', years: '1980-1990' },
      { make: 'Datsun', model: '280ZX', years: '1980-1983' },
      { make: 'Datsun', model: '510', years: '1980-1981' },
      { make: 'Datsun', model: '200SX', years: '1980-1983' },
      // Mazda
      { make: 'Mazda', model: 'RX-7', years: '1980-1990' },
      { make: 'Mazda', model: '626', years: '1980-1990' },
      { make: 'Mazda', model: 'Miata', years: '1990' },
      { make: 'Mazda', model: 'B2000', years: '1980-1987' },
      { make: 'Mazda', model: 'B2200', years: '1987-1990' },
      { make: 'Mazda', model: 'B2600', years: '1987-1990' },
      // Mitsubishi
      { make: 'Mitsubishi', model: 'Starion', years: '1983-1989' },
      { make: 'Mitsubishi', model: 'Montero', years: '1983-1990' },
      { make: 'Mitsubishi', model: 'Mighty Max', years: '1983-1990' },
      // Subaru
      { make: 'Subaru', model: 'GL', years: '1980-1989' },
      { make: 'Subaru', model: 'XT', years: '1985-1990' },
      { make: 'Subaru', model: 'Loyale', years: '1990' },
      // Suzuki
      { make: 'Suzuki', model: 'Samurai', years: '1986-1990' },
      // Isuzu
      { make: 'Isuzu', model: 'Trooper', years: '1984-1990' },
      { make: 'Isuzu', model: 'Pickup', years: '1981-1990' },
    ];
    
    console.log('Checking coverage for popular 80s Japanese vehicles:\n');
    
    for (const v of popularModels) {
      const result = await client.query(`
        SELECT MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 1980 AND year <= 1990
      `, [v.make, v.model]);
      
      const r = result.rows[0];
      if (r.cnt === '0' || r.cnt === 0) {
        console.log(`❌ ${v.make} ${v.model} (${v.years}): MISSING`);
      } else {
        const expected = v.years.includes('-') ? 
          (parseInt(v.years.split('-')[1]) - parseInt(v.years.split('-')[0]) + 1) : 1;
        const coverage = parseInt(r.cnt);
        if (coverage < expected * 0.5) {
          console.log(`⚠️  ${v.make} ${v.model} (${v.years}): Only ${r.min_year}-${r.max_year} (${r.cnt} records, expected ~${expected})`);
        } else {
          console.log(`✅ ${v.make} ${v.model} (${v.years}): ${r.min_year}-${r.max_year} (${r.cnt} records)`);
        }
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
