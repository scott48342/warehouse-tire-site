/**
 * Final pass - cleanup remaining non-US + enrich remaining US
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// More non-US models
const nonUs = {
  toyota: ['agya', 'prius-a', 'aurion', 'prius-c-aqua', 'aqua', 'noah', 'voxy', 'alphard', 'vellfire',
    'esquire', 'sienta-japan', 'tank', 'roomy', 'porte', 'spade', 'passo', 'belta', 'vios',
    'fortuner', 'innova', 'avanza', 'rush', 'yaris-asia', 'yaris-sedan-asia'],
  
  hyundai: ['imax', 'atos-prime', 'santro-xing', 'solati', 'h300', 'h150', 'mighty', 'county',
    'trajet', 'matrix', 'lavita', 'getz-prime', 'verna-transform', 'accent-viva', 'i10-magna'],
  
  nissan: ['nv100-clipper', 'nt100-clipper', 'grand-livina', 'nv100-clipper-rio', 'crew', 'ad-van',
    'wingroad', 'cube-cubic', 'lafesta-highway-star', 'serena-highway-star', 'elgrand-rider',
    'teana-j32', 'sylphy-b17', 'sunny-n17', 'almera-classic'],
  
  honda: ['stepwgn-spada', 'acty', 'vamos', 'civic-5d', 'vamos-hobio', 'zest-spark', 'life-diva',
    'freed-spike', 'fit-shuttle-hybrid', 'n-box-custom', 'n-wgn-custom', 'n-one-premium'],
  
  mazda: ['axela-sport', 'atenza-sport', 'premacy-hydrogen', 'biante-granz', 'mpv-sport',
    'verisa', 'demio-sport', 'carol-eco'],
  
  mitsubishi: ['delica-d2', 'delica-d3', 'delica-d5', 'ek-wagon', 'ek-space-custom', 'minicab-van',
    'minicab-truck', 'town-box', 'i-miev-m', 'outlander-sport', 'rvr'],
  
  kia: ['morning-picanto', 'pride-rio', 'cerato-forte', 'lotze-optima', 'carens-rondo',
    'carnival-sedona-korea', 'mohave-borrego', 'quoris-k9', 'k3-forte', 'k5-optima'],
  
  volkswagen: ['gol-trend', 'saveiro-cross', 'fox-extreme', 'spacefox-suran', 'polo-classic',
    'santana-classic', 'lavida-family', 'sagitar-jetta', 'magotan-passat'],
  
  chevrolet: ['celta-classic', 'classic-corsa', 'agile-viva', 'prisma-onix', 'spin-activ7',
    'cobalt-sonic', 's10-trailboss', 'captiva-equinox', 'tracker-trax-asia'],
  
  ford: ['ikon-fiesta', 'figo-ka', 'ecosport-asia', 'transit-tourneo', 'transit-custom-kombi',
    'mondeo-fusion-eu', 's-max-galaxy', 'c-max-grand'],
  
  mini: ['hatch-3-door', 'hatch-5-door', 'one-d', 'one-first', 'cooper-d-clubman', 'cooper-sd-all4'],
  
  subaru: ['pleo-plus', 'stella-custom', 'lucra-custom', 'sambar-dias', 'days', 'r2-custom'],
  
  volvo: ['s60-polestar', 'v60-polestar', 'xc60-polestar', 'v40-cross-country', 'v40-r-design'],
  
  audi: ['a3-sedan-china', 'a4l-china', 'a6l-china', 'q5l-china', 'q3-china', 'q2l-china',
    'a3-sportback-china', 'q5l-sportback'],
  
  bmw: ['1-series-sedan-china', '3-series-long-china', '5-series-long-china', 'x1-long-china',
    '1-series-hatch', '2-series-active-tourer', '2-series-gran-tourer'],
};

console.log('=== FINAL CLEANUP ===\n');
let totalRemoved = 0;

for (const [make, models] of Object.entries(nonUs)) {
  const ph = models.map((_, i) => `$${i + 2}`).join(', ');
  const del = await pool.query(
    `DELETE FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${ph}) RETURNING id`,
    [make, ...models]
  );
  if (del.rowCount > 0) {
    console.log(`${make}: ${del.rowCount} removed`);
    totalRemoved += del.rowCount;
  }
}

console.log(`\nTotal removed: ${totalRemoved}`);

// More US models to enrich
console.log('\n=== ENRICHING MORE US MODELS ===\n');

const moreUs = [
  // Toyota
  { make: 'toyota', model: 'prius-plug-in', tires: ['195/65R15', '215/45R17'], wheels: [{d:15,w:6},{d:17,w:7}] },
  { make: 'toyota', model: 'mirai', tires: ['235/55R19', '245/45R20'], wheels: [{d:19,w:8},{d:20,w:8.5}] },
  { make: 'toyota', model: 'prius-prime', tires: ['195/65R15', '215/45R17'], wheels: [{d:15,w:6},{d:17,w:7}] },
  
  // Mercedes
  { make: 'mercedes', model: 'slk-class-amg', tires: ['225/40R18', '245/35R18', '255/30R19'], wheels: [{d:18,w:8},{d:19,w:8.5}] },
  { make: 'mercedes', model: 'm-class', tires: ['255/55R18', '265/45R20', '295/35R21'], wheels: [{d:18,w:8.5},{d:20,w:9},{d:21,w:10}] },
  { make: 'mercedes', model: 'm-class-amg', tires: ['265/45R20', '295/35R21', '295/35R22'], wheels: [{d:20,w:9},{d:21,w:10},{d:22,w:10}] },
  { make: 'mercedes', model: 'e-class-cabriolet', tires: ['225/55R16', '245/40R18', '255/35R19'], wheels: [{d:16,w:7.5},{d:18,w:8},{d:19,w:8.5}] },
  { make: 'mercedes', model: 'cl-class', tires: ['255/45R18', '275/40R19', '275/35R20'], wheels: [{d:18,w:8.5},{d:19,w:9},{d:20,w:9.5}] },
  { make: 'mercedes', model: 'cl-class-amg', tires: ['255/40R19', '275/35R20', '275/30R21'], wheels: [{d:19,w:9},{d:20,w:9.5},{d:21,w:10}] },
  { make: 'mercedes', model: 'glk-class', tires: ['235/60R17', '235/50R19'], wheels: [{d:17,w:7.5},{d:19,w:8}] },
  { make: 'mercedes', model: 'r-class', tires: ['235/65R17', '255/50R19'], wheels: [{d:17,w:7.5},{d:19,w:8.5}] },
  { make: 'mercedes', model: 's-class-coupe', tires: ['255/45R18', '275/35R20', '255/35R21'], wheels: [{d:18,w:8.5},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'mercedes', model: 's-class-cabriolet', tires: ['255/45R18', '275/35R20'], wheels: [{d:18,w:8.5},{d:20,w:9}] },
  { make: 'mercedes', model: 'gle-class-coupe', tires: ['275/50R19', '285/45R21', '295/35R22'], wheels: [{d:19,w:9},{d:21,w:10},{d:22,w:10.5}] },
  { make: 'mercedes', model: 'glc-class-coupe', tires: ['235/60R18', '255/45R20', '265/40R21'], wheels: [{d:18,w:8},{d:20,w:9},{d:21,w:9.5}] },
  
  // Chrysler
  { make: 'chrysler', model: '200', tires: ['215/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7},{d:18,w:8},{d:19,w:8}] },
  { make: 'chrysler', model: '300', tires: ['215/65R17', '235/55R18', '245/45R19', '245/45R20'], wheels: [{d:17,w:7},{d:18,w:7.5},{d:19,w:8},{d:20,w:8}] },
  { make: 'chrysler', model: 'pacifica', tires: ['235/60R18', '235/55R19', '245/50R20'], wheels: [{d:18,w:7.5},{d:19,w:8},{d:20,w:8}] },
  { make: 'chrysler', model: 'town-country', tires: ['225/65R16', '225/65R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  { make: 'chrysler', model: 'sebring', tires: ['205/65R15', '215/55R17', '225/45R18'], wheels: [{d:15,w:6},{d:17,w:7},{d:18,w:7.5}] },
  { make: 'chrysler', model: 'pt-cruiser', tires: ['195/65R15', '205/55R16', '205/50R17'], wheels: [{d:15,w:6},{d:16,w:6.5},{d:17,w:7}] },
  
  // GMC
  { make: 'gmc', model: 'acadia', tires: ['235/65R17', '255/55R20', '275/45R21'], wheels: [{d:17,w:7.5},{d:20,w:8.5},{d:21,w:9}] },
  { make: 'gmc', model: 'terrain', tires: ['225/65R17', '235/55R19', '235/50R20'], wheels: [{d:17,w:7},{d:19,w:8},{d:20,w:8}] },
  { make: 'gmc', model: 'canyon', tires: ['255/70R17', '265/65R18', '275/55R20'], wheels: [{d:17,w:8},{d:18,w:8},{d:20,w:8.5}] },
  { make: 'gmc', model: 'sierra-1500', tires: ['265/70R17', '275/60R20', '285/45R22'], wheels: [{d:17,w:8},{d:20,w:9},{d:22,w:9}] },
  { make: 'gmc', model: 'sierra-2500', tires: ['LT265/70R17', 'LT275/70R18', 'LT275/65R20'], wheels: [{d:17,w:8},{d:18,w:8},{d:20,w:8.5}] },
  { make: 'gmc', model: 'yukon', tires: ['265/70R17', '275/55R20', '285/45R22'], wheels: [{d:17,w:8},{d:20,w:9},{d:22,w:9}] },
  { make: 'gmc', model: 'yukon-xl', tires: ['265/70R17', '275/55R20', '285/45R22'], wheels: [{d:17,w:8},{d:20,w:9},{d:22,w:9}] },
  
  // Dodge
  { make: 'dodge', model: 'journey', tires: ['225/55R17', '225/55R19'], wheels: [{d:17,w:7},{d:19,w:7.5}] },
  { make: 'dodge', model: 'avenger', tires: ['215/60R16', '225/55R17', '225/50R18'], wheels: [{d:16,w:6.5},{d:17,w:7},{d:18,w:7.5}] },
  { make: 'dodge', model: 'caliber', tires: ['205/65R15', '215/60R17', '225/50R18'], wheels: [{d:15,w:6},{d:17,w:7},{d:18,w:7.5}] },
  { make: 'dodge', model: 'dart', tires: ['195/65R15', '225/45R17', '225/40R18'], wheels: [{d:15,w:6},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'dodge', model: 'nitro', tires: ['235/65R17', '245/50R20'], wheels: [{d:17,w:7},{d:20,w:8}] },
  
  // Ram
  { make: 'ram', model: '3500', tires: ['LT265/70R17', 'LT275/70R18'], wheels: [{d:17,w:8},{d:18,w:8}] },
  { make: 'ram', model: 'promaster', tires: ['225/75R16', 'LT235/65R16'], wheels: [{d:16,w:6.5}] },
  { make: 'ram', model: 'promaster-city', tires: ['215/55R16', '225/55R17'], wheels: [{d:16,w:6.5},{d:17,w:7}] },
  
  // More Infiniti
  { make: 'infiniti', model: 'q50', tires: ['225/55R17', '245/40R19', '255/35R19'], wheels: [{d:17,w:7.5},{d:19,w:9}] },
  { make: 'infiniti', model: 'q60', tires: ['225/55R17', '255/40R19', '265/35R19'], wheels: [{d:17,w:7.5},{d:19,w:9}] },
  { make: 'infiniti', model: 'qx50', tires: ['235/55R19', '255/45R20'], wheels: [{d:19,w:8},{d:20,w:8.5}] },
  { make: 'infiniti', model: 'qx60', tires: ['235/65R18', '235/55R20'], wheels: [{d:18,w:7.5},{d:20,w:8}] },
  { make: 'infiniti', model: 'qx80', tires: ['265/60R18', '275/50R22'], wheels: [{d:18,w:8},{d:22,w:8.5}] },
  
  // Lexus  
  { make: 'lexus', model: 'is', tires: ['225/45R17', '235/40R18', '255/35R19'], wheels: [{d:17,w:8},{d:18,w:8},{d:19,w:9}] },
  { make: 'lexus', model: 'es', tires: ['215/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7},{d:18,w:8},{d:19,w:8}] },
  { make: 'lexus', model: 'gs', tires: ['235/45R17', '245/40R18', '275/30R19'], wheels: [{d:17,w:8},{d:18,w:8},{d:19,w:9}] },
  { make: 'lexus', model: 'ls', tires: ['235/50R18', '245/45R19', '275/35R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'lexus', model: 'nx', tires: ['225/65R17', '235/55R18', '235/50R20'], wheels: [{d:17,w:7},{d:18,w:7.5},{d:20,w:8}] },
  { make: 'lexus', model: 'rx', tires: ['235/65R18', '235/55R20', '265/40R22'], wheels: [{d:18,w:8},{d:20,w:8},{d:22,w:9}] },
  { make: 'lexus', model: 'gx', tires: ['265/60R18', '265/55R19'], wheels: [{d:18,w:7.5},{d:19,w:8}] },
  { make: 'lexus', model: 'lx', tires: ['285/60R18', '275/50R21'], wheels: [{d:18,w:8},{d:21,w:9}] },
  { make: 'lexus', model: 'ux', tires: ['215/60R17', '225/50R18'], wheels: [{d:17,w:7},{d:18,w:7}] },
  { make: 'lexus', model: 'lc', tires: ['245/45R20', '275/35R21'], wheels: [{d:20,w:9},{d:21,w:10.5}] },
  
  // Tesla
  { make: 'tesla', model: 'model-s', tires: ['245/45R19', '265/35R21', '265/35R22'], wheels: [{d:19,w:8.5},{d:21,w:9},{d:22,w:9}] },
  { make: 'tesla', model: 'model-x', tires: ['255/45R20', '275/45R20', '285/35R22'], wheels: [{d:20,w:9},{d:22,w:10}] },
  
  // Acura
  { make: 'acura', model: 'tlx', tires: ['225/55R17', '245/40R19', '255/35R19'], wheels: [{d:17,w:7.5},{d:19,w:9}] },
  { make: 'acura', model: 'ilx', tires: ['205/55R16', '215/45R17'], wheels: [{d:16,w:7},{d:17,w:7}] },
  { make: 'acura', model: 'mdx', tires: ['245/60R18', '265/45R20', '275/40R21'], wheels: [{d:18,w:8},{d:20,w:9},{d:21,w:9.5}] },
  { make: 'acura', model: 'rdx', tires: ['235/60R18', '255/45R20'], wheels: [{d:18,w:8},{d:20,w:9}] },
  { make: 'acura', model: 'integra', tires: ['215/50R17', '235/40R19'], wheels: [{d:17,w:7.5},{d:19,w:8.5}] },
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
  
  if (years.rows.length > 0) console.log(`✅ ${v.make} ${v.model}: ${years.rows.length} years`);
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
