require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== 1990s VEHICLE FITMENT AUDIT (1990-1999) ===\n');
    
    // Overall stats
    const overall = await client.query(`
      SELECT COUNT(*) as total,
        COUNT(DISTINCT make) as makes,
        COUNT(DISTINCT CONCAT(make, ' ', model)) as models
      FROM vehicle_fitments
      WHERE year >= 1990 AND year <= 1999
    `);
    console.log(`Total records: ${overall.rows[0].total}`);
    console.log(`Makes: ${overall.rows[0].makes}`);
    console.log(`Models: ${overall.rows[0].models}\n`);
    
    // By make
    console.log('--- COVERAGE BY MAKE ---\n');
    const byMake = await client.query(`
      SELECT make, 
        COUNT(*) as records,
        COUNT(DISTINCT model) as models,
        MIN(year) as min_year,
        MAX(year) as max_year
      FROM vehicle_fitments
      WHERE year >= 1990 AND year <= 1999
      GROUP BY make
      ORDER BY records DESC
    `);
    
    console.log('Make                | Records | Models | Years');
    console.log('--------------------|---------|--------|----------');
    byMake.rows.forEach(r => {
      console.log(`${r.make.padEnd(19)} | ${String(r.records).padStart(7)} | ${String(r.models).padStart(6)} | ${r.min_year}-${r.max_year}`);
    });
    
    // Domestic makes detail
    console.log('\n\n--- DOMESTIC MAKES DETAIL ---\n');
    const domesticMakes = ['Ford', 'Chevrolet', 'Dodge', 'GMC', 'Jeep', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler', 'Pontiac', 'Oldsmobile', 'Mercury', 'Plymouth', 'Saturn'];
    
    for (const make of domesticMakes) {
      const models = await client.query(`
        SELECT model, 
          COUNT(*) as records,
          COUNT(DISTINCT display_trim) as trims,
          MIN(year) as min_year,
          MAX(year) as max_year,
          STRING_AGG(DISTINCT display_trim, ', ' ORDER BY display_trim) as trim_list
        FROM vehicle_fitments
        WHERE make = $1 AND year >= 1990 AND year <= 1999
        GROUP BY model
        ORDER BY records DESC
      `, [make]);
      
      if (models.rows.length > 0) {
        console.log(`\n${make.toUpperCase()} (${models.rows.length} models):`);
        models.rows.forEach(r => {
          const yearRange = r.min_year === r.max_year ? r.min_year : `${r.min_year}-${r.max_year}`;
          console.log(`  ${r.model}: ${yearRange} (${r.records} records, ${r.trims} trims)`);
        });
      }
    }
    
    // Japanese makes detail
    console.log('\n\n--- JAPANESE MAKES DETAIL ---\n');
    const japaneseMakes = ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi', 'Subaru', 'Acura', 'Lexus', 'Infiniti', 'Isuzu', 'Suzuki'];
    
    for (const make of japaneseMakes) {
      const models = await client.query(`
        SELECT model, 
          COUNT(*) as records,
          MIN(year) as min_year,
          MAX(year) as max_year
        FROM vehicle_fitments
        WHERE make = $1 AND year >= 1990 AND year <= 1999
        GROUP BY model
        ORDER BY model
      `, [make]);
      
      if (models.rows.length > 0) {
        console.log(`${make} (${models.rows.length} models):`);
        models.rows.forEach(r => {
          const yearRange = r.min_year === r.max_year ? r.min_year : `${r.min_year}-${r.max_year}`;
          const years = r.max_year - r.min_year + 1;
          const gap = years < 10 && r.min_year > 1990 ? ' ⚠️' : '';
          console.log(`  ${r.model}: ${yearRange} (${r.records} records)${gap}`);
        });
      }
    }
    
    // European makes
    console.log('\n\n--- EUROPEAN MAKES DETAIL ---\n');
    const europeanMakes = ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Volkswagen', 'Volvo', 'Porsche', 'Jaguar', 'Land Rover', 'Saab'];
    
    for (const make of europeanMakes) {
      const models = await client.query(`
        SELECT model, 
          COUNT(*) as records,
          MIN(year) as min_year,
          MAX(year) as max_year
        FROM vehicle_fitments
        WHERE make = $1 AND year >= 1990 AND year <= 1999
        GROUP BY model
        ORDER BY model
      `, [make]);
      
      if (models.rows.length > 0) {
        console.log(`${make} (${models.rows.length} models):`);
        models.rows.forEach(r => {
          const yearRange = r.min_year === r.max_year ? r.min_year : `${r.min_year}-${r.max_year}`;
          console.log(`  ${r.model}: ${yearRange} (${r.records} records)`);
        });
      }
    }
    
    // Data quality check
    console.log('\n\n--- DATA QUALITY CHECK ---\n');
    const quality = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN bolt_pattern IS NULL OR bolt_pattern = '' THEN 1 ELSE 0 END) as missing_bolt,
        SUM(CASE WHEN center_bore_mm IS NULL THEN 1 ELSE 0 END) as missing_hub,
        SUM(CASE WHEN offset_min_mm IS NULL OR offset_max_mm IS NULL THEN 1 ELSE 0 END) as missing_offset,
        SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null' THEN 1 ELSE 0 END) as missing_tires
      FROM vehicle_fitments
      WHERE year >= 1990 AND year <= 1999
    `);
    const q = quality.rows[0];
    console.log(`Total records: ${q.total}`);
    console.log(`Missing bolt_pattern: ${q.missing_bolt} (${(q.missing_bolt/q.total*100).toFixed(1)}%)`);
    console.log(`Missing center_bore_mm: ${q.missing_hub} (${(q.missing_hub/q.total*100).toFixed(1)}%)`);
    console.log(`Missing offset range: ${q.missing_offset} (${(q.missing_offset/q.total*100).toFixed(1)}%)`);
    console.log(`Missing oem_tire_sizes: ${q.missing_tires} (${(q.missing_tires/q.total*100).toFixed(1)}%)`);
    
    // Find gaps - expected models that might be missing
    console.log('\n\n--- EXPECTED MODELS CHECK ---\n');
    
    const expectedDomestic90s = [
      // Ford
      { make: 'Ford', model: 'F-150', years: '1990-1999' },
      { make: 'Ford', model: 'F-250', years: '1990-1999' },
      { make: 'Ford', model: 'F-350', years: '1990-1999' },
      { make: 'Ford', model: 'Ranger', years: '1990-1999' },
      { make: 'Ford', model: 'Explorer', years: '1991-1999' },
      { make: 'Ford', model: 'Expedition', years: '1997-1999' },
      { make: 'Ford', model: 'Mustang', years: '1990-1999' },
      { make: 'Ford', model: 'Taurus', years: '1990-1999' },
      { make: 'Ford', model: 'Escort', years: '1990-1999' },
      { make: 'Ford', model: 'Crown Victoria', years: '1992-1999' },
      { make: 'Ford', model: 'Bronco', years: '1990-1996' },
      { make: 'Ford', model: 'Thunderbird', years: '1990-1997' },
      { make: 'Ford', model: 'Probe', years: '1993-1997' },
      { make: 'Ford', model: 'Contour', years: '1995-1999' },
      { make: 'Ford', model: 'Windstar', years: '1995-1999' },
      { make: 'Ford', model: 'E-150', years: '1990-1999' },
      // Chevy
      { make: 'Chevrolet', model: 'Silverado', years: '1999' },
      { make: 'Chevrolet', model: 'C/K 1500', years: '1990-1998' },
      { make: 'Chevrolet', model: 'S-10', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Tahoe', years: '1995-1999' },
      { make: 'Chevrolet', model: 'Suburban', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Blazer', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Camaro', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Corvette', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Impala', years: '1994-1996' },
      { make: 'Chevrolet', model: 'Caprice', years: '1990-1996' },
      { make: 'Chevrolet', model: 'Lumina', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Cavalier', years: '1990-1999' },
      { make: 'Chevrolet', model: 'Monte Carlo', years: '1995-1999' },
      { make: 'Chevrolet', model: 'Astro', years: '1990-1999' },
      // Dodge
      { make: 'Dodge', model: 'Ram 1500', years: '1994-1999' },
      { make: 'Dodge', model: 'Ram 2500', years: '1994-1999' },
      { make: 'Dodge', model: 'Dakota', years: '1990-1999' },
      { make: 'Dodge', model: 'Durango', years: '1998-1999' },
      { make: 'Dodge', model: 'Caravan', years: '1990-1999' },
      { make: 'Dodge', model: 'Grand Caravan', years: '1990-1999' },
      { make: 'Dodge', model: 'Intrepid', years: '1993-1999' },
      { make: 'Dodge', model: 'Neon', years: '1995-1999' },
      { make: 'Dodge', model: 'Stratus', years: '1995-1999' },
      { make: 'Dodge', model: 'Viper', years: '1992-1999' },
      // GMC
      { make: 'GMC', model: 'Sierra', years: '1999' },
      { make: 'GMC', model: 'C/K 1500', years: '1990-1998' },
      { make: 'GMC', model: 'Yukon', years: '1992-1999' },
      { make: 'GMC', model: 'Jimmy', years: '1990-1999' },
      { make: 'GMC', model: 'Sonoma', years: '1991-1999' },
      { make: 'GMC', model: 'Safari', years: '1990-1999' },
      // Jeep
      { make: 'Jeep', model: 'Wrangler', years: '1990-1999' },
      { make: 'Jeep', model: 'Cherokee', years: '1990-1999' },
      { make: 'Jeep', model: 'Grand Cherokee', years: '1993-1999' },
      // Pontiac
      { make: 'Pontiac', model: 'Firebird', years: '1990-1999' },
      { make: 'Pontiac', model: 'Trans Am', years: '1990-1999' },
      { make: 'Pontiac', model: 'Grand Prix', years: '1990-1999' },
      { make: 'Pontiac', model: 'Grand Am', years: '1990-1999' },
      { make: 'Pontiac', model: 'Bonneville', years: '1990-1999' },
      { make: 'Pontiac', model: 'Sunfire', years: '1995-1999' },
    ];
    
    console.log('Checking expected domestic models...\n');
    const missing = [];
    const partial = [];
    
    for (const exp of expectedDomestic90s) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt, MIN(year) as min_y, MAX(year) as max_y
        FROM vehicle_fitments
        WHERE make = $1 AND model ILIKE $2 AND year >= 1990 AND year <= 1999
      `, [exp.make, `%${exp.model}%`]);
      
      if (parseInt(result.rows[0].cnt) === 0) {
        missing.push(`${exp.make} ${exp.model} (${exp.years})`);
      } else {
        const [expStart, expEnd] = exp.years.split('-').map(Number);
        const actStart = parseInt(result.rows[0].min_y);
        const actEnd = parseInt(result.rows[0].max_y);
        const expectedYears = (expEnd || expStart) - expStart + 1;
        const actualYears = actEnd - actStart + 1;
        
        if (actualYears < expectedYears * 0.7) {
          partial.push(`${exp.make} ${exp.model}: have ${actStart}-${actEnd}, expected ${exp.years}`);
        }
      }
    }
    
    if (missing.length > 0) {
      console.log('❌ MISSING MODELS:');
      missing.forEach(m => console.log(`  ${m}`));
    }
    
    if (partial.length > 0) {
      console.log('\n⚠️ PARTIAL COVERAGE:');
      partial.forEach(p => console.log(`  ${p}`));
    }
    
    if (missing.length === 0 && partial.length === 0) {
      console.log('✅ All expected domestic models present!');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
