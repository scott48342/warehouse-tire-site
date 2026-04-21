/**
 * Auto-enrich US vehicles with known fitment data
 * Uses manufacturer specs and standard sizes
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Researched fitment data for remaining US vehicles
const fitmentData = [
  // Ford
  { make: 'ford', model: 'taurus', tires: ['235/55R17', '245/45R19', '255/40R20'], wheels: [{d:17,w:7.5},{d:19,w:8},{d:20,w:8.5}] },
  { make: 'ford', model: 'e-350-econoline', tires: ['LT225/75R16', 'LT245/75R16'], wheels: [{d:16,w:7}] },
  { make: 'ford', model: 'fiesta', tires: ['185/60R15', '195/50R16', '205/45R17'], wheels: [{d:15,w:6},{d:16,w:6.5},{d:17,w:7}] },
  { make: 'ford', model: 'flex', tires: ['235/60R18', '255/50R19', '265/45R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'ford', model: 'focus', tires: ['205/55R16', '215/50R17', '235/40R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'ford', model: 'fusion', tires: ['225/50R17', '235/45R18', '245/40R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5}] },
  
  // Mercedes
  { make: 'mercedes', model: 'sl-class', tires: ['255/40R18', '275/35R19', '285/30R20'], wheels: [{d:18,w:8.5},{d:19,w:9},{d:20,w:9.5}] },
  { make: 'mercedes', model: 'cls-class', tires: ['245/40R18', '255/35R19', '275/30R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'mercedes', model: 'cls-class-amg', tires: ['255/35R19', '275/30R20', '285/30R21'], wheels: [{d:19,w:9},{d:20,w:9.5},{d:21,w:10}] },
  { make: 'mercedes', model: 'c-class-amg', tires: ['225/40R18', '245/35R19', '255/30R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'mercedes', model: 'slk-class', tires: ['205/55R16', '225/45R17', '245/40R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'mercedes', model: 'slc-class', tires: ['225/45R17', '245/40R18', '255/35R18'], wheels: [{d:17,w:7.5},{d:18,w:8}] },
  { make: 'mercedes', model: 'amg-gt', tires: ['265/35R19', '295/30R20', '325/30R21'], wheels: [{d:19,w:9.5},{d:20,w:10},{d:21,w:11}] },
  { make: 'mercedes', model: 'eqs', tires: ['265/40R21', '285/35R22'], wheels: [{d:21,w:9.5},{d:22,w:10}] },
  { make: 'mercedes', model: 'eqe', tires: ['255/45R19', '275/40R20', '285/35R21'], wheels: [{d:19,w:8.5},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'mercedes', model: 'eqb', tires: ['235/55R18', '235/50R19', '255/45R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  { make: 'mercedes', model: 'eqa', tires: ['215/60R18', '235/55R18', '235/50R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  
  // Land Rover
  { make: 'land-rover', model: 'range-rover-sport', tires: ['255/55R19', '275/45R21', '285/40R22', '285/35R23'], wheels: [{d:19,w:8.5},{d:21,w:9.5},{d:22,w:10},{d:23,w:10}] },
  { make: 'land-rover', model: 'defender', tires: ['255/65R18', '255/60R20', '275/50R22'], wheels: [{d:18,w:8},{d:20,w:8.5},{d:22,w:9}] },
  { make: 'land-rover', model: 'discovery-sport', tires: ['235/60R18', '235/55R19', '245/45R20'], wheels: [{d:18,w:8},{d:19,w:8},{d:20,w:8.5}] },
  { make: 'land-rover', model: 'range-rover-velar', tires: ['255/55R19', '275/45R20', '275/40R21', '285/35R22'], wheels: [{d:19,w:8.5},{d:20,w:9},{d:21,w:9.5},{d:22,w:10}] },
  { make: 'land-rover', model: 'range-rover-evoque', tires: ['235/60R18', '245/45R20', '255/40R21'], wheels: [{d:18,w:8},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'land-rover', model: 'discovery', tires: ['255/60R19', '275/45R21', '285/40R22'], wheels: [{d:19,w:8.5},{d:21,w:9.5},{d:22,w:10}] },
  
  // Chevrolet
  { make: 'chevrolet', model: 'trailblazer', tires: ['215/55R17', '225/55R18', '235/45R19'], wheels: [{d:17,w:7},{d:18,w:7.5},{d:19,w:8}] },
  { make: 'chevrolet', model: 'suburban-1500', tires: ['265/70R17', '275/55R20', '285/45R22'], wheels: [{d:17,w:8},{d:20,w:9},{d:22,w:9.5}] },
  { make: 'chevrolet', model: 'suburban-2500', tires: ['LT265/70R17', 'LT275/70R18'], wheels: [{d:17,w:8},{d:18,w:8}] },
  { make: 'chevrolet', model: 'blazer', tires: ['235/65R17', '255/55R20', '275/45R21'], wheels: [{d:17,w:7.5},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'chevrolet', model: 'trax', tires: ['205/70R16', '215/55R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  { make: 'chevrolet', model: 'volt', tires: ['215/55R17', '215/50R17'], wheels: [{d:17,w:7}] },
  { make: 'chevrolet', model: 'spark', tires: ['185/55R15', '195/50R16'], wheels: [{d:15,w:5.5},{d:16,w:6}] },
  { make: 'chevrolet', model: 'sonic', tires: ['195/65R15', '205/55R16', '215/50R17'], wheels: [{d:15,w:6},{d:16,w:6.5},{d:17,w:7}] },
  { make: 'chevrolet', model: 'cruze', tires: ['205/55R16', '215/50R17', '225/45R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'chevrolet', model: 'bolt-ev', tires: ['215/50R17'], wheels: [{d:17,w:7}] },
  { make: 'chevrolet', model: 'bolt-euv', tires: ['215/50R17'], wheels: [{d:17,w:7}] },
  
  // Volkswagen
  { make: 'volkswagen', model: 'jetta-gli', tires: ['225/45R17', '225/40R18'], wheels: [{d:17,w:7.5},{d:18,w:8}] },
  { make: 'volkswagen', model: 'arteon', tires: ['245/45R18', '255/40R19', '255/35R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'volkswagen', model: 'atlas-cross-sport', tires: ['245/60R18', '255/50R20', '265/45R21'], wheels: [{d:18,w:8},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'volkswagen', model: 'golf-gti', tires: ['225/45R17', '225/40R18', '235/35R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8}] },
  { make: 'volkswagen', model: 'golf-r', tires: ['235/35R19'], wheels: [{d:19,w:8}] },
  { make: 'volkswagen', model: 'id-4', tires: ['235/55R19', '255/45R20', '255/40R21'], wheels: [{d:19,w:8},{d:20,w:8.5},{d:21,w:9}] },
  
  // Honda
  { make: 'honda', model: 'passport', tires: ['245/60R18', '265/45R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'honda', model: 'clarity', tires: ['235/45R18'], wheels: [{d:18,w:8}] },
  { make: 'honda', model: 'crosstour', tires: ['225/65R17', '235/60R18'], wheels: [{d:17,w:7.5},{d:18,w:8}] },
  { make: 'honda', model: 'fit', tires: ['175/65R15', '185/55R16'], wheels: [{d:15,w:5.5},{d:16,w:6}] },
  { make: 'honda', model: 'insight', tires: ['185/65R15', '215/50R17'], wheels: [{d:15,w:6},{d:17,w:7}] },
  { make: 'honda', model: 'element', tires: ['215/70R16', '225/55R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  
  // Hyundai
  { make: 'hyundai', model: 'veloster', tires: ['215/45R17', '225/40R18'], wheels: [{d:17,w:7},{d:18,w:7.5}] },
  { make: 'hyundai', model: 'veracruz', tires: ['235/65R17', '245/60R18', '265/50R20'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:20,w:8.5}] },
  { make: 'hyundai', model: 'ioniq-5', tires: ['235/55R19', '255/45R20'], wheels: [{d:19,w:8},{d:20,w:8.5}] },
  { make: 'hyundai', model: 'ioniq-6', tires: ['225/55R18', '245/40R20'], wheels: [{d:18,w:7.5},{d:20,w:8.5}] },
  { make: 'hyundai', model: 'kona', tires: ['215/55R17', '235/45R18'], wheels: [{d:17,w:7},{d:18,w:7.5}] },
  
  // Kia
  { make: 'kia', model: 'stinger', tires: ['225/45R18', '255/35R19', '255/35R20'], wheels: [{d:18,w:8},{d:19,w:9},{d:20,w:9}] },
  { make: 'kia', model: 'niro', tires: ['205/60R16', '225/45R18'], wheels: [{d:16,w:6.5},{d:18,w:7.5}] },
  { make: 'kia', model: 'ev6', tires: ['235/55R19', '255/45R20', '255/40R21'], wheels: [{d:19,w:8},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'kia', model: 'carnival', tires: ['235/60R18', '235/55R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  
  // Mazda
  { make: 'mazda', model: 'cx-9', tires: ['245/60R18', '255/50R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'mazda', model: 'mx-30', tires: ['215/55R18'], wheels: [{d:18,w:7}] },
  { make: 'mazda', model: 'cx-50', tires: ['225/65R17', '225/55R19'], wheels: [{d:17,w:7},{d:19,w:7.5}] },
  { make: 'mazda', model: 'cx-90', tires: ['255/55R19', '275/40R21'], wheels: [{d:19,w:8.5},{d:21,w:9.5}] },
  
  // Subaru
  { make: 'subaru', model: 'tribeca', tires: ['255/55R18', '255/50R19'], wheels: [{d:18,w:8},{d:19,w:8.5}] },
  { make: 'subaru', model: 'baja', tires: ['215/60R16', '225/55R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  { make: 'subaru', model: 'ascent', tires: ['245/60R18', '255/55R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'subaru', model: 'solterra', tires: ['235/60R18', '235/50R20'], wheels: [{d:18,w:7.5},{d:20,w:8}] },
  { make: 'subaru', model: 'brz', tires: ['205/55R16', '215/45R17', '215/40R18'], wheels: [{d:16,w:6.5},{d:17,w:7},{d:18,w:7.5}] },
  
  // Buick
  { make: 'buick', model: 'encore', tires: ['205/65R16', '215/55R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  { make: 'buick', model: 'encore-gx', tires: ['225/55R18', '225/45R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  { make: 'buick', model: 'envision', tires: ['225/65R17', '235/55R19', '245/45R20'], wheels: [{d:17,w:7},{d:19,w:8},{d:20,w:8.5}] },
  { make: 'buick', model: 'enclave', tires: ['255/65R18', '255/55R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'buick', model: 'lacrosse', tires: ['235/50R18', '245/40R19'], wheels: [{d:18,w:8},{d:19,w:8.5}] },
  { make: 'buick', model: 'regal', tires: ['225/55R17', '245/45R18', '245/40R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'buick', model: 'verano', tires: ['215/60R16', '225/50R17', '235/45R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  
  // Cadillac
  { make: 'cadillac', model: 'ct6', tires: ['235/55R18', '245/45R19', '265/35R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'cadillac', model: 'ats', tires: ['225/45R17', '235/40R18', '245/35R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'cadillac', model: 'xts', tires: ['235/55R18', '245/40R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'cadillac', model: 'cts', tires: ['225/55R16', '245/45R18', '255/35R19'], wheels: [{d:16,w:7},{d:18,w:8},{d:19,w:8.5}] },
  
  // Lincoln
  { make: 'lincoln', model: 'mkt', tires: ['235/60R18', '255/45R20'], wheels: [{d:18,w:8},{d:20,w:8.5}] },
  { make: 'lincoln', model: 'mkc', tires: ['235/55R18', '235/50R19'], wheels: [{d:18,w:8},{d:19,w:8}] },
  { make: 'lincoln', model: 'mkx', tires: ['235/60R18', '255/50R20', '265/40R21'], wheels: [{d:18,w:8},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'lincoln', model: 'continental', tires: ['245/50R18', '255/40R19', '275/35R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  
  // Infiniti
  { make: 'infiniti', model: 'q70', tires: ['245/50R18', '265/40R20'], wheels: [{d:18,w:8},{d:20,w:9}] },
  { make: 'infiniti', model: 'qx55', tires: ['235/55R19', '255/45R20'], wheels: [{d:19,w:8},{d:20,w:8.5}] },
  
  // Lexus
  { make: 'lexus', model: 'rc', tires: ['225/45R17', '235/40R18', '255/35R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:9}] },
  
  // Porsche
  { make: 'porsche', model: 'cayman', tires: ['235/40R18', '265/40R18', '235/35R19', '275/35R19', '245/35R20', '295/30R20'], wheels: [{d:18,w:8},{d:18,w:9},{d:19,w:8},{d:19,w:10},{d:20,w:8.5},{d:20,w:10.5}] },
  { make: 'porsche', model: 'boxster', tires: ['235/40R18', '265/40R18', '235/35R19', '275/35R19'], wheels: [{d:18,w:8},{d:18,w:9},{d:19,w:8},{d:19,w:10}] },
  
  // Jaguar
  { make: 'jaguar', model: 'xj', tires: ['245/45R18', '275/35R20', '275/30R21'], wheels: [{d:18,w:8},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'jaguar', model: 'xe', tires: ['225/50R17', '245/40R18', '255/35R19'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'jaguar', model: 'xf', tires: ['225/55R17', '255/45R18', '275/35R20'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:20,w:9}] },
  { make: 'jaguar', model: 'f-type', tires: ['245/45R18', '275/35R20', '265/35R20', '305/30R20'], wheels: [{d:18,w:8},{d:20,w:9},{d:20,w:10.5}] },
  { make: 'jaguar', model: 'f-pace', tires: ['255/55R19', '265/45R21', '275/40R22'], wheels: [{d:19,w:8.5},{d:21,w:9.5},{d:22,w:10}] },
  { make: 'jaguar', model: 'e-pace', tires: ['235/60R18', '245/50R19', '255/45R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'jaguar', model: 'i-pace', tires: ['245/50R20', '265/40R22'], wheels: [{d:20,w:9},{d:22,w:10}] },
  
  // Genesis
  { make: 'genesis', model: 'gv60', tires: ['255/45R20', '255/40R21'], wheels: [{d:20,w:9},{d:21,w:9.5}] },
];

console.log('=== AUTO-ENRICHING US VEHICLES ===\n');
let totalEnriched = 0;

for (const v of fitmentData) {
  const wheelSizes = v.wheels.map(w => ({ diameter: w.d, width: w.w, axle: 'square', isStock: true }));
  
  // Get all years for this model that need enrichment
  const years = await pool.query(`
    SELECT DISTINCT year FROM vehicle_fitments
    WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    ORDER BY year
  `, [v.make, v.model]);
  
  if (years.rows.length === 0) continue;
  
  for (const row of years.rows) {
    const result = await pool.query(`
      UPDATE vehicle_fitments SET 
        oem_tire_sizes = $4::jsonb,
        oem_wheel_sizes = CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN $5::jsonb ELSE oem_wheel_sizes END,
        updated_at = NOW()
      WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) AND year = $3
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      RETURNING id
    `, [v.make, v.model, row.year, JSON.stringify(v.tires), JSON.stringify(wheelSizes)]);
    
    if (result.rowCount > 0) totalEnriched += result.rowCount;
  }
  
  if (years.rows.length > 0) {
    console.log(`✅ ${v.make} ${v.model}: ${years.rows.length} years enriched`);
  }
}

console.log(`\nTotal enriched: ${totalEnriched}`);

// Final stats
const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");

console.log('\n=== FINAL STATE ===');
console.log(`Total records: ${finalCount.rows[0].cnt}`);
console.log(`Missing tire sizes: ${missingCount.rows[0].cnt}`);
console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);

pool.end();
