/**
 * Final cleanup of non-US records + enrich remaining US vehicles
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// === FINAL NON-US MODELS TO REMOVE ===
const finalNonUsModels = {
  toyota: ['tarago', 'crown-royal', 'crown-athlete', 'crown-majesta', 'avensis', 'verso', 'verso-s',
    'yaris-verso', 'corolla-verso', 'auris-hybrid', 'prius-alpha', 'prius-c', 'prius-v-japan',
    'iq-ev', 'aygo', 'aygo-x', 'c-hr-ev', 'gr-sport', 'gr86-japan', 'mirai-japan'],
  
  hyundai: ['h-1', 'santro', 'grand-starex', 'iload', 'i800', 'h100', 'h350', 'county',
    'aero-city', 'aero-town', 'super-aero-city', 'universe', 'global-900', 'unicity'],
  
  nissan: ['patrol-safari', 'evalia', 'nv350-urvan', 'bluebird-sylphy', 'nv350-caravan',
    'e-nv200', 'primastar-van', 'interstar-van', 'nv250', 'nv300', 'nv-passenger'],
  
  chevrolet: ['express-pasajeros', 'silverado-chasis', 'n400', 'n300', 'move', 'effect',
    'enjoy-china', 'wuling', 'baojun', 'monza-china', 'menlo', 'malibu-xl'],
  
  volkswagen: ['kombi', 't-series', 'lt', 'california', 'grand-california', 'california-beach',
    'california-coast', 'california-ocean', 'id-buzz-cargo', 'id-buzz-lwb'],
  
  ford: ['transit-trail', 'transit-nugget', 'transit-sport', 'tourneo-active', 'maverick-eu',
    'focus-st-line', 'kuga-st-line', 'puma-st-line', 'fiesta-st-line'],
  
  mitsubishi: ['adventure', 'attrage-sedan', 'galant-grunder', 'lancer-io', 'asx',
    'i-miev', 'minicab-miev', 'ek-space', 'ek-cross', 'ek-custom', 'ek-x'],
  
  mazda: ['atenza-wagon', 'axela-sedan', 'axela-sport', 'premacy-minivan', 'biante-minivan',
    'familia-van', 'bongo-friendee', 'flair-wagon', 'flair-crossover'],
  
  subaru: ['exiga-crossover', 'levorg-wagon', 'trezia-minivan', 'justy-europe',
    'libero', 'bighorn', 'domingo-van'],
  
  buick: ['century-china', 'regal-china', 'lacrosse-china', 'envision-china', 'gl6-mpv',
    'gl8-mpv', 'excelle-sedan', 'verano-sedan', 'velite-plug-in'],
  
  mini: ['clubman-all4', 'countryman-all4', 'paceman-all4', 'clubvan-commercial'],
  
  volvo: ['s60-cross-country', 'v60-cross-country', 'v70', 'xc70', 'c30', 'c70'],
};

console.log('=== FINAL CLEANUP ===\n');
let totalDeleted = 0;

for (const [make, models] of Object.entries(finalNonUsModels)) {
  if (models.length === 0) continue;
  const placeholders = models.map((_, i) => `$${i + 2}`).join(', ');
  const delResult = await pool.query(
    `DELETE FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${placeholders}) RETURNING id`,
    [make, ...models]
  );
  if (delResult.rowCount > 0) {
    console.log(`${make}: ${delResult.rowCount} deleted`);
    totalDeleted += delResult.rowCount;
  }
}

console.log(`\nTotal deleted: ${totalDeleted}`);

// === ENRICH REMAINING US VEHICLES ===
console.log('\n=== ENRICHING US VEHICLES ===\n');

const usVehicleData = [
  // Chevrolet HD Trucks
  { make: 'chevrolet', model: 'silverado-2500', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['LT245/75R16', 'LT265/70R17', 'LT275/70R18', 'LT275/65R20'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8},{d:20,w:8.5}] },
  { make: 'chevrolet', model: 'silverado-3500', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['LT245/75R16', 'LT265/70R17', 'LT275/70R18'], wheels: [{d:16,w:7},{d:17,w:7.5},{d:18,w:8}] },
  { make: 'chevrolet', model: 'caprice', years: [2011,2012,2013,2014,2015,2016,2017],
    tires: ['235/50R18', '245/45R19'], wheels: [{d:18,w:8},{d:19,w:8.5}] },
  { make: 'chevrolet', model: 'express-1500', years: [1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014],
    tires: ['245/75R16', '265/70R17'], wheels: [{d:16,w:7},{d:17,w:7.5}] },
  
  // Mercedes AMG models
  { make: 'mercedes', model: 'g-class', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['265/60R18', '275/55R19', '275/50R20', '295/40R21', '295/40R22'], wheels: [{d:18,w:8},{d:19,w:9},{d:20,w:9.5},{d:21,w:10},{d:22,w:10}] },
  { make: 'mercedes', model: 'g-class-amg', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['275/50R20', '295/40R21', '295/40R22'], wheels: [{d:20,w:9.5},{d:21,w:10},{d:22,w:10}] },
  { make: 'mercedes', model: 's-class-amg', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['255/45R18', '275/35R20', '255/35R21', '275/30R21'], wheels: [{d:18,w:8.5},{d:20,w:9},{d:21,w:9}] },
  { make: 'mercedes', model: 'e-class-amg', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['245/40R18', '255/35R19', '265/35R19', '275/30R20'], wheels: [{d:18,w:8},{d:19,w:8.5},{d:20,w:9}] },
  { make: 'mercedes', model: 'sl-class-amg', years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['255/40R18', '275/35R19', '285/30R20', '295/30R20'], wheels: [{d:18,w:8.5},{d:19,w:9},{d:20,w:9.5}] },
  
  // Nissan Quest
  { make: 'nissan', model: 'quest', years: [1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017],
    tires: ['215/70R15', '225/60R16', '235/55R18', '235/55R19'], wheels: [{d:15,w:6.5},{d:16,w:7},{d:18,w:7.5},{d:19,w:8}] },
  
  // Ram HD
  { make: 'ram', model: '2500', years: [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['LT265/70R17', 'LT275/70R18', 'LT285/60R20'], wheels: [{d:17,w:8},{d:18,w:8},{d:20,w:8.5}] },
  { make: 'ram', model: '3500', years: [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['LT265/70R17', 'LT275/70R18'], wheels: [{d:17,w:8},{d:18,w:8}] },
  
  // VW Beetle and Touareg
  { make: 'volkswagen', model: 'beetle', years: [1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019],
    tires: ['205/55R16', '215/55R17', '235/45R18'], wheels: [{d:16,w:6.5},{d:17,w:7},{d:18,w:7.5}] },
  { make: 'volkswagen', model: 'touareg', years: [2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025],
    tires: ['235/65R17', '255/55R18', '275/45R19', '285/40R20', '285/35R21'], wheels: [{d:17,w:7.5},{d:18,w:8},{d:19,w:8.5},{d:20,w:9},{d:21,w:9.5}] },
];

let totalEnriched = 0;

for (const v of usVehicleData) {
  const wheelSizes = v.wheels.map(w => ({ diameter: w.d, width: w.w, axle: 'square', isStock: true }));
  
  for (const year of v.years) {
    const result = await pool.query(`
      UPDATE vehicle_fitments SET 
        oem_tire_sizes = $4::jsonb,
        oem_wheel_sizes = CASE WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN $5::jsonb ELSE oem_wheel_sizes END,
        updated_at = NOW()
      WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2) AND year = $3
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      RETURNING id
    `, [v.make, v.model, year, JSON.stringify(v.tires), JSON.stringify(wheelSizes)]);
    
    if (result.rowCount > 0) {
      totalEnriched += result.rowCount;
    }
  }
}

console.log(`Total enriched: ${totalEnriched}`);

// Final stats
const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");

console.log('\n=== FINAL STATE ===');
console.log(`Total records: ${finalCount.rows[0].cnt}`);
console.log(`Missing tire sizes: ${missingCount.rows[0].cnt}`);
console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);

pool.end();
