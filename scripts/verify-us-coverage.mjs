import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Popular US vehicles to verify
const usVehicles = [
  ['toyota', 'camry'], ['toyota', 'corolla'], ['toyota', 'rav4'], ['toyota', 'tacoma'], ['toyota', 'tundra'], ['toyota', '4runner'], ['toyota', 'highlander'],
  ['honda', 'accord'], ['honda', 'civic'], ['honda', 'cr-v'], ['honda', 'pilot'], ['honda', 'odyssey'],
  ['ford', 'f-150'], ['ford', 'mustang'], ['ford', 'explorer'], ['ford', 'escape'], ['ford', 'bronco'],
  ['chevrolet', 'silverado-1500'], ['chevrolet', 'tahoe'], ['chevrolet', 'camaro'], ['chevrolet', 'equinox'], ['chevrolet', 'traverse'],
  ['dodge', 'challenger'], ['dodge', 'charger'], ['dodge', 'durango'],
  ['ram', '1500'], ['ram', '2500'],
  ['jeep', 'wrangler'], ['jeep', 'grand-cherokee'], ['jeep', 'cherokee'],
  ['nissan', 'altima'], ['nissan', 'rogue'], ['nissan', 'frontier'],
  ['subaru', 'outback'], ['subaru', 'forester'], ['subaru', 'crosstrek'],
  ['mazda', 'cx-5'], ['mazda', 'mazda3'],
  ['hyundai', 'tucson'], ['hyundai', 'santa-fe'], ['hyundai', 'elantra'],
  ['kia', 'sorento'], ['kia', 'sportage'], ['kia', 'telluride'],
  ['tesla', 'model-3'], ['tesla', 'model-y'],
];

console.log('US Vehicle Coverage Check:\n');
console.log('Make/Model'.padEnd(35) + 'Total'.padStart(6) + '  Missing'.padStart(8) + '  Coverage');
console.log('-'.repeat(60));

let totalRecords = 0;
let totalMissing = 0;

for (const [make, model] of usVehicles) {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing
    FROM vehicle_fitments
    WHERE LOWER(make) = $1 AND LOWER(model) = $2
  `, [make, model]);
  
  const { total, missing } = result.rows[0];
  totalRecords += parseInt(total);
  totalMissing += parseInt(missing);
  
  if (parseInt(total) > 0) {
    const coverage = ((total - missing) / total * 100).toFixed(0);
    const status = missing == 0 ? '✅' : (coverage >= 80 ? '🟡' : '❌');
    console.log(`${status} ${make}/${model}`.padEnd(35) + `${total}`.padStart(6) + `${missing}`.padStart(8) + `  ${coverage}%`);
  }
}

console.log('-'.repeat(60));
const totalCoverage = ((totalRecords - totalMissing) / totalRecords * 100).toFixed(1);
console.log(`${'TOTAL'.padEnd(35)}${totalRecords}`.padStart(6) + `${totalMissing}`.padStart(8) + `  ${totalCoverage}%`);

pool.end();
