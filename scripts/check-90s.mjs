import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  try {
    // What do we have for 90s?
    const pre2000 = await client.query(`
      SELECT year, COUNT(*) as count 
      FROM vehicle_fitments 
      WHERE year >= 1990 AND year < 2000
      GROUP BY year 
      ORDER BY year
    `);
    
    // Quality breakdown for 90s
    const quality = await client.query(`
      SELECT quality_tier, COUNT(*) as count 
      FROM vehicle_fitments 
      WHERE year >= 1990 AND year < 2000
      GROUP BY quality_tier
    `);
    
    // Sample makes for 90s
    const makes = await client.query(`
      SELECT make, COUNT(*) as count 
      FROM vehicle_fitments 
      WHERE year >= 1990 AND year < 2000
      GROUP BY make 
      ORDER BY count DESC 
      LIMIT 15
    `);
    
    // How many unique YMM combos in fitments for 90s vs 2000s?
    const fitment90s = await client.query(`
      SELECT COUNT(DISTINCT year::text || make || model) as ymm_count
      FROM vehicle_fitments
      WHERE year >= 1990 AND year < 2000
    `);
    
    const fitment2000s = await client.query(`
      SELECT COUNT(DISTINCT year::text || make || model) as ymm_count
      FROM vehicle_fitments
      WHERE year >= 2000
    `);
    
    // Total for 2000+
    const post2000 = await client.query(`
      SELECT COUNT(*) as count FROM vehicle_fitments WHERE year >= 2000
    `);
    
    console.log('=== 1990-1999 COVERAGE ===\n');
    
    console.log('Current fitment records by year:');
    if (pre2000.rows.length === 0) {
      console.log('  (none)');
    } else {
      pre2000.rows.forEach(r => console.log(`  ${r.year}: ${r.count}`));
    }
    
    console.log('\nQuality tiers:');
    if (quality.rows.length === 0) {
      console.log('  (none)');
    } else {
      quality.rows.forEach(r => console.log(`  ${r.quality_tier || 'null'}: ${r.count}`));
    }
    
    console.log('\nTop makes in 90s data:');
    if (makes.rows.length === 0) {
      console.log('  (none)');
    } else {
      makes.rows.forEach(r => console.log(`  ${r.make}: ${r.count}`));
    }
    
    console.log('\n--- COMPARISON ---');
    console.log(`Unique YMM combos 1990-1999: ${fitment90s.rows[0]?.ymm_count || 0}`);
    console.log(`Unique YMM combos 2000+: ${fitment2000s.rows[0]?.ymm_count || 0}`);
    console.log(`Total fitment records 2000+: ${post2000.rows[0]?.count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
