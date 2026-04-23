import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  
  try {
    // Check catalog_models for 90s
    const catalog90s = await client.query(`
      SELECT COUNT(*) as count 
      FROM catalog_models 
      WHERE years && ARRAY[1990,1991,1992,1993,1994,1995,1996,1997,1998,1999]::int[]
    `);
    
    // Check fitments for 90s
    const fitment90s = await client.query(`
      SELECT COUNT(DISTINCT year::text || make || model) as count 
      FROM vehicle_fitments 
      WHERE year >= 1990 AND year < 2000
    `);
    
    // Sample: do 90s fitments have matching catalog entries?
    const orphans = await client.query(`
      SELECT DISTINCT vf.year, vf.make, vf.model 
      FROM vehicle_fitments vf
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT EXISTS (
        SELECT 1 FROM catalog_models cm 
        WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
        AND LOWER(cm.name) = LOWER(vf.model)
        AND vf.year = ANY(cm.years)
      )
      LIMIT 20
    `);
    
    console.log('=== CATALOG vs FITMENT COVERAGE ===\n');
    console.log('Catalog models with 90s years:', catalog90s.rows[0].count);
    console.log('Fitment YMM combos for 90s:', fitment90s.rows[0].count);
    
    if (orphans.rows.length > 0) {
      console.log('\n⚠️  Orphan fitments (have data but NOT in YMM dropdown):');
      orphans.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}`));
      console.log('\nThese vehicles have fitment data but won\'t appear in dropdowns!');
    } else {
      console.log('\n✅ All 90s fitments have matching catalog entries');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
