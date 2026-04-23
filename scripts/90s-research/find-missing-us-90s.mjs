import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Skip non-US / JDM / duplicate models
const SKIP_MODELS = [
  // JDM only
  'acty', 'bongo', 'carol', 'efini', 'familia', 'capella', 'proceed', 'scrum',
  'besta', 'pride', 'grandeur', 'lantra', 'cefiro', 'bluebird', 'cedric',
  'gloria', 'laurel', 'pulsar', 'primera', 'safari', 'silvia', 'stagea',
  'skyline', 'terrano', 'delica', 'diamante', 'gto', 'pajero', 'rvr',
  'minica', 'mirage', 'sigma', 'starion', 'eterna', 'debonair', 'chariot',
  'aspire', 'demio', 'atenza', 'axela', 'cx-5', 'cx-7', 'cx-9', 'mx-3',
  'verisa', 'tribute', 'titan', 'bongo friendee', 'bt-50', 'roadster',
  'autozam', 'eunos', 'sentia', 'xedos',
  // duplicates (we have these under different names)
  'mx-5 miata', 'legend', 'integra', 'nsx', '121', '323',
  // non-US
  'falcon', 'fiesta', 'transit', 'mini', 'defender',
];

const PRIORITY_US_MAKES = [
  'chevrolet', 'ford', 'dodge', 'gmc', 'jeep', 'cadillac', 'buick', 'lincoln',
  'chrysler', 'pontiac', 'oldsmobile', 'mercury', 'saturn',
  'toyota', 'honda', 'nissan', 'mazda', 'subaru', 'mitsubishi', 'hyundai', 'kia',
  'bmw', 'mercedes', 'audi', 'volkswagen', 'volvo', 'porsche', 'jaguar',
  'lexus', 'acura', 'infiniti', 'land-rover',
];

async function check() {
  const client = await pool.connect();
  
  try {
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
      ORDER BY cm.make_slug, cm.name
    `);
    
    console.log('=== US-MARKET 90s VEHICLES MISSING FITMENT DATA ===\n');
    
    const filtered = missing.rows.filter(r => {
      const make = r.make_slug.toLowerCase();
      const model = r.name.toLowerCase();
      
      // Skip non-US makes
      if (!PRIORITY_US_MAKES.includes(make)) return false;
      
      // Skip JDM/duplicate models
      if (SKIP_MODELS.some(skip => model.includes(skip))) return false;
      
      return true;
    });
    
    // Group by make
    const byMake = {};
    filtered.forEach(r => {
      if (!byMake[r.make_slug]) byMake[r.make_slug] = [];
      byMake[r.make_slug].push(r);
    });
    
    let totalGaps = 0;
    for (const [make, models] of Object.entries(byMake)) {
      console.log(`\n### ${make.toUpperCase()}`);
      models.forEach(m => {
        const years = m.missing_years.length <= 3 
          ? m.missing_years.join(', ')
          : `${m.missing_years[0]}-${m.missing_years[m.missing_years.length-1]}`;
        console.log(`  ${m.name}: ${years} (${m.year_count} years)`);
        totalGaps += parseInt(m.year_count);
      });
    }
    
    console.log(`\n=== TOTAL: ${filtered.length} models, ${totalGaps} year/model gaps ===`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
