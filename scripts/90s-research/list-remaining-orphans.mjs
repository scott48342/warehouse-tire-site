import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  
  try {
    const orphans = await client.query(`
      SELECT DISTINCT vf.make, vf.model, COUNT(*) as records
      FROM vehicle_fitments vf
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT EXISTS (
        SELECT 1 FROM catalog_models cm 
        WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
        AND LOWER(cm.name) = LOWER(vf.model)
      )
      GROUP BY vf.make, vf.model
      ORDER BY records DESC
    `);
    
    console.log('Remaining orphan models:\n');
    for (const r of orphans.rows) {
      // Check if there's a similar model in catalog
      const similar = await client.query(`
        SELECT name FROM catalog_models 
        WHERE make_slug = $1 
        AND (LOWER(name) LIKE $2 OR LOWER(name) LIKE $3)
        LIMIT 1
      `, [r.make.toLowerCase(), '%' + r.model.toLowerCase().split(/[\s-]/)[0] + '%', r.model.toLowerCase().replace(/-/g, ' ') + '%']);
      
      const match = similar.rows[0]?.name || '(no match)';
      console.log(`${r.make} "${r.model}" (${r.records} records) → catalog: "${match}"`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
