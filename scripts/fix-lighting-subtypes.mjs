/**
 * Fix lighting sub_types:
 * 1. Move misclassified light_bar products to lighting_parts
 * 2. Move generic 'lighting' sub_type products to lighting_parts
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Patterns that indicate actual light bars
const LIGHT_BAR_PATTERNS = [
  '%LIGHT BAR%',
  '%LIGHTBAR%',
  '%BANGER%BAR%',
  '%LED BAR%',
  '% BAR KIT%',
  '%ROW BAR%',
];

async function run() {
  console.log('=== Fixing lighting sub_types ===\n');

  // Step 1: Count current state
  const before = await pool.query(`
    SELECT sub_type, COUNT(*) as count 
    FROM accessories 
    WHERE category = 'lighting' 
    GROUP BY sub_type 
    ORDER BY count DESC
  `);
  console.log('BEFORE:');
  console.table(before.rows);

  // Step 2: Move misclassified light_bar products to lighting_parts
  // These are products tagged as light_bar but don't have light bar keywords in title
  const patternConditions = LIGHT_BAR_PATTERNS.map(p => `UPPER(title) LIKE '${p}'`).join(' OR ');
  
  const misclassifiedResult = await pool.query(`
    UPDATE accessories 
    SET sub_type = 'lighting_parts'
    WHERE category = 'lighting' 
      AND sub_type = 'light_bar'
      AND NOT (${patternConditions})
    RETURNING sku, title
  `);
  console.log(`\nMoved ${misclassifiedResult.rowCount} misclassified light_bar → lighting_parts`);
  if (misclassifiedResult.rows.length <= 10) {
    console.table(misclassifiedResult.rows);
  }

  // Step 3: Move generic 'lighting' sub_type to lighting_parts
  const genericResult = await pool.query(`
    UPDATE accessories 
    SET sub_type = 'lighting_parts'
    WHERE category = 'lighting' 
      AND sub_type = 'lighting'
    RETURNING sku
  `);
  console.log(`\nMoved ${genericResult.rowCount} generic lighting → lighting_parts`);

  // Step 4: Also move 'led' sub_type to led_pod (these are LED pods)
  // Actually check what 'led' contains first
  const ledSample = await pool.query(`
    SELECT sku, title FROM accessories 
    WHERE sub_type = 'led' LIMIT 5
  `);
  console.log('\nSample of "led" sub_type:');
  console.table(ledSample.rows);

  // Step 5: Count final state
  const after = await pool.query(`
    SELECT sub_type, COUNT(*) as count 
    FROM accessories 
    WHERE category = 'lighting' 
    GROUP BY sub_type 
    ORDER BY count DESC
  `);
  console.log('\nAFTER:');
  console.table(after.rows);

  await pool.end();
  console.log('\n✅ Done!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
