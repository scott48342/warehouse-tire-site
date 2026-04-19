import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Check for 2BBAR and 4BBAR products
const result = await pool.query(`
  SELECT sku, title, sub_type, category, image_url 
  FROM accessories 
  WHERE sku LIKE '%BBAR%' OR sku LIKE '%2BANGER%' OR sku LIKE '%4BANGER%'
  ORDER BY sku
  LIMIT 20
`);

console.log('Banger Bar products in DB:');
if (result.rows.length > 0) {
  console.table(result.rows);
} else {
  console.log('  (none found)');
}

// Check Lighting_TechGuide for these products
console.log('\nChecking Lighting_TechGuide.csv for light bar products...');
const fs = await import('fs');
const csv = fs.readFileSync('./data/Lighting_TechGuide.csv', 'utf8');
const lines = csv.split('\n');
const lightBars = lines.filter(l => l.includes('BBAR') || l.toLowerCase().includes('light bar'));
console.log(`Found ${lightBars.length} lines mentioning BBAR or light bar`);
if (lightBars.length > 0 && lightBars.length <= 5) {
  lightBars.forEach(l => console.log('  ', l.substring(0, 100)));
}

await pool.end();
