/**
 * Remove more non-US records (round 2)
 */
import pg from 'pg';
import fs from 'fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// More non-US models found in second pass
const moreNonUsModels = {
  toyota: ['previa', 'commuter', 'kijang-innova', 'regius-ace', 'sw4', 'liteace', 'townace', 
    'granvia', 'granace', 'probox', 'succeed', 'hiace-van', 'coaster-bus', 'land-cruiser-70',
    'land-cruiser-100', 'land-cruiser-200', 'land-cruiser-300', 'proace-city', 'proace-verso',
    'bz3', 'bz4x-china', 'yaris-sedan', 'yaris-ia', 'gr-yaris', 'starlet'],
  
  nissan: ['pickup', 'v16', 'nv200-vanette', 'patrol-cab-chassis', 'cabstar', 'civilian',
    'interstar', 'urvan', 'atlas', 'nt400', 'nt500', 'nv400', 'kicks-china', 'terra',
    'navara-chassis', 'np200', 'hardbody', 'datsun-go'],
  
  chevrolet: ['damas', 'd-max', 'express-cargo', 'express-cutaway', 'express-passenger',
    'cutaway', 'kodiak', 'w-series', 'lcf', 'n-series', 'low-cab-forward', 'silverado-chassis',
    'silverado-medium-duty', 'aveo5', 'joy', 'groove', 'groove-plus', 'captiva-sport'],
  
  volkswagen: ['polo-vivo', 'parati', 'pointer', 'derby', 'logus', 'quantum', 'santana',
    'citi', 'caddy-van', 'transporter-van', 'crafter-van', 'amarok-van', 'gol-sedan',
    'spacecross', 'crossgolf', 'golf-alltrack'],
  
  honda: ['fit-shuttle', 'cr-z', 'br-v', 'wr-v', 'mobilio-spike', 'crossroad', 'that-s',
    'freed-spike', 'fit-hybrid', 'cr-v-hybrid-china', 'breeze', 'inspire', 'envix', 'avancier'],
  
  hyundai: ['county-bus', 'universe-bus', 'porter-truck', 'mighty-truck', 'xcient', 'pavise',
    'staria', 'stargazer', 'creta-india', 'venue-india', 'alcazar', 'casper', 'bayon'],
  
  kia: ['bongo', 'k2500', 'k2700', 'k3', 'k5', 'k7', 'k9', 'carnival-van', 'grand-bird',
    'granbird', 'mohave', 'borrego', 'kx3', 'kx5', 'kx7', 'pegas-sedan', 'rio-x-line'],
  
  ford: ['transit-van', 'transit-minibus', 'transit-chassis-cab', 'transit-cutaway',
    'e-transit', 'e-transit-custom', 'pro', 'ranger-chassis', 'ranger-super-cab',
    'f-650', 'f-750', 'f-53', 'f-59', 'f-series-super-duty-chassis', 'stripped-chassis'],
  
  mercedes: ['citaro', 'econic', 'integro', 'intouro', 'tourismo', 'setra', 'atego',
    'axor', 'actros', 'arocs', 'unimog', 'zetros', 'metris-cargo', 'metris-passenger'],
  
  mitsubishi: ['fuso', 'canter', 'fighter', 'super-great', 'rosa', 'aero-star',
    'aero-queen', 'aero-king', 'aero-midi', 'aero-bus'],
  
  mazda: ['bongo-brawny', 'bongo-friendee', 'titan', 'e-series', 'scrum-wagon',
    'flair-wagon', 'flair-crossover', 'carol-echo', 'verisa', 'biante'],
  
  subaru: ['sambar-truck', 'sambar-van', 'dias-wagon', 'lucra', 'chiffon', 'justy-japan'],
  
  volvo: ['fh', 'fm', 'fmx', 'fe', 'fl', 'vnl', 'vnr', 'vhd', 'vt', 'b-series'],
  
  mini: ['clubvan', 'paceman'],
  
  infiniti: ['qx4', 'm-series', 'fx-series', 'ex-series', 'jx-series'],
  
  buick: ['excelle', 'excelle-gt', 'excelle-gx', 'gl6', 'gl8', 'velite', 'velite-5',
    'velite-6', 'velite-7', 'micro-blue', 'e4', 'e5'],
  
  cadillac: ['brougham', 'deville', 'seville', 'fleetwood', 'allante', 'catera', 
    'xlr', 'sts', 'dts', 'xts-china', 'ct4-china', 'ct5-china', 'ct6-china'],
};

console.log(dryRun ? '=== DRY RUN ===' : '=== REMOVING MORE NON-US RECORDS ===');
console.log('');

let totalDeleted = 0;

for (const [make, models] of Object.entries(moreNonUsModels)) {
  if (models.length === 0) continue;
  
  const placeholders = models.map((_, i) => `$${i + 2}`).join(', ');
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${placeholders})`,
    [make, ...models]
  );
  const count = parseInt(countResult.rows[0].cnt);
  
  if (count > 0) {
    console.log(`${make}: ${count} records`);
    if (!dryRun) {
      const delResult = await pool.query(
        `DELETE FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) IN (${placeholders})`,
        [make, ...models]
      );
      totalDeleted += delResult.rowCount;
    }
  }
}

// Also remove commercial/chassis vehicles by pattern
const commercialPatterns = [
  "model ~ '-(chassis|cab|cutaway|van|cargo|bus|truck)$'",
  "model ~ '^(chassis|cab|cutaway|cargo|stripped)$'",
  "model ~ '(commercial|fleet|work|service)$'",
];

for (const pattern of commercialPatterns) {
  const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE ${pattern}`);
  const count = parseInt(countResult.rows[0].cnt);
  if (count > 0) {
    console.log(`Commercial pattern (${pattern.substring(0, 30)}...): ${count} records`);
    if (!dryRun) {
      const delResult = await pool.query(`DELETE FROM vehicle_fitments WHERE ${pattern}`);
      totalDeleted += delResult.rowCount;
    }
  }
}

console.log('');
if (!dryRun) {
  console.log(`Total deleted: ${totalDeleted} records`);
  
  const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
  const missingCount = await pool.query("SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'");
  
  console.log('');
  console.log('=== FINAL STATE ===');
  console.log(`Total records: ${finalCount.rows[0].cnt}`);
  console.log(`Missing tire sizes: ${missingCount.rows[0].cnt}`);
  console.log(`Coverage: ${((finalCount.rows[0].cnt - missingCount.rows[0].cnt) / finalCount.rows[0].cnt * 100).toFixed(1)}%`);
}

pool.end();
