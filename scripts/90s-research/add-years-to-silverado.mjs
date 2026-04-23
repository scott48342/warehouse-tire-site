import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const YEARS_90S = [1999, 1998, 1997, 1996, 1995, 1994, 1993, 1992, 1991, 1990];

const MODELS_NEEDING_90S = [
  { make: 'chevrolet', name: 'Silverado 1500' },
  { make: 'chevrolet', name: 'Silverado 2500 HD' },
  { make: 'chevrolet', name: 'Silverado 3500 HD' },
];

async function update() {
  const client = await pool.connect();
  
  try {
    for (const m of MODELS_NEEDING_90S) {
      // Get current years
      const current = await client.query(`
        SELECT id, years FROM catalog_models 
        WHERE make_slug = $1 AND name = $2
      `, [m.make, m.name]);
      
      if (current.rows.length > 0) {
        const existingYears = current.rows[0].years || [];
        const newYears = [...new Set([...existingYears, ...YEARS_90S])].sort((a, b) => b - a);
        
        await client.query(`
          UPDATE catalog_models SET years = $1, updated_at = NOW() WHERE id = $2
        `, [newYears, current.rows[0].id]);
        
        console.log(`Updated ${m.make} ${m.name}: added 90s years`);
      } else {
        console.log(`Not found: ${m.make} ${m.name}`);
      }
    }
    
    // Final check
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
    
    console.log(`\nRemaining orphans: ${orphans.rows[0].count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

update().catch(console.error);
