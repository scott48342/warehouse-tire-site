import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  
  try {
    // Find catalog entries with 90s years that have NO fitment data
    const missing = await client.query(`
      SELECT cm.make_slug, cm.name, 
             array_agg(y ORDER BY y DESC) as missing_years,
             COUNT(*) as year_count
      FROM catalog_models cm
      CROSS JOIN LATERAL unnest(cm.years) as y
      WHERE y >= 1990 AND y <= 1999
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_fitments vf
        WHERE LOWER(vf.make) = LOWER(cm.make_slug)
        AND LOWER(vf.model) = LOWER(cm.name)
        AND vf.year = y
      )
      GROUP BY cm.make_slug, cm.name
      ORDER BY year_count DESC, cm.make_slug, cm.name
      LIMIT 50
    `);
    
    console.log('=== 90s VEHICLES IN CATALOG BUT MISSING FITMENT DATA ===\n');
    console.log('Make          | Model                    | Missing Years');
    console.log('--------------|--------------------------|---------------');
    
    let total = 0;
    missing.rows.forEach(r => {
      const years = r.missing_years.slice(0, 5).join(',') + (r.missing_years.length > 5 ? '...' : '');
      console.log(`${r.make_slug.padEnd(13)} | ${r.name.padEnd(24)} | ${years} (${r.year_count})`);
      total += parseInt(r.year_count);
    });
    
    console.log(`\nTotal missing year/model combos: ${total}`);
    
    // Summary by make
    const byMake = await client.query(`
      SELECT cm.make_slug, COUNT(DISTINCT cm.name) as models, COUNT(*) as total_years
      FROM catalog_models cm
      CROSS JOIN LATERAL unnest(cm.years) as y
      WHERE y >= 1990 AND y <= 1999
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_fitments vf
        WHERE LOWER(vf.make) = LOWER(cm.make_slug)
        AND LOWER(vf.model) = LOWER(cm.name)
        AND vf.year = y
      )
      GROUP BY cm.make_slug
      ORDER BY total_years DESC
    `);
    
    console.log('\n=== SUMMARY BY MAKE ===\n');
    byMake.rows.forEach(r => {
      console.log(`${r.make_slug}: ${r.models} models, ${r.total_years} year/model gaps`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
