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
  ssl: { rejectUnauthorized: false },
  max: 5,
});

async function main() {
  // First, check if we need to add a description column
  const colCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'accessories' AND column_name = 'description'
  `);
  
  if (colCheck.rows.length === 0) {
    console.log('Adding description column to accessories table...');
    await pool.query('ALTER TABLE accessories ADD COLUMN description TEXT');
    console.log('Done.');
  }

  // Read lighting CSV
  const csvPath = process.argv[2] || 'C:/Users/Scott-Pc/clawd/Lighting_TechGuide.csv';
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  
  console.log('Lighting CSV headers:', header.join(', '));
  console.log('Total rows:', lines.length - 1);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, j) => row[h.toLowerCase()] = cols[j]);
    
    const sku = row.sku;
    if (!sku) continue;
    
    const title = row.displayname || '';
    const msrp = parseFloat(row.msrp) || null;
    const map = parseFloat(row.map) || null;
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = cost ? Math.min(cost * 1.3, msrp || Infinity) : (map || msrp);
    
    // Build description from detailed fields
    let description = row.detaileddescription || '';
    
    // Add tech specs
    const techSpecs = [];
    for (let t = 1; t <= 10; t++) {
      const spec = row[`techspecs${t}`];
      if (spec) techSpecs.push(spec);
    }
    if (techSpecs.length > 0) {
      description += '\n\nTech Specs:\n• ' + techSpecs.join('\n• ');
    }
    
    // Add what's included
    const whatsIncluded = [];
    for (let w = 1; w <= 5; w++) {
      const item = row[`whatsincluded${w}`];
      if (item) whatsIncluded.push(item);
    }
    if (whatsIncluded.length > 0) {
      description += '\n\nWhat\'s Included:\n• ' + whatsIncluded.join('\n• ');
    }
    
    // Get images
    const images = [];
    for (let img = 1; img <= 15; img++) {
      const imgUrl = row[`imagelink${img}`];
      if (imgUrl) images.push(imgUrl);
    }
    
    try {
      const result = await pool.query(`
        INSERT INTO accessories (
          sku, title, brand, brand_code, category, sub_type, 
          msrp, map_price, sell_price, cost, 
          image_url, image_url_2, image_url_3, 
          upc, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (sku) DO UPDATE SET 
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          msrp = COALESCE(EXCLUDED.msrp, accessories.msrp),
          map_price = COALESCE(EXCLUDED.map_price, accessories.map_price),
          sell_price = COALESCE(EXCLUDED.sell_price, accessories.sell_price),
          image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), accessories.image_url),
          image_url_2 = COALESCE(NULLIF(EXCLUDED.image_url_2, ''), accessories.image_url_2),
          image_url_3 = COALESCE(NULLIF(EXCLUDED.image_url_3, ''), accessories.image_url_3),
          description = COALESCE(NULLIF(EXCLUDED.description, ''), accessories.description),
          updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert
      `, [
        sku,
        title,
        row.brand,
        row.brand_code_3,
        'lighting',
        row.subcategory?.toLowerCase() || 'lighting',
        msrp,
        map,
        sellPrice,
        cost,
        images[0] || null,
        images[1] || null,
        images[2] || null,
        row.upc,
        description.trim() || null
      ]);
      
      if (result.rows[0]?.is_insert) inserted++;
      else updated++;
      
      if (i % 100 === 0) {
        console.log(`Progress: ${i}/${lines.length - 1} (${Math.round(i / (lines.length - 1) * 100)}%)`);
      }
    } catch (e) {
      errors++;
      if (errors < 10) console.error('Row error:', sku, e.message);
    }
  }
  
  console.log('\n=== LIGHTING IMPORT COMPLETE ===');
  console.log('Inserted:', inserted);
  console.log('Updated:', updated);
  console.log('Errors:', errors);
  
  // Verify
  const check = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(image_url) as with_image,
      COUNT(description) as with_desc
    FROM accessories 
    WHERE category = 'lighting'
  `);
  console.log('\nLighting category:');
  console.log('  Total:', check.rows[0].total);
  console.log('  With images:', check.rows[0].with_image);
  console.log('  With descriptions:', check.rows[0].with_desc);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
