import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Exact US model names (no variants)
const usModels = [
  ['ford', 'f-150'], ['ford', 'mustang'], ['ford', 'explorer'], ['ford', 'escape'], ['ford', 'bronco'],
  ['chevrolet', 'silverado-1500'], ['chevrolet', 'tahoe'], ['chevrolet', 'camaro'], ['chevrolet', 'corvette'], ['chevrolet', 'equinox'],
  ['ram', '1500'], ['ram', '2500'], 
  ['dodge', 'challenger'], ['dodge', 'charger'], ['dodge', 'durango'],
  ['jeep', 'wrangler'], ['jeep', 'grand-cherokee'],
  ['toyota', 'camry'], ['toyota', 'corolla'], ['toyota', 'rav4'], ['toyota', 'tacoma'], ['toyota', '4runner'],
  ['honda', 'accord'], ['honda', 'civic'], ['honda', 'cr-v'], ['honda', 'pilot'],
  ['nissan', 'altima'], ['nissan', 'rogue'], ['nissan', 'frontier'],
  ['subaru', 'outback'], ['subaru', 'forester'], ['subaru', 'crosstrek'],
  ['mazda', 'cx-5'], ['mazda', 'mazda3'],
  ['hyundai', 'tucson'], ['hyundai', 'santa-fe'], ['hyundai', 'elantra'],
  ['kia', 'sorento'], ['kia', 'sportage'], ['kia', 'telluride'],
];

console.log('US vehicles (exact model match) needing tire sizes:');
console.log('');

let found = 0;
for (const [make, model] of usModels) {
  const result = await pool.query(`
    SELECT year, make, model, COUNT(*) as trim_count
    FROM vehicle_fitments
    WHERE LOWER(make) = $1 
      AND LOWER(model) = $2
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      AND year BETWEEN 2010 AND 2024
    GROUP BY year, make, model
    ORDER BY year DESC
    LIMIT 3
  `, [make.toLowerCase(), model.toLowerCase()]);
  
  if (result.rows.length > 0) {
    result.rows.forEach(r => {
      found++;
      console.log(`${r.year} ${r.make} ${r.model} (${r.trim_count} trims)`);
    });
  }
}

console.log(`\nFound ${found} US YMM combinations needing enrichment`);
pool.end();
