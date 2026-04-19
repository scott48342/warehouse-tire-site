import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check generic 'lighting' sub_type products
const generic = await pool.query(`
  SELECT sku, title, brand
  FROM accessories 
  WHERE category = 'lighting' AND sub_type = 'lighting'
  LIMIT 25
`);
console.log('Products with sub_type = lighting (494 total):');
console.table(generic.rows);

// Count actual light bars (contain "LIGHT BAR" or "BANGER" in title)
const realBars = await pool.query(`
  SELECT COUNT(*) as count
  FROM accessories 
  WHERE category = 'lighting' 
    AND sub_type = 'light_bar'
    AND (
      UPPER(title) LIKE '%LIGHT BAR%' 
      OR UPPER(title) LIKE '%BANGER%BAR%'
      OR UPPER(title) LIKE '%LED BAR%'
    )
`);
console.log('\nActual light bars (by title):', realBars.rows[0].count);

// Count misclassified products
const misclassified = await pool.query(`
  SELECT COUNT(*) as count
  FROM accessories 
  WHERE category = 'lighting' 
    AND sub_type = 'light_bar'
    AND NOT (
      UPPER(title) LIKE '%LIGHT BAR%' 
      OR UPPER(title) LIKE '%BANGER%BAR%'
      OR UPPER(title) LIKE '%LED BAR%'
    )
`);
console.log('Misclassified as light_bar:', misclassified.rows[0].count);

await pool.end();
