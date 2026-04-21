/**
 * Remove all non-US vehicle records
 * 
 * Identifies and removes:
 * - Regional variants (China L/XL models, EU variants)
 * - Non-US market models (Japan-only, EU-only, etc.)
 * - Commercial vehicles not sold at retail
 */
import pg from 'pg';
import fs from 'fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Known non-US models by make
const nonUsModels = {
  toyota: ['allion', 'alphard', 'aqua', 'auris', 'avanza', 'axio', 'bb', 'belta', 'brevis', 'caldina', 
    'cami', 'century', 'chaser', 'coaster', 'comfort', 'corolla-altis', 'corolla-axio', 'corolla-fielder', 
    'corolla-quest', 'corolla-rumion', 'corona', 'cressida', 'crown', 'dyna', 'estima', 'etios', 
    'fortuner', 'harrier', 'hiace', 'hilux', 'innova', 'ipsum', 'isis', 'ist', 'kluger', 'land-cruiser-prado',
    'lite-ace', 'mark-ii', 'mark-ii-blit', 'mark-x', 'nadia', 'noah', 'opa', 'passo', 'pixis', 'platz',
    'porte', 'premio', 'probox', 'proace', 'progres', 'raize', 'raum', 'rav4-j', 'regius', 'roomy',
    'rush', 'sai', 'sienta', 'spacio', 'sparky', 'succeed', 'tank', 'tercel', 'town-ace', 'urban-cruiser',
    'vanguard', 'vellfire', 'verossa', 'vios', 'vitz', 'voltz', 'voxy', 'will-cypha', 'wish', 'yaris-cross'],
  
  nissan: ['ad', 'almera', 'bassara', 'bluebird', 'caravan', 'cedric', 'cima', 'cube', 'dayz', 'dualis',
    'elgrand', 'expert', 'fuga', 'gloria', 'juke-nismo', 'lafesta', 'latio', 'laurel', 'liberty', 'livina',
    'march', 'micra', 'moco', 'navara', 'note', 'np300', 'np300-hardbody', 'nv150', 'nv200', 'nv350',
    'otti', 'patrol', 'pino', 'pixo', 'presage', 'president', 'primastar', 'primera', 'pulsar', 'qashqai',
    'roox', 'safari', 'serena', 'silvia', 'skyline', 'skystar', 'stagea', 'sunny', 'sylphy', 'sylphy-classic',
    'teana', 'terrano', 'tiida', 'tino', 'tsuru', 'vanette', 'wingroad', 'x-trail'],
  
  honda: ['airwave', 'amaze', 'brio', 'city', 'crossroad', 'edix', 'elysion', 'fit-aria', 'freed', 'grace',
    'insight-exclusive', 'jade', 'jazz', 'legend', 'life', 'logo', 'mobilio', 'n-box', 'n-one', 'n-wgn',
    'partner', 's660', 'shuttle', 'stepwgn', 'stream', 'vezel', 'wr-v', 'zest'],
  
  volkswagen: ['amarok', 'arteon-shooting-brake', 'bora', 'caddy', 'caravelle', 'cc', 'crossfox', 'crafter',
    'eos', 'fox', 'gol', 'golf-plus', 'golf-sportsvan', 'golf-touran', 'golf-variant', 'gran-california',
    'lamando', 'lavida', 'lupo', 'magotan', 'multivan', 'nivus', 'novo-fusca', 'passat-alltrack',
    'passat-cc', 'passat-pro', 'passat-variant', 'phaeton', 'polo-sedan', 'polo-track', 'sagitar',
    'saveiro', 'scirocco', 'sharan', 'spacefox', 'suran', 't-cross', 't-roc', 'talagon', 'taos-china',
    'tavendor', 'tayron', 'tayron-l', 'tayron-x', 'tera', 'tharu', 'tiguan-allspace', 'touran',
    'transporter', 'up', 'viloran', 'virtus', 'voyage'],
  
  chevrolet: ['agile', 'astra', 'aveo-sedan', 'captiva', 'celta', 'classic', 'cobalt-brazil', 'corsa',
    'cruze-hatch', 'enjoy', 'epica', 'essential', 'exclusive', 'express-2500', 'express-3500',
    'kalos', 'lacetti', 'labo', 'lanos', 'matiz', 'meriva', 'montana', 'monza', 'niva', 'nubira',
    'omega', 'onix', 'optra', 'orlando', 'prisma', 'rezzo', 's10-brazil', 'sail', 'spin', 'tavera',
    'tracker-brazil', 'trax-china', 'vectra', 'zafira'],
  
  ford: ['b-max', 'bantam', 'c-max', 'courier', 'ecosport-india', 'endeavour', 'escort-china', 'escort-eu',
    'everest', 'figo', 'fiesta-sedan', 'focus-active', 'galaxy', 'grand-c-max', 'ikon', 'ka', 'ka-plus',
    'kuga', 'laser', 'lobo', 'mondeo', 'puma', 'ranger-raptor', 's-max', 'territory-china', 'territory-aus',
    'tourneo', 'tourneo-connect', 'tourneo-courier', 'tourneo-custom', 'transit-chassis', 'transit-connect',
    'transit-courier', 'transit-custom'],
  
  hyundai: ['accent-sedan', 'aura', 'atos', 'avante', 'centennial', 'click', 'county', 'creta', 'dynasty',
    'elantra-hd', 'eon', 'equus', 'excel', 'galloper', 'genesis-coupe', 'gets', 'getz', 'grace', 'grand-i10',
    'grandeur', 'i10', 'i20', 'i30', 'i40', 'i45', 'ix20', 'ix35', 'ix55', 'lantra', 'lavita', 'matrix',
    'mighty', 'porter', 'santamo', 'solaris', 'starex', 'stellar', 'terracan', 'trajet', 'tucson-l',
    'universe', 'verna', 'xcent'],
  
  kia: ['carens', 'carnival-minivan', 'ceed', 'cerato', 'clarus', 'credos', 'grand-carnival', 'joice',
    'lotze', 'magentis', 'mentor', 'morning', 'opirus', 'optima-d4', 'pegas', 'picanto', 'pride',
    'pro-ceed', 'quoris', 'retona', 'rio-sedan', 'rocsta', 'sephia', 'shuma', 'spectra', 'sportage-ace',
    'stonic', 'venga', 'xceed'],
  
  mazda: ['323', 'atenza', 'axela', 'biante', 'bongo', 'capella', 'carol', 'demio', 'familia', 'flair',
    'lantis', 'mpv', 'premacy', 'proceed', 'revue', 'roadster', 'scrum', 'tribute', 'verisa'],
  
  mercedes: ['a-class-limousine', 'b-class', 'citan', 'r-class', 'sprinter', 'sprinter-chassis', 
    'v-class', 'viano', 'vito', 'x-class'],
  
  bmw: ['1-series-sedan', '2-series-active-tourer', '2-series-gran-tourer', 'ix2', 'ix3'],
  
  audi: ['a1', 'a3-limousine', 'a4-allroad', 'a5l', 'a6-allroad', 'a6l', 'q2', 'q4-sportback-e-tron',
    'q5-sportback', 'q6-sportback-e-tron', 'q6l-e-tron', 'rs4', 's-e-tron-gt', 'sq6-sportback-e-tron',
    'sq8-e-tron'],
  
  subaru: ['dex', 'dias', 'domingo', 'exiga', 'justy', 'leone', 'levorg', 'lucra', 'pleo', 'r1', 'r2',
    'rex', 'sambar', 'stella', 'traviq', 'trezia', 'vivio', 'xv'],
  
  mitsubishi: ['500', 'airtrek', 'attrage', 'carisma', 'cedia', 'challenger', 'chariot', 'colt',
    'delica', 'dingo', 'dion', 'ek', 'endeavor', 'freeca', 'fto', 'galant-fortis', 'grandis',
    'i-miev', 'jolie', 'l200', 'l300', 'lancer-cargo', 'lancer-cedia', 'lancer-ex', 'lancer-fortis',
    'libero', 'minica', 'minicab', 'montero-sport', 'nativa', 'pajero', 'pajero-io', 'pajero-mini',
    'pajero-pinin', 'pajero-sport', 'pistachio', 'proudia', 'raider', 'rvr', 'savrin', 'shogun',
    'sigma', 'space-gear', 'space-runner', 'space-star', 'space-wagon', 'strada', 'toppo', 'townbox',
    'triton', 'xpander', 'zinger'],
};

// L-suffix models (China extended wheelbase)
const lSuffixPattern = /-(l|xl|pro|plus)$/i;

// Sportback/variant patterns (EU wagons)
const euVariantPattern = /-(variant|avant|touring|sportback|shooting-brake|allroad|wagon|estate|tourer|combi)$/i;

console.log(dryRun ? '=== DRY RUN ===' : '=== REMOVING NON-US RECORDS ===');
console.log('');

let totalToDelete = 0;
let totalDeleted = 0;

// Count and delete by pattern
async function deleteByPattern(description, whereClause, params = []) {
  const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE ${whereClause}`, params);
  const count = parseInt(countResult.rows[0].cnt);
  
  if (count > 0) {
    console.log(`${description}: ${count} records`);
    totalToDelete += count;
    
    if (!dryRun) {
      const delResult = await pool.query(`DELETE FROM vehicle_fitments WHERE ${whereClause}`, params);
      totalDeleted += delResult.rowCount;
    }
  }
}

// Delete L-suffix models (China extended wheelbase)
await deleteByPattern('China L/XL/Pro/Plus variants', "model ~ '-(l|xl|pro|plus)$'");

// Delete EU variant models  
await deleteByPattern('EU wagon/sportback variants', "model ~ '-(variant|avant|touring|sportback|shooting-brake|allroad|wagon|estate|tourer|combi)$'");

// Delete known non-US models by make
for (const [make, models] of Object.entries(nonUsModels)) {
  if (models.length === 0) continue;
  
  const placeholders = models.map((_, i) => `$${i + 2}`).join(', ');
  await deleteByPattern(
    `${make} non-US models`,
    `LOWER(make) = $1 AND LOWER(model) IN (${placeholders})`,
    [make, ...models]
  );
}

// Delete records with no tire sizes that are clearly non-US based on year gaps
// (e.g., 2027 models that don't exist yet)
await deleteByPattern('Future models (2027+)', "year >= 2027");

console.log('');
console.log(`Total identified: ${totalToDelete} records`);

if (!dryRun) {
  console.log(`Total deleted: ${totalDeleted} records`);
  
  // Final count
  const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");
  
  console.log('');
  console.log('=== FINAL STATE ===');
  console.log(`Total records: ${finalCount.rows[0].cnt}`);
  console.log(`Missing tire sizes: ${missingCount.rows[0].cnt}`);
  console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);
} else {
  console.log('');
  console.log('Run without --dry-run to delete these records');
}

pool.end();
