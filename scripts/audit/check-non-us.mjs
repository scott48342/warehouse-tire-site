import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Known non-US model patterns
const NON_US_PATTERNS = [
  // Hyundai
  'i30%', 'ix25%', 'ix35%', 'mistra%', 'hb20%', 'celesta%', 'reina%', 
  'grand-santa-fe%', 'maxcruz%', 'i20%', 'i25%', 'elite%', 'verna%',
  'elantra-yuedong%', 'elantra-gt%', 'genesis%',
  // Kia
  'ceed%', 'cee-d%', 'pro-ceed%', 'k2%', 'k3%', 'k4%', 'k5-dl3%', 'k900%',
  'cadenza%', 'forte-r%', 'forte-koup%', 'cerato%', 'rondo%', 
  'picanto%', 'morning%', 'kx%', 'sportage-r%', 'sorento-prime%',
  // Honda
  'xr-v%', 'ur-v%', 'ballade%', 'brio%', 'city%', 'amaze%',
  'elysion%', 'gienia%', 'accord-euro%', 'fcx%', 'e-n%', 'm-nv%',
  'odyssey-j%', 'integra-type-s%',
  // VW
  'teramont%', 'tiguan-x%', 'cross-up%', 'gran-santana%', 'santana%',
  'golf-sv%', 'golf-sportwagen%', 'golf-variant%', 'golf-cabriolet%',
  'space-cross%', 'crosstouran%', 'c-trek%', 'fusca%', 'ameo%', 'taigun%',
  'e-golf%', 't-roc-r%', 'lamando%', 'lavida%', 'bora%', 'sagitar%',
  // Toyota
  'allion%', 'premio%', 'harrier%', 'alphard%', 'vellfire%', 'noah%',
  'mark-x%', 'crown%', 'ist%', 'wish%', 'porte%', 'spade%', 'tank%',
  'roomy%', 'passo%', 'pixis%', 'aqua%', 'yaris-cross%',
  // Nissan
  'tiida%', 'sylphy%', 'teana%', 'serena%', 'elgrand%', 'x-trail%',
  'qashqai%', 'juke%', 'note%', 'march%', 'livina%', 'sunny%', 'almera%',
  // Mitsubishi
  'delica%', 'grandis%', 'colt%', 'i-miev%', 'ek%', 'shogun%',
  'xforce%', 'grand-lancer%', 'rvr%', 'express%', 'l100%',
  // Mini
  'hardtop%', 'cabrio%', 'coupe%', 'roadster%', 'crossover%', 'aceman%',
  // Mazda
  'atenza%', 'axela%', 'demio%', 'flair%', 'carol%', 'scrum%', 'familia%',
  'premacy%', 'biante%', 'mpv%', 'bongo%', 'tribute%', 'verisa%',
  // Subaru
  'levorg%', 'exiga%', 'trezia%', 'justy%', 'dias%', 'sambar%', 'stella%',
  // Other regional
  '%variant%', '%-l%', '%-xl%', '%long-wheelbase%', '%lwb%'
];

async function check() {
  const client = await pool.connect();
  
  try {
    console.log('Checking for non-US models still in database...\n');
    
    // Build query with all patterns
    const patterns = NON_US_PATTERNS.map(p => `model ILIKE '${p}'`).join(' OR ');
    
    const result = await client.query(`
      SELECT make, model, COUNT(*) as count, MIN(year) as min_year, MAX(year) as max_year
      FROM vehicle_fitments
      WHERE ${patterns}
      GROUP BY make, model
      ORDER BY count DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No non-US models found!');
    } else {
      console.log(`Found ${result.rows.length} non-US model types:\n`);
      
      let total = 0;
      const byMake = {};
      
      for (const row of result.rows) {
        if (!byMake[row.make]) byMake[row.make] = [];
        byMake[row.make].push(row);
        total += parseInt(row.count);
      }
      
      for (const [make, models] of Object.entries(byMake)) {
        console.log(`${make.toUpperCase()}:`);
        for (const m of models) {
          console.log(`  ${m.model}: ${m.count} records (${m.min_year}-${m.max_year})`);
        }
      }
      
      console.log(`\n❌ Total non-US records: ${total}`);
      console.log('\nRun this to delete them:');
      console.log('  node scripts/audit/delete-non-us.mjs');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
