import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  
  try {
    // Count orphans by make
    const orphansByMake = await client.query(`
      SELECT vf.make, COUNT(DISTINCT vf.model) as models, COUNT(*) as records
      FROM vehicle_fitments vf
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT EXISTS (
        SELECT 1 FROM catalog_models cm 
        WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
        AND LOWER(cm.name) = LOWER(vf.model)
        AND vf.year = ANY(cm.years)
      )
      GROUP BY vf.make
      ORDER BY records DESC
      LIMIT 20
    `);
    
    console.log('=== ORPHAN FITMENTS BY MAKE ===\n');
    console.log('Make           | Models | Records');
    console.log('---------------|--------|--------');
    let total = 0;
    orphansByMake.rows.forEach(r => {
      console.log(`${r.make.padEnd(14)} | ${String(r.models).padStart(6)} | ${r.records}`);
      total += parseInt(r.records);
    });
    console.log(`\nTotal orphan records: ${total}`);
    
    // Check what would need catalog updates
    const needsYears = await client.query(`
      SELECT DISTINCT vf.make, vf.model, vf.year, cm.years as catalog_years
      FROM vehicle_fitments vf
      JOIN catalog_models cm ON LOWER(cm.make_slug) = LOWER(vf.make) AND LOWER(cm.name) = LOWER(vf.model)
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT (vf.year = ANY(cm.years))
      LIMIT 10
    `);
    
    console.log('\n=== MODELS THAT EXIST BUT NEED 90s YEARS ADDED ===');
    needsYears.rows.forEach(r => {
      console.log(`${r.year} ${r.make} ${r.model} - catalog has: ${r.catalog_years?.slice(0,5).join(',')}...`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
