import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

// Models to DELETE (confirmed non-US)
const DELETE_PATTERNS = [
  // Hyundai non-US
  'i30%', 'i20%', 'i25%', 'ix25%', 'ix35%', 'mistra%', 'hb20%', 'celesta%', 'reina%',
  'grand-santa-fe%', 'maxcruz%', 'elite%', 'verna%', 'elantra-yuedong%', 
  'elantra-langdong%', 'elantra-lingdong%', 'elantra-lavita%',
  
  // Kia non-US
  'ceed%', 'cee-d%', 'pro-ceed%', 'k2', 'k3%', 'k4%', 'k900',
  'cadenza', 'forte-r', 'forte-koup', 'cerato%', 'rondo',
  'picanto%', 'morning%', 'kx%', 'sportage-r', 'sorento-prime',
  
  // Honda non-US
  'xr-v', 'ur-v', 'ballade', 'brio%', 'elysion%', 'gienia',
  'accord-euro', 'fcx%', 'e-n1', 'e-np1', 'e-ns1', 'e-np2', 'm-nv',
  'odyssey-j', 'integra-type-s',
  
  // VW non-US
  'teramont', 'tiguan-x', 'cross-up%', 'gran-santana%', 'santana%',
  'golf-sv', 'golf-sportwagen', 'golf-cabriolet', 'e-golf',
  'space-cross', 'crosstouran', 'c-trek', 'fusca', 'ameo', 'taigun',
  't-roc-r', 'lamando%', 'lavida%', 'bora%', 'sagitar%', 'city-golf',
  'transporter-lt',
  
  // Mitsubishi non-US  
  'delica%', 'ek%', 'grand-lancer', 'rvr%', 'shogun%', 'colt-czc',
  'l100-ev', 'express', 'xforce',
  
  // Mini non-US names (keep clubman, countryman, cooper)
  'hardtop', 'cabrio', 'coupe', 'roadster', 'crossover', 'aceman',
  
  // Mazda non-US
  'roadster-rf', 'flair%', 'proceed%',
  
  // Nissan non-US
  'tiida%', 'almera%', 'qashqai%', 'march%', 'sunny%', 'prairie%',
  
  // Toyota non-US
  'mark-x%', 'passo%', 'crown-vellfire', 'yaris-l%', 'corolla-levin',
  
  // Subaru non-US
  'exiga%', 'legacy-lancaster',
  
  // Acura (duplicate of Honda)
  'integra-type-s',
  
  // Buick non-US
  'gl8%',
  
  // Chevy non-US
  'spark-life', 'city-express', 'sail%',
  
  // Hyundai Genesis (now separate brand)
  'genesis'
];

// Models to KEEP (US models that matched patterns)
const KEEP_MODELS = [
  'yukon-xl%',        // GMC Yukon XL - US
  'crown-victoria',   // Ford Crown Victoria - US
  'express-1500',     // Chevy Express - US commercial
  'express-2500',
  'express-3500',
  'roadster',         // Tesla Roadster - US (when make=tesla)
  'mark-lt',          // Lincoln Mark LT - US
  'elantra-gt',       // Hyundai Elantra GT - sold in US
  '%limited',         // "Limited" trim variants are US
  'golf-sportwagen',  // VW Golf Sportwagen was sold in US 2015-2019
];

async function deleteNonUS() {
  const client = await pool.connect();
  
  console.log('='.repeat(80));
  console.log('DELETING NON-US MODELS');
  console.log('='.repeat(80));
  
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('🔍 DRY RUN MODE - No changes will be made\n');

  try {
    let totalDeleted = 0;
    
    for (const pattern of DELETE_PATTERNS) {
      // Skip if it's in the keep list
      const shouldKeep = KEEP_MODELS.some(k => {
        const kClean = k.replace(/%/g, '');
        const pClean = pattern.replace(/%/g, '');
        return pClean.includes(kClean) || kClean.includes(pClean);
      });
      
      if (shouldKeep) {
        console.log(`⏭️  Skipping ${pattern} (in keep list)`);
        continue;
      }
      
      // Count records to delete
      const countResult = await client.query(`
        SELECT COUNT(*) as count FROM vehicle_fitments 
        WHERE model ILIKE $1
      `, [pattern]);
      
      const count = parseInt(countResult.rows[0].count);
      if (count === 0) continue;
      
      if (dryRun) {
        console.log(`🔍 Would delete: ${pattern} (${count} records)`);
      } else {
        await client.query(`DELETE FROM vehicle_fitments WHERE model ILIKE $1`, [pattern]);
        console.log(`✅ Deleted: ${pattern} (${count} records)`);
      }
      
      totalDeleted += count;
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Total ${dryRun ? 'would delete' : 'deleted'}: ${totalDeleted} records`);
    
    if (!dryRun) {
      // Show final stats
      const stats = await client.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 1 END) as has_tires
        FROM vehicle_fitments WHERE year >= 2000
      `);
      console.log(`\nFinal state: ${stats.rows[0].total} records, ${(stats.rows[0].has_tires/stats.rows[0].total*100).toFixed(1)}% with tire data`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

deleteNonUS().catch(console.error);
