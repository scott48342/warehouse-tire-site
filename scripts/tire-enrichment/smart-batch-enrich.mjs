/**
 * Smart Batch Enrichment
 * 
 * 1. Identifies remaining non-US models to remove
 * 2. Lists US models that need web search enrichment
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// More non-US models to remove
const moreNonUs = {
  toyota: ['pixis-epoch', 'pixis-mega', 'pixis-joy', 'pixis-space', 'ventury', 'corolla-ex', 
    'yaris-l', 'levin', 'reiz', 'izoa', 'wildlander', 'frontlander', 'bz3', 'bz4x-china',
    'crown-kluger', 'granvia', 'coaster', 'dyna', 'hiace-commuter'],
  
  volkswagen: ['crosspolo', 'passat-variant-alltrack', 'golf-variant-alltrack', 'gran-lavida',
    'lavida-plus', 'bora-china', 'sagitar-china', 'lamando-china', 'teramont-x', 'viloran',
    'id-6', 'id-6-x', 'id-6-crozz'],
  
  ford: ['falcon', 'territory-au', 'ranger-au', 'mondeo-au', 'focus-au', 'fiesta-au',
    'ka-sedan', 'ecosport-india', 'aspire', 'figo-aspire', 'freestyle'],
  
  chevrolet: ['spark-gt', 'chevy', 'chevy-c3', 'montana-sport', 'tornado', 'nexia',
    'cobalt-brazil', 'spin-activ', 'trax-china', 's10-brazil', 'colorado-thai'],
  
  honda: ['city-hatchback', 'city-sedan', 'wr-v-india', 'br-v-india', 'amaze-india',
    'mobilio-india', 'brio-india', 'jazz-india', 'n-box', 'n-one', 'n-wgn', 's660'],
  
  hyundai: ['i10-india', 'i20-india', 'grand-i10-india', 'xcent-india', 'verna-india',
    'creta-india', 'venue-india', 'aura-india', 'santro-india', 'eon-india'],
  
  nissan: ['magnite', 'kicks-india', 'sunny-india', 'terrano-india', 'micra-india',
    'datsun-go-india', 'datsun-go-plus', 'datsun-redi-go'],
  
  kia: ['sonet', 'seltos-india', 'carens-india', 'carnival-india'],
  
  mitsubishi: ['xpander-cross', 'pajero-sport-thai', 'triton-thai', 'attrage-thai',
    'mirage-thai', 'l200-eu', 'asx-eu', 'space-star-eu'],
  
  mazda: ['cx-3-japan', 'cx-30-japan', 'roadster-japan', 'flair', 'carol'],
  
  subaru: ['justy-eu', 'trezia-eu', 'libero'],
  
  mini: ['hatch', 'one', 'cooper-d', 'cooper-sd', 'john-cooper-works-gp'],
};

// Known US models that should be enriched
const usModelsToEnrich = [
  // Mercedes
  { make: 'mercedes', models: ['sl-class', 'cls-class', 'cls-class-amg', 'c-class-amg', 'slk-class', 'slc-class', 
    'amg-gt', 'maybach-s-class', 'eqs', 'eqe', 'eqs-suv', 'eqe-suv', 'eqb', 'eqa'] },
  
  // Chevrolet  
  { make: 'chevrolet', models: ['trailblazer', 'suburban-1500', 'suburban-2500', 'blazer', 'bolt-ev', 'bolt-euv',
    'spark', 'sonic', 'cruze', 'impala', 'ss', 'volt', 'malibu', 'trax'] },
  
  // Ford
  { make: 'ford', models: ['taurus', 'e-350', 'e-350-econoline', 'e-150', 'e-250', 'fiesta', 'focus', 
    'fusion', 'flex', 'expedition-max', 'super-duty', 'lightning', 'mach-e'] },
  
  // Volkswagen
  { make: 'volkswagen', models: ['jetta-gli', 'golf-gti', 'golf-r', 'arteon', 'atlas', 'atlas-cross-sport',
    'id-4', 'id-buzz', 'taos', 'tiguan', 'passat', 'jetta', 'golf'] },
  
  // Honda
  { make: 'honda', models: ['fit', 'insight', 'clarity', 'passport', 'element', 'crosstour', 'prologue'] },
  
  // Hyundai
  { make: 'hyundai', models: ['veloster', 'ioniq', 'ioniq-5', 'ioniq-6', 'kona', 'kona-ev', 'venue', 
    'accent', 'genesis-coupe', 'azera', 'veracruz'] },
  
  // Nissan
  { make: 'nissan', models: ['versa', 'sentra', 'maxima', 'murano', 'pathfinder', 'armada', 'kicks',
    '370z', 'gt-r', 'leaf', 'ariya', 'titan-xd', 'nv-cargo', 'nv-passenger', 'nv200'] },
  
  // Mazda
  { make: 'mazda', models: ['cx-3', 'cx-30', 'cx-50', 'cx-9', 'cx-90', 'mazda6', 'mx-5-miata', 'mx-30'] },
  
  // Subaru
  { make: 'subaru', models: ['brz', 'wrx', 'sti', 'ascent', 'solterra', 'baja', 'tribeca', 'svx'] },
  
  // Kia
  { make: 'kia', models: ['stinger', 'k5', 'forte', 'rio', 'soul', 'niro', 'ev6', 'ev9', 'carnival'] },
  
  // Others
  { make: 'buick', models: ['enclave', 'encore', 'encore-gx', 'envision', 'lacrosse', 'regal', 'verano', 'cascada'] },
  { make: 'cadillac', models: ['ct4', 'ct5', 'ct6', 'xt4', 'xt5', 'xt6', 'escalade', 'escalade-esv', 'lyriq', 'celestiq', 'ats', 'cts', 'xts'] },
  { make: 'gmc', models: ['canyon', 'sierra-1500', 'sierra-2500', 'sierra-3500', 'yukon', 'yukon-xl', 'acadia', 'terrain', 'hummer-ev'] },
  { make: 'lincoln', models: ['navigator', 'aviator', 'corsair', 'nautilus', 'mkz', 'mkc', 'mkt', 'mkx', 'continental'] },
  { make: 'infiniti', models: ['q50', 'q60', 'q70', 'qx50', 'qx55', 'qx60', 'qx80'] },
  { make: 'lexus', models: ['is', 'es', 'gs', 'ls', 'rc', 'lc', 'nx', 'rx', 'gx', 'lx', 'ux'] },
  { make: 'acura', models: ['tlx', 'ilx', 'rlx', 'mdx', 'rdx', 'zdx', 'integra', 'nsx'] },
  { make: 'genesis', models: ['g70', 'g80', 'g90', 'gv70', 'gv80', 'gv60'] },
  { make: 'porsche', models: ['911', 'cayman', 'boxster', 'panamera', 'taycan', 'macan', 'cayenne'] },
  { make: 'jaguar', models: ['xe', 'xf', 'xj', 'f-type', 'f-pace', 'e-pace', 'i-pace'] },
  { make: 'land-rover', models: ['range-rover', 'range-rover-sport', 'range-rover-velar', 'range-rover-evoque', 'discovery', 'discovery-sport', 'defender'] },
];

console.log('=== REMOVING MORE NON-US ===\n');
let totalRemoved = 0;

for (const [make, models] of Object.entries(moreNonUs)) {
  if (models.length === 0) continue;
  const placeholders = models.map((_, i) => `$${i + 2}`).join(', ');
  const del = await pool.query(
    `DELETE FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${placeholders}) RETURNING id`,
    [make, ...models]
  );
  if (del.rowCount > 0) {
    console.log(`${make}: ${del.rowCount} removed`);
    totalRemoved += del.rowCount;
  }
}

console.log(`\nTotal removed: ${totalRemoved}`);

// Now list what US models need enrichment
console.log('\n=== US MODELS NEEDING ENRICHMENT ===\n');

let needsEnrichment = [];

for (const { make, models } of usModelsToEnrich) {
  for (const model of models) {
    const result = await pool.query(`
      SELECT year, COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE LOWER(make) = $1 AND LOWER(model) = $2
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      GROUP BY year
      ORDER BY year DESC
    `, [make, model]);
    
    if (result.rows.length > 0) {
      const years = result.rows.map(r => r.year);
      const total = result.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0);
      needsEnrichment.push({ make, model, years, total });
    }
  }
}

// Sort by total missing (prioritize high-impact)
needsEnrichment.sort((a, b) => b.total - a.total);

console.log('Priority US vehicles to enrich:\n');
needsEnrichment.slice(0, 50).forEach((v, i) => {
  console.log(`${i+1}. ${v.make} ${v.model} (${v.total} records): ${v.years.join(', ')}`);
});

console.log(`\n\nTotal US vehicles needing enrichment: ${needsEnrichment.length}`);
console.log(`Total records to enrich: ${needsEnrichment.reduce((sum, v) => sum + v.total, 0)}`);

// Final stats
const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");

console.log('\n=== CURRENT STATE ===');
console.log(`Total records: ${finalCount.rows[0].cnt}`);
console.log(`Missing tire sizes: ${missingCount.rows[0].cnt}`);
console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);

pool.end();
