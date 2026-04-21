/**
 * Final pass 2 - More cleanup + enrichment
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// More non-US
const nonUs = {
  toyota: ['wigo', 'ractis', 'hilux-revo', 'belta', 'etios-liva', 'etios-cross', 'vios-g', 'yaris-ativ',
    'glanza', 'urban-cruiser-hyryder', 'rumion', 'veloz', 'avanza-veloz', 'kijang-innova-zenix'],
  
  mazda: ['bt-50', 'az-offroad', 'flair-wagon-custom-style', 'b-series', 'az-wagon', 'scrum-truck',
    'familia-wagon', 'capella-wagon', 'proceed-marvie', 'bongo-van', 'titan-dump'],
  
  mitsubishi: ['colt-l300', 'delica-d-5', 'delica-d-2', 'pajero-tr4', 'colt-plus', 'lancer-cargo',
    'grandis-na4w', 'space-star-a05', 'asx-ga0w', 'outlander-gf', 'ek-cross-ev'],
  
  hyundai: ['h100-grace', 'county-bus', 'h-1-starex', 'starex-svx', 'iload-imax', 'porter-hr',
    'mighty-ex8', 'pavise-qv', 'xcient-qz', 'elec-city', 'universe-pv'],
  
  kia: ['k2900', 'k2500-bongo', 'k5-dl3', 'k8-gl3', 'k9-kh', 'ray-tam', 'towner-bongo'],
  
  nissan: ['e-nv200-evalia', 'nv200-evalia', 'nv350-caravan', 'safari-y61', 'patrol-y62', 'kicks-e-power',
    'note-e-power', 'serena-e-power', 'x-trail-e-power', 'leaf-e', 'ariya-b6'],
  
  honda: ['city-e-hev', 'city-rs', 'jazz-e-hev', 'hr-v-e-hev', 'wr-v-rs', 'br-v-rs', 'n-box-slash',
    'n-van', 's660-modulo', 'freed-modulo', 'step-wgn-modulo', 'odyssey-absolute'],
  
  volkswagen: ['nivus-brasil', 't-cross-brasil', 'polo-track-brasil', 'gol-gv', 'saveiro-cs',
    'amarok-v6', 'caddy-life', 'california-beach', 'california-coast', 'multivan-t7'],
  
  chevrolet: ['onix-plus', 'tracker-premier', 's10-high-country', 'blazer-rs', 'colorado-zr2-bison',
    'colorado-zr2-desert-boss', 'silverado-zr2', 'silverado-zr2-bison'],
  
  ford: ['ranger-raptor-next-gen', 'ranger-wildtrak', 'transit-trail', 'tourneo-custom',
    'tourneo-connect-titanium', 'ka-sedan', 'ka-trail', 'ka-active'],
  
  audi: ['a3-tfsi-e', 'a6-tfsi-e', 'a7-tfsi-e', 'a8-tfsi-e', 'q5-tfsi-e', 'q7-tfsi-e', 'q8-tfsi-e'],
  
  bmw: ['330e-xdrive', '530e-xdrive', '745e-xdrive', 'x3-xdrive30e', 'x5-xdrive45e', 'x5-xdrive50e'],
  
  mini: ['electric-hatch', 'countryman-phev', 'paceman-jcw', 'clubvan-d'],
  
  subaru: ['impreza-g4-sedan', 'impreza-sport-hatch', 'xv-crosstrek', 'levorg-sti', 'wrx-sti-spec-c'],
};

console.log('=== CLEANUP ===\n');
let totalRemoved = 0;

for (const [make, models] of Object.entries(nonUs)) {
  const ph = models.map((_, i) => `$${i + 2}`).join(', ');
  const del = await pool.query(
    `DELETE FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${ph}) RETURNING id`,
    [make, ...models]
  );
  if (del.rowCount > 0) {
    console.log(`${make}: ${del.rowCount}`);
    totalRemoved += del.rowCount;
  }
}

console.log(`\nRemoved: ${totalRemoved}`);

// More US enrichment
console.log('\n=== ENRICHING ===\n');

const moreUs = [
  // Toyota
  { make: 'toyota', model: '86', tires: ['205/55R16', '215/45R17', '215/40R18'], wheels: [{d:16,w:6.5},{d:17,w:7},{d:18,w:7.5}] },
  { make: 'toyota', model: 'prius-v', tires: ['195/65R15', '215/50R17'], wheels: [{d:15,w:6},{d:17,w:7}] },
  { make: 'toyota', model: 'gr86', tires: ['215/40R18'], wheels: [{d:18,w:7.5}] },
  { make: 'toyota', model: 'supra', tires: ['255/35R19', '275/35R19', '275/30R20', '295/30R20'], wheels: [{d:19,w:9},{d:19,w:10},{d:20,w:9.5},{d:20,w:10.5}] },
  { make: 'toyota', model: 'yaris', tires: ['185/60R15', '185/60R16', '205/45R17'], wheels: [{d:15,w:5.5},{d:16,w:6},{d:17,w:6.5}] },
  { make: 'toyota', model: 'matrix', tires: ['205/55R16', '215/45R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  { make: 'toyota', model: 'avalon', tires: ['215/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7},{d:18,w:8},{d:19,w:8}] },
  { make: 'toyota', model: 'sequoia', tires: ['275/65R18', '275/55R20', '305/45R22'], wheels: [{d:18,w:8},{d:20,w:9},{d:22,w:9.5}] },
  { make: 'toyota', model: 'sienna', tires: ['235/60R17', '235/55R18', '235/50R19', '235/50R20'], wheels: [{d:17,w:7},{d:18,w:7.5},{d:19,w:8},{d:20,w:8}] },
  { make: 'toyota', model: 'venza', tires: ['225/65R17', '245/55R19', '255/45R21'], wheels: [{d:17,w:7},{d:19,w:8},{d:21,w:8.5}] },
  
  // Mercedes
  { make: 'mercedes', model: 'e-class-coupe', tires: ['225/55R16', '245/40R18', '265/30R19'], wheels: [{d:16,w:7.5},{d:18,w:8},{d:19,w:9}] },
  { make: 'mercedes', model: 'gla-class', tires: ['215/60R17', '235/50R18', '235/45R19'], wheels: [{d:17,w:7},{d:18,w:7.5},{d:19,w:8}] },
  { make: 'mercedes', model: 'a-class-amg', tires: ['225/45R18', '235/40R19'], wheels: [{d:18,w:8},{d:19,w:8}] },
  { make: 'mercedes', model: 'cla-class-amg', tires: ['225/45R18', '235/40R19', '255/30R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'mercedes', model: 'gla-class-amg', tires: ['235/50R18', '255/40R20'], wheels: [{d:18,w:8},{d:20,w:9}] },
  { make: 'mercedes', model: 'a-class', tires: ['205/60R16', '225/45R18', '235/40R19'], wheels: [{d:16,w:6.5},{d:18,w:7.5},{d:19,w:8}] },
  { make: 'mercedes', model: 'cla-class', tires: ['205/55R16', '225/45R18', '235/40R19'], wheels: [{d:16,w:7},{d:18,w:7.5},{d:19,w:8}] },
  { make: 'mercedes', model: 'glb-class', tires: ['235/55R18', '235/50R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  
  // Audi
  { make: 'audi', model: 's8', tires: ['265/45R19', '275/35R21', '285/30R22'], wheels: [{d:19,w:9},{d:21,w:10},{d:22,w:10}] },
  { make: 'audi', model: 's6', tires: ['245/45R18', '255/40R19', '275/30R21'], wheels: [{d:18,w:8},{d:19,w:9},{d:21,w:9.5}] },
  { make: 'audi', model: 'tt', tires: ['225/50R17', '245/40R18', '255/30R20'], wheels: [{d:17,w:8},{d:18,w:8.5},{d:20,w:9}] },
  { make: 'audi', model: 'r8', tires: ['245/35R19', '295/35R19', '295/30R20', '305/30R20'], wheels: [{d:19,w:8.5},{d:19,w:11},{d:20,w:10},{d:20,w:11}] },
  { make: 'audi', model: 'tt-s', tires: ['245/40R18', '255/35R19', '255/30R20'], wheels: [{d:18,w:9},{d:19,w:9},{d:20,w:9}] },
  { make: 'audi', model: 'tt-rs', tires: ['245/35R19', '255/30R20'], wheels: [{d:19,w:9},{d:20,w:9}] },
  { make: 'audi', model: 'a3', tires: ['205/55R16', '225/45R17', '225/40R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'audi', model: 'a4', tires: ['225/55R16', '245/40R18', '255/35R19'], wheels: [{d:16,w:7},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'audi', model: 'a5', tires: ['225/55R16', '245/40R18', '255/35R19'], wheels: [{d:16,w:7},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'audi', model: 'a6', tires: ['225/55R17', '245/45R18', '255/40R19', '275/30R21'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5},{d:21,w:9}] },
  { make: 'audi', model: 'a7', tires: ['245/45R18', '255/40R19', '275/35R20', '275/30R21'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'audi', model: 'q5', tires: ['235/65R17', '235/60R18', '255/45R20', '265/40R21'], wheels: [{d:17,w:7},{d:18,w:8},{d:20,w:9},{d:21,w:9}] },
  { make: 'audi', model: 'q7', tires: ['235/65R18', '255/55R19', '285/45R20', '285/40R21'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'audi', model: 'q8', tires: ['265/55R19', '285/45R21', '285/40R22'], wheels: [{d:19,w:9},{d:21,w:10},{d:22,w:10}] },
  { make: 'audi', model: 'e-tron', tires: ['255/55R19', '265/45R21', '285/40R22'], wheels: [{d:19,w:9},{d:21,w:9.5},{d:22,w:10}] },
  { make: 'audi', model: 'e-tron-gt', tires: ['245/45R20', '265/40R21', '305/30R21'], wheels: [{d:20,w:9},{d:21,w:10},{d:21,w:11.5}] },
  
  // Mazda
  { make: 'mazda', model: 'mx-5', tires: ['195/50R16', '205/45R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  { make: 'mazda', model: 'mx-5-miata', tires: ['195/50R16', '205/45R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  { make: 'mazda', model: 'mazda6', tires: ['205/60R16', '225/55R17', '225/45R19'], wheels: [{d:16,w:6.5},{d:17,w:7.5},{d:19,w:7.5}] },
  { make: 'mazda', model: 'cx-3', tires: ['215/60R16', '215/50R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  { make: 'mazda', model: 'cx-30', tires: ['215/65R16', '215/55R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  
  // Mitsubishi US
  { make: 'mitsubishi', model: 'montero', tires: ['265/70R16', '275/55R20'], wheels: [{d:16,w:8},{d:20,w:8.5}] },
  { make: 'mitsubishi', model: 'outlander', tires: ['225/55R18', '255/45R20'], wheels: [{d:18,w:7},{d:20,w:8}] },
  { make: 'mitsubishi', model: 'outlander-sport', tires: ['215/65R16', '225/55R18'], wheels: [{d:16,w:6.5},{d:18,w:7}] },
  { make: 'mitsubishi', model: 'eclipse-cross', tires: ['225/55R18', '235/45R20'], wheels: [{d:18,w:7},{d:20,w:8}] },
  { make: 'mitsubishi', model: 'mirage', tires: ['165/65R14', '175/55R15'], wheels: [{d:14,w:5},{d:15,w:5.5}] },
  
  // BMW
  { make: 'bmw', model: '3-series', tires: ['205/60R16', '225/45R18', '255/35R19'], wheels: [{d:16,w:7},{d:18,w:8},{d:19,w:9}] },
  { make: 'bmw', model: '4-series', tires: ['225/45R18', '255/35R19', '275/30R20'], wheels: [{d:18,w:8},{d:19,w:9},{d:20,w:9}] },
  { make: 'bmw', model: '5-series', tires: ['225/55R17', '245/45R18', '275/35R19', '275/30R20'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:9},{d:20,w:9}] },
  { make: 'bmw', model: '7-series', tires: ['245/50R18', '275/40R19', '275/35R20', '275/30R21'], wheels: [{d:18,w:8},{d:19,w:9},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'bmw', model: 'x3', tires: ['225/60R18', '245/50R19', '255/45R20'], wheels: [{d:18,w:7.5},{d:19,w:8},{d:20,w:8.5}] },
  { make: 'bmw', model: 'x5', tires: ['255/55R18', '275/45R20', '275/40R21', '285/35R22'], wheels: [{d:18,w:8},{d:20,w:9},{d:21,w:9.5},{d:22,w:10}] },
  { make: 'bmw', model: 'x6', tires: ['275/45R20', '285/40R21', '285/35R22'], wheels: [{d:20,w:9},{d:21,w:10},{d:22,w:10.5}] },
  { make: 'bmw', model: 'm3', tires: ['255/35R19', '275/35R19', '275/30R20', '285/30R20'], wheels: [{d:19,w:9},{d:19,w:10},{d:20,w:9.5},{d:20,w:10.5}] },
  { make: 'bmw', model: 'm4', tires: ['255/35R19', '275/35R19', '275/30R20', '285/30R20'], wheels: [{d:19,w:9},{d:19,w:10},{d:20,w:9.5},{d:20,w:10.5}] },
  { make: 'bmw', model: 'm5', tires: ['275/40R19', '285/35R20', '285/30R21'], wheels: [{d:19,w:9.5},{d:20,w:10},{d:21,w:10.5}] },
  
  // Ford remaining
  { make: 'ford', model: 'edge', tires: ['235/60R18', '245/55R19', '255/45R20', '265/40R21'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9},{d:21,w:9}] },
  { make: 'ford', model: 'ecosport', tires: ['195/65R15', '205/50R17'], wheels: [{d:15,w:6},{d:17,w:6.5}] },
  { make: 'ford', model: 'transit-connect', tires: ['205/65R16', '215/55R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  { make: 'ford', model: 'e-150', tires: ['245/75R16', 'LT245/75R16'], wheels: [{d:16,w:7}] },
  { make: 'ford', model: 'e-250', tires: ['245/75R16', 'LT245/75R16'], wheels: [{d:16,w:7}] },
  { make: 'ford', model: 'c-max', tires: ['205/60R16', '225/50R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
];

let totalEnriched = 0;

for (const v of moreUs) {
  const wheelSizes = v.wheels.map(w => ({ diameter: w.d, width: w.w, axle: 'square', isStock: true }));
  
  const years = await pool.query(`
    SELECT DISTINCT year FROM vehicle_fitments
    WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
  `, [v.make, v.model]);
  
  if (years.rows.length === 0) continue;
  
  for (const row of years.rows) {
    const result = await pool.query(`
      UPDATE vehicle_fitments SET 
        oem_tire_sizes = $4::jsonb, oem_wheel_sizes = $5::jsonb, updated_at = NOW()
      WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) AND year = $3
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      RETURNING id
    `, [v.make, v.model, row.year, JSON.stringify(v.tires), JSON.stringify(wheelSizes)]);
    
    if (result.rowCount > 0) totalEnriched += result.rowCount;
  }
  
  if (years.rows.length > 0) console.log(`✅ ${v.make} ${v.model}: ${years.rows.length}`);
}

console.log(`\nEnriched: ${totalEnriched}`);

// Final stats
const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");

console.log('\n=== FINAL STATE ===');
console.log(`Total: ${finalCount.rows[0].cnt}`);
console.log(`Missing: ${missingCount.rows[0].cnt}`);
console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);

pool.end();
