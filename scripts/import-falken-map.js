const pg = require('pg');
const fs = require('fs');

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('No DATABASE_URL configured');
  process.exit(1);
}

async function main() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Create table if not exists
  console.log('Creating tire_map_cache table if needed...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tire_map_cache (
      part_number VARCHAR(50) PRIMARY KEY,
      map_usd DECIMAL(10, 2),
      msrp DECIMAL(10, 2),
      cost DECIMAL(10, 2),
      brand VARCHAR(100),
      model VARCHAR(200),
      description TEXT,
      source VARCHAR(50) DEFAULT 'manual',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Table ready.');

  // 2. Load Falken MAP data
  const mapData = JSON.parse(fs.readFileSync('F:/clawd/tmp/falken-map-data.json', 'utf8'));
  console.log(`Loaded ${mapData.length} Falken tires`);

  // 3. Upsert all Falken tires
  let inserted = 0;
  let updated = 0;
  
  for (const tire of mapData) {
    const result = await pool.query(`
      INSERT INTO tire_map_cache (part_number, map_usd, brand, description, source, updated_at)
      VALUES ($1, $2, 'Falken', $3, 'falken_map_aug2026', NOW())
      ON CONFLICT (part_number) DO UPDATE SET
        map_usd = EXCLUDED.map_usd,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `, [tire.PartNumber, tire.MAP, tire.Description]);
    
    if (result.rows[0]?.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`Done: ${inserted} inserted, ${updated} updated`);
  
  // 4. Verify
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count, MIN(map_usd) as min_map, MAX(map_usd) as max_map 
    FROM tire_map_cache WHERE brand = 'Falken'
  `);
  console.log(`Verification: ${rows[0].count} Falken tires, MAP range $${rows[0].min_map} - $${rows[0].max_map}`);

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
