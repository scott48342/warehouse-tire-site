/**
 * Import Lighting Products from WheelPros TechFeed
 * 
 * Imports Morimoto LED pods, fog lights, headlight conversions,
 * tail lights, etc. from Lighting_TechGuide.csv
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Categorize lighting products by subcategory
 */
function categorizeLighting(subcategory, title) {
  const sub = (subcategory || '').toUpperCase();
  const t = (title || '').toUpperCase();
  
  // Off-road LED pods
  if (sub.includes('OFF ROAD') || t.includes('4BANGER') || t.includes('LED POD')) {
    return { category: 'lighting', subType: 'led_pod' };
  }
  
  // Fog lights
  if (sub.includes('FOG') || t.includes('FOG LIGHT') || t.includes('FOG BRACKET')) {
    return { category: 'lighting', subType: 'fog_light' };
  }
  
  // Headlights
  if (sub.includes('HEADLIGHT') || t.includes('HEADLIGHT')) {
    return { category: 'lighting', subType: 'headlight' };
  }
  
  // Tail lights
  if (sub.includes('TAIL') || t.includes('TAIL LIGHT')) {
    return { category: 'lighting', subType: 'tail_light' };
  }
  
  // Light bars
  if (sub.includes('LIGHT BAR') || t.includes('LIGHT BAR')) {
    return { category: 'lighting', subType: 'light_bar' };
  }
  
  // Rock lights
  if (sub.includes('ROCK') || t.includes('ROCK LIGHT')) {
    return { category: 'lighting', subType: 'rock_light' };
  }
  
  // Build materials / adapters - skip or mark as "parts"
  if (sub.includes('BUILD MATERIAL') || sub.includes('ADAPTER') || sub.includes('BULB')) {
    return { category: 'lighting', subType: 'lighting_parts' };
  }
  
  return { category: 'lighting', subType: 'lighting' };
}

/**
 * Parse lighting CSV
 */
function parseLightingCSV(csvPath) {
  const products = [];
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.log('No data in CSV');
    return products;
  }
  
  const header = parseCSVLine(lines[0]);
  const colIndex = {};
  header.forEach((h, i) => {
    colIndex[h.toLowerCase().replace(/ /g, '_')] = i;
  });
  
  console.log('CSV columns:', Object.keys(colIndex).join(', '));
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    
    const sku = cols[colIndex.sku];
    if (!sku) continue;
    
    const title = cols[colIndex.displayname] || cols[colIndex.product_desc] || '';
    const subcategory = cols[colIndex.subcategory] || '';
    const brand = cols[colIndex.brand] || 'Morimoto';
    const brandCode = cols[colIndex.brand_code_3] || 'MNX';
    const msrp = parseFloat(cols[colIndex.msrp]) || null;
    const map = parseFloat(cols[colIndex.map]) || null;
    const upc = cols[colIndex.upc] || null;
    
    // Get image URLs (up to 3)
    const imageUrl = cols[colIndex.imagelink1] || null;
    const imageUrl2 = cols[colIndex.imagelink2] || null;
    const imageUrl3 = cols[colIndex.imagelink3] || null;
    
    // Calculate pricing
    const cost = msrp ? msrp * 0.75 : null;
    const sellPrice = cost ? Math.round((cost * 1.30) * 100) / 100 : null;
    
    const { category, subType } = categorizeLighting(subcategory, title);
    
    products.push({
      sku,
      title,
      brand,
      brandCode,
      category,
      subType,
      msrp,
      map,
      cost,
      sellPrice,
      imageUrl,
      imageUrl2,
      imageUrl3,
      upc,
    });
  }
  
  return products;
}

/**
 * Insert/update products in database
 */
async function insertProducts(pool, products) {
  console.log(`\nInserting ${products.length} lighting products...`);
  
  const client = await pool.connect();
  let inserted = 0, updated = 0, skipped = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const p of products) {
      // Skip parts/adapters - we only want the good stuff
      if (p.subType === 'lighting_parts' && p.msrp < 50) {
        skipped++;
        continue;
      }
      
      const result = await client.query(`
        INSERT INTO accessories (
          sku, title, brand, brand_code, category, sub_type,
          msrp, map_price, sell_price, cost,
          image_url, image_url_2, image_url_3,
          in_stock, upc
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (sku) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          brand_code = EXCLUDED.brand_code,
          category = EXCLUDED.category,
          sub_type = EXCLUDED.sub_type,
          msrp = EXCLUDED.msrp,
          map_price = EXCLUDED.map_price,
          sell_price = EXCLUDED.sell_price,
          cost = EXCLUDED.cost,
          image_url = COALESCE(EXCLUDED.image_url, accessories.image_url),
          image_url_2 = COALESCE(EXCLUDED.image_url_2, accessories.image_url_2),
          image_url_3 = COALESCE(EXCLUDED.image_url_3, accessories.image_url_3),
          updated_at = NOW()
        RETURNING (xmax = 0) AS is_insert
      `, [
        p.sku,
        p.title,
        p.brand,
        p.brandCode,
        p.category,
        p.subType,
        p.msrp,
        p.map,
        p.sellPrice,
        p.cost,
        p.imageUrl,
        p.imageUrl2,
        p.imageUrl3,
        false, // in_stock - updated by inventory sync
        p.upc,
      ]);
      
      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const csvPath = process.argv[2] || './data/Lighting_TechGuide.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    console.error('Please download Lighting_TechGuide.csv from SFTP first.');
    process.exit(1);
  }
  
  console.log(`Reading ${csvPath}...`);
  const products = parseLightingCSV(csvPath);
  console.log(`Parsed ${products.length} lighting products`);
  
  // Show subcategory breakdown
  const bySubType = {};
  for (const p of products) {
    bySubType[p.subType] = (bySubType[p.subType] || 0) + 1;
  }
  console.log('\nBy subcategory:');
  Object.entries(bySubType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
  
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    await insertProducts(pool, products);
    
    // Show final stats
    const stats = await pool.query(`
      SELECT sub_type, COUNT(*) as total, 
             COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
      FROM accessories 
      WHERE category = 'lighting'
      GROUP BY sub_type
      ORDER BY total DESC
    `);
    
    console.log('\nLighting products in DB:');
    for (const row of stats.rows) {
      console.log(`  ${row.sub_type}: ${row.total} (${row.with_images} with images)`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
