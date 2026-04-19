import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const content = fs.readFileSync('data/Accessory_TechGuide.csv', 'utf8');
const lines = content.split('\n').filter(l => l.trim());
const header = parseCSVLine(lines[0]);

console.log('Total rows:', lines.length - 1);
console.log('Headers:', header.join(', '));

// Test first row
const cols = parseCSVLine(lines[1]);
const row = {};
header.forEach((h, j) => row[h.toLowerCase()] = cols[j]);

console.log('\nFirst row:');
console.log('  sku:', row.sku);
console.log('  product_desc:', row.product_desc?.substring(0, 50));
console.log('  image_url:', row.image_url);
console.log('  msrp:', row.msrp);
console.log('  brand_desc:', row.brand_desc);

// Test insert
const client = await pool.connect();
try {
  console.log('\nTesting insert...');
  
  const result = await client.query(`
    INSERT INTO accessories (sku, title, brand, image_url, msrp, category)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (sku) DO UPDATE SET 
      image_url = EXCLUDED.image_url,
      title = EXCLUDED.title,
      updated_at = NOW()
    RETURNING sku
  `, [row.sku, row.product_desc, row.brand_desc, row.image_url, parseFloat(row.msrp) || null, 'center_cap']);
  
  console.log('Inserted/updated:', result.rows[0].sku);
  
  // Verify
  const check = await client.query('SELECT sku, image_url FROM accessories WHERE sku = $1', [row.sku]);
  console.log('Verified:', check.rows[0]);
  
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
} finally {
  client.release();
  await pool.end();
}
