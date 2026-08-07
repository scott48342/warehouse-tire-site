require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const domesticMakes = ['Chevrolet', 'Ford', 'Dodge', 'Pontiac', 'Buick', 'Oldsmobile', 'Cadillac', 'Lincoln', 'Mercury', 'Chrysler', 'Plymouth', 'AMC', 'Jeep', 'GMC', 'Eagle'];

// Popular 80s domestic models that should have full coverage
const popularDomestic = [
  // Chevy
  { make: 'Chevrolet', model: 'Camaro', years: '1980-1990' },
  { make: 'Chevrolet', model: 'Corvette', years: '1980-1990' },
  { make: 'Chevrolet', model: 'Impala', years: '1980-1985' },
  { make: 'Chevrolet', model: 'Caprice', years: '1980-1990' },
  { make: 'Chevrolet', model: 'Monte Carlo', years: '1980-1988' },
  { make: 'Chevrolet', model: 'Nova', years: '1980-1988' },
  { make: 'Chevrolet', model: 'Chevelle', years: '1980-1983' },
  { make: 'Chevrolet', model: 'Malibu', years: '1980-1983' },
  { make: 'Chevrolet', model: 'Celebrity', years: '1982-1990' },
  { make: 'Chevrolet', model: 'Cavalier', years: '1982-1990' },
  { make: 'Chevrolet', model: 'C10', years: '1980-1987' },
  { make: 'Chevrolet', model: 'C1500', years: '1988-1990' },
  { make: 'Chevrolet', model: 'K10', years: '1980-1987' },
  { make: 'Chevrolet', model: 'K1500', years: '1988-1990' },
  { make: 'Chevrolet', model: 'S10', years: '1982-1990' },
  { make: 'Chevrolet', model: 'Blazer', years: '1980-1990' },
  { make: 'Chevrolet', model: 'Suburban', years: '1980-1990' },
  { make: 'Chevrolet', model: 'El Camino', years: '1980-1987' },
  // Ford
  { make: 'Ford', model: 'Mustang', years: '1980-1990' },
  { make: 'Ford', model: 'Thunderbird', years: '1980-1990' },
  { make: 'Ford', model: 'LTD', years: '1980-1986' },
  { make: 'Ford', model: 'Crown Victoria', years: '1980-1990' },
  { make: 'Ford', model: 'Taurus', years: '1986-1990' },
  { make: 'Ford', model: 'Escort', years: '1981-1990' },
  { make: 'Ford', model: 'F-150', years: '1980-1990' },
  { make: 'Ford', model: 'F-250', years: '1980-1990' },
  { make: 'Ford', model: 'F-350', years: '1980-1990' },
  { make: 'Ford', model: 'Ranger', years: '1983-1990' },
  { make: 'Ford', model: 'Bronco', years: '1980-1990' },
  { make: 'Ford', model: 'Bronco II', years: '1984-1990' },
  // Pontiac
  { make: 'Pontiac', model: 'Firebird', years: '1980-1990' },
  { make: 'Pontiac', model: 'Trans Am', years: '1980-1990' },
  { make: 'Pontiac', model: 'Grand Prix', years: '1980-1990' },
  { make: 'Pontiac', model: 'Grand Am', years: '1985-1990' },
  { make: 'Pontiac', model: 'Bonneville', years: '1980-1990' },
  { make: 'Pontiac', model: 'Fiero', years: '1984-1988' },
  { make: 'Pontiac', model: '6000', years: '1982-1990' },
  // Buick
  { make: 'Buick', model: 'Regal', years: '1980-1990' },
  { make: 'Buick', model: 'Grand National', years: '1982-1987' },
  { make: 'Buick', model: 'Riviera', years: '1980-1990' },
  { make: 'Buick', model: 'LeSabre', years: '1980-1990' },
  { make: 'Buick', model: 'Century', years: '1982-1990' },
  // Oldsmobile
  { make: 'Oldsmobile', model: 'Cutlass', years: '1980-1990' },
  { make: 'Oldsmobile', model: 'Cutlass Supreme', years: '1980-1990' },
  { make: 'Oldsmobile', model: '442', years: '1980-1987' },
  { make: 'Oldsmobile', model: '88', years: '1980-1990' },
  { make: 'Oldsmobile', model: '98', years: '1980-1990' },
  { make: 'Oldsmobile', model: 'Toronado', years: '1980-1990' },
  // Cadillac
  { make: 'Cadillac', model: 'DeVille', years: '1980-1990' },
  { make: 'Cadillac', model: 'Eldorado', years: '1980-1990' },
  { make: 'Cadillac', model: 'Seville', years: '1980-1990' },
  { make: 'Cadillac', model: 'Fleetwood', years: '1980-1990' },
  // Lincoln
  { make: 'Lincoln', model: 'Town Car', years: '1980-1990' },
  { make: 'Lincoln', model: 'Continental', years: '1980-1990' },
  { make: 'Lincoln', model: 'Mark VII', years: '1984-1990' },
  // Mercury
  { make: 'Mercury', model: 'Grand Marquis', years: '1980-1990' },
  { make: 'Mercury', model: 'Cougar', years: '1980-1990' },
  { make: 'Mercury', model: 'Capri', years: '1980-1986' },
  // Dodge
  { make: 'Dodge', model: 'Charger', years: '1980-1987' },
  { make: 'Dodge', model: 'Diplomat', years: '1980-1989' },
  { make: 'Dodge', model: 'Daytona', years: '1984-1990' },
  { make: 'Dodge', model: 'Ram', years: '1981-1990' },
  { make: 'Dodge', model: 'Ramcharger', years: '1980-1990' },
  { make: 'Dodge', model: 'Dakota', years: '1987-1990' },
  { make: 'Dodge', model: 'Caravan', years: '1984-1990' },
  // Plymouth
  { make: 'Plymouth', model: 'Voyager', years: '1984-1990' },
  { make: 'Plymouth', model: 'Gran Fury', years: '1980-1989' },
  // Chrysler
  { make: 'Chrysler', model: 'Fifth Avenue', years: '1980-1990' },
  { make: 'Chrysler', model: 'New Yorker', years: '1980-1990' },
  { make: 'Chrysler', model: 'LeBaron', years: '1980-1990' },
  // Jeep
  { make: 'Jeep', model: 'CJ-5', years: '1980-1983' },
  { make: 'Jeep', model: 'CJ-7', years: '1980-1986' },
  { make: 'Jeep', model: 'Wrangler', years: '1987-1990' },
  { make: 'Jeep', model: 'Cherokee', years: '1984-1990' },
  { make: 'Jeep', model: 'Grand Wagoneer', years: '1980-1990' },
  // GMC
  { make: 'GMC', model: 'Sierra', years: '1980-1990' },
  { make: 'GMC', model: 'Jimmy', years: '1983-1990' },
  { make: 'GMC', model: 'S15', years: '1982-1990' },
  // AMC
  { make: 'AMC', model: 'Eagle', years: '1980-1987' },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== DOMESTIC VEHICLE COVERAGE AUDIT (1980-1990) ===\n');
    
    // 1. Check popular model coverage
    console.log('--- POPULAR MODEL COVERAGE ---\n');
    
    const missing = [];
    const partial = [];
    const complete = [];
    
    for (const v of popularDomestic) {
      const result = await client.query(`
        SELECT MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 1980 AND year <= 1990
      `, [v.make, v.model]);
      
      const r = result.rows[0];
      const yearRange = v.years.split('-');
      const expectedStart = parseInt(yearRange[0]);
      const expectedEnd = yearRange.length > 1 ? parseInt(yearRange[1]) : expectedStart;
      const expectedYears = expectedEnd - expectedStart + 1;
      
      if (r.cnt === '0' || r.cnt === 0) {
        missing.push({ ...v, expected: expectedYears });
      } else {
        const coverage = parseInt(r.cnt);
        if (coverage < expectedYears * 0.7) {
          partial.push({ ...v, actual: `${r.min_year}-${r.max_year}`, count: coverage, expected: expectedYears });
        } else {
          complete.push({ ...v, actual: `${r.min_year}-${r.max_year}`, count: coverage });
        }
      }
    }
    
    console.log(`✅ COMPLETE COVERAGE (${complete.length} models):`);
    complete.forEach(v => console.log(`   ${v.make} ${v.model}: ${v.actual} (${v.count} records)`));
    
    console.log(`\n⚠️  PARTIAL COVERAGE (${partial.length} models):`);
    partial.forEach(v => console.log(`   ${v.make} ${v.model}: ${v.actual} (${v.count}/${v.expected} years) - expected ${v.years}`));
    
    console.log(`\n❌ MISSING (${missing.length} models):`);
    missing.forEach(v => console.log(`   ${v.make} ${v.model} (${v.years})`));
    
    // 2. Check submodel/trim coverage
    console.log('\n\n--- SUBMODEL/TRIM ANALYSIS ---\n');
    
    const trimAnalysis = await client.query(`
      SELECT make, model, 
        COUNT(DISTINCT display_trim) as trim_count,
        COUNT(*) as total_records,
        ARRAY_AGG(DISTINCT display_trim ORDER BY display_trim) as trims
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND make IN ('Chevrolet', 'Ford', 'Pontiac', 'Buick', 'Dodge')
      GROUP BY make, model
      HAVING COUNT(DISTINCT display_trim) > 1
      ORDER BY make, model
    `);
    
    console.log('Models with multiple trims:');
    trimAnalysis.rows.forEach(r => {
      const trims = r.trims.filter(t => t).slice(0, 5).join(', ');
      const more = r.trims.length > 5 ? ` +${r.trims.length - 5} more` : '';
      console.log(`  ${r.make} ${r.model}: ${r.trim_count} trims (${trims}${more})`);
    });
    
    // 3. Check which models only have "Base" trim
    console.log('\n\n--- MODELS WITH ONLY "BASE" TRIM ---\n');
    
    const baseOnly = await client.query(`
      SELECT make, model, COUNT(*) as years
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1990
        AND make IN ('Chevrolet', 'Ford', 'Pontiac', 'Buick', 'Dodge', 'Oldsmobile', 'Cadillac')
      GROUP BY make, model
      HAVING COUNT(DISTINCT COALESCE(display_trim, 'Base')) = 1
        AND MAX(COALESCE(display_trim, 'Base')) IN ('Base', '')
      ORDER BY make, model
    `);
    
    console.log('These models only have "Base" trim - may need submodels:');
    baseOnly.rows.forEach(r => console.log(`  ${r.make} ${r.model} (${r.years} years)`));
    
    // 4. Performance cars - verify they have performance trims
    console.log('\n\n--- PERFORMANCE CAR TRIM CHECK ---\n');
    
    const perfCars = [
      { make: 'Chevrolet', model: 'Camaro', expectedTrims: ['Base', 'Z28', 'IROC-Z', 'RS'] },
      { make: 'Chevrolet', model: 'Corvette', expectedTrims: ['Base', 'Z51', 'ZR1'] },
      { make: 'Pontiac', model: 'Firebird', expectedTrims: ['Base', 'Trans Am', 'Formula', 'GTA'] },
      { make: 'Ford', model: 'Mustang', expectedTrims: ['Base', 'GT', 'LX', 'SVO', 'Cobra'] },
      { make: 'Buick', model: 'Grand National', expectedTrims: ['Base', 'GNX', 'T-Type'] },
    ];
    
    for (const car of perfCars) {
      const result = await client.query(`
        SELECT ARRAY_AGG(DISTINCT display_trim ORDER BY display_trim) as trims
        FROM vehicle_fitments
        WHERE make ILIKE $1 AND model ILIKE $2 AND year >= 1980 AND year <= 1990
      `, [car.make, car.model]);
      
      const actualTrims = result.rows[0]?.trims?.filter(t => t) || [];
      const missingTrims = car.expectedTrims.filter(t => 
        !actualTrims.some(a => a.toLowerCase().includes(t.toLowerCase()))
      );
      
      if (missingTrims.length > 0) {
        console.log(`⚠️  ${car.make} ${car.model}:`);
        console.log(`   Has: ${actualTrims.join(', ') || 'Base only'}`);
        console.log(`   Missing: ${missingTrims.join(', ')}`);
      } else {
        console.log(`✅ ${car.make} ${car.model}: ${actualTrims.join(', ')}`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
