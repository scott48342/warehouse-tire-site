import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function check() {
  const client = await pool.connect();
  
  try {
    console.log('=== SUBMODEL ANALYSIS ===\n');
    
    // What's in submodel field?
    const submodelDistribution = await client.query(`
      SELECT 
        CASE WHEN submodel IS NULL OR submodel = '' THEN '(empty)' ELSE 'has_value' END as status,
        COUNT(*) as count
      FROM vehicle_fitments
      GROUP BY 1
    `);
    console.log('Submodel field status:', submodelDistribution.rows);
    
    // What's in raw_trim vs display_trim?
    const trimAnalysis = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE raw_trim IS NULL OR raw_trim = '') as no_raw_trim,
        COUNT(*) FILTER (WHERE display_trim IS NULL OR display_trim = '') as no_display_trim,
        COUNT(*) FILTER (WHERE raw_trim = display_trim) as same_raw_display,
        COUNT(*) as total
      FROM vehicle_fitments
    `);
    console.log('\nTrim analysis:', trimAnalysis.rows[0]);
    
    // Look at Buick Encore specifically to understand the data
    const encoreData = await client.query(`
      SELECT year, raw_trim, display_trim, submodel, modification_id, bolt_pattern
      FROM vehicle_fitments
      WHERE LOWER(make) = 'buick' AND LOWER(model) = 'encore'
        AND year >= 2020
      ORDER BY year DESC, display_trim
    `);
    console.log('\nBuick Encore (2020+):', encoreData.rows);
    
    // Check if display_trim has multiple trims like DealerLine expects
    const multiTrimDisplays = await client.query(`
      SELECT display_trim, COUNT(DISTINCT modification_id) as mod_count, COUNT(*) as record_count
      FROM vehicle_fitments
      WHERE display_trim LIKE '%,%' OR display_trim LIKE '%/%'
      GROUP BY display_trim
      LIMIT 20
    `);
    console.log('\nMulti-trim display_trims (comma/slash separated):', multiTrimDisplays.rows);
    
    // Check for Encore trims that DealerLine would have (Preferred, Essence, Sport Touring, etc)
    const specificTrims = await client.query(`
      SELECT DISTINCT display_trim, raw_trim
      FROM vehicle_fitments
      WHERE LOWER(display_trim) LIKE '%preferred%'
         OR LOWER(display_trim) LIKE '%essence%'
         OR LOWER(display_trim) LIKE '%sport touring%'
         OR LOWER(raw_trim) LIKE '%preferred%'
         OR LOWER(raw_trim) LIKE '%essence%'
      LIMIT 20
    `);
    console.log('\nRecords with Preferred/Essence/Sport Touring:', specificTrims.rows);
    
    // Check modification_id patterns - do any have trim info?
    const modIdPatterns = await client.query(`
      SELECT modification_id, display_trim, year, make, model
      FROM vehicle_fitments
      WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%'
      ORDER BY year DESC
      LIMIT 20
    `);
    console.log('\nModification IDs for Encore:', modIdPatterns.rows.map(r => `${r.year} ${r.make} ${r.model}: ${r.modification_id} (${r.display_trim})`));
    
    // Check the source field - where did data come from?
    const sources = await client.query(`
      SELECT source, COUNT(*) as count
      FROM vehicle_fitments
      GROUP BY source
      ORDER BY count DESC
      LIMIT 15
    `);
    console.log('\nData sources:', sources.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
