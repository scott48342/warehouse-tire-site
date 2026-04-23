import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Map fitment model names to catalog model names
const NAME_MAPPINGS = [
  { from: '5-series', to: '5 Series' },
  { from: '3-series', to: '3 Series' },
  { from: '7-series', to: '7 Series' },
  { from: 'silverado-1500', to: 'Silverado 1500' },
  { from: 'silverado-2500hd', to: 'Silverado 2500 HD' },
  { from: 'silverado-3500hd', to: 'Silverado 3500 HD' },
  { from: 'sierra-1500', to: 'Sierra 1500' },
  { from: 'sierra-2500hd', to: 'Sierra 2500 HD' },
  { from: 'sierra-3500hd', to: 'Sierra 3500 HD' },
  { from: 'grand-cherokee', to: 'Grand Cherokee' },
  { from: 'grand-caravan', to: 'Grand Caravan' },
  { from: 'town-car', to: 'Town Car' },
  { from: 'monte-carlo', to: 'Monte Carlo' },
  { from: 'ram-1500', to: 'Ram 1500' },
  { from: 'ram-2500', to: 'Ram 2500' },
  { from: 'ram-3500', to: 'Ram 3500' },
  { from: 'crown-victoria', to: 'Crown Victoria' },
];

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();
  
  if (dryRun) console.log('=== DRY RUN MODE ===\n');
  
  try {
    let totalUpdated = 0;
    
    for (const { from, to } of NAME_MAPPINGS) {
      const result = await client.query(`
        UPDATE vehicle_fitments 
        SET model = $1, updated_at = NOW()
        WHERE LOWER(model) = LOWER($2)
        AND year >= 1990 AND year < 2000
        ${dryRun ? 'RETURNING id' : ''}
      `, [to, from]);
      
      if (result.rowCount > 0) {
        console.log(`"${from}" → "${to}": ${result.rowCount} records`);
        totalUpdated += result.rowCount;
      }
    }
    
    console.log(`\nTotal updated: ${totalUpdated}`);
    
    // Check remaining orphans
    const remaining = await client.query(`
      SELECT COUNT(DISTINCT vf.year::text || vf.make || vf.model) as count
      FROM vehicle_fitments vf
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT EXISTS (
        SELECT 1 FROM catalog_models cm 
        WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
        AND LOWER(cm.name) = LOWER(vf.model)
        AND vf.year = ANY(cm.years)
      )
    `);
    
    console.log(`Remaining orphans: ${remaining.rows[0].count}`);
    
    if (dryRun) console.log('\n(Dry run - no changes made)');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
