import pg from 'pg';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function add() {
  const client = await pool.connect();
  
  try {
    const models = [
      { make: 'gmc', slug: 'sierra-2500-hd', name: 'Sierra 2500 HD', years: [1999,1998,1997,1996,1995,1994,1993,1992,1991,1990] },
      { make: 'gmc', slug: 'sierra-3500-hd', name: 'Sierra 3500 HD', years: [1999,1998,1997,1996,1995,1994,1993,1992,1991,1990] },
    ];
    
    for (const m of models) {
      await client.query(`
        INSERT INTO catalog_models (id, make_slug, slug, name, years, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
        ON CONFLICT DO NOTHING
      `, [randomUUID(), m.make, m.slug, m.name, m.years]);
      console.log('Added: ' + m.name);
    }
    
    // Verify
    const orphans = await client.query(`
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
    
    console.log('Remaining orphans: ' + orphans.rows[0].count);
    
  } finally {
    client.release();
    await pool.end();
  }
}

add().catch(console.error);
