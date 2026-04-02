#!/usr/bin/env node
/**
 * Analyze K&M image mappings to create brand+model → image lookup
 */
require('dotenv').config({path: '.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl: {rejectUnauthorized: false}});

async function main() {
  // Get all mappings with their part numbers
  const { rows: mappings } = await pool.query(`
    SELECT part_number, prodline, folder_id, image_url 
    FROM km_image_mappings 
    WHERE image_url IS NOT NULL
  `);
  
  console.log(`Total mappings: ${mappings.length}`);
  
  // Group by prodline+folder_id (unique model identifier)
  const byModel = new Map();
  for (const m of mappings) {
    const key = `${m.prodline}:${m.folder_id}`;
    if (!byModel.has(key)) {
      byModel.set(key, {
        prodline: m.prodline,
        folderId: m.folder_id,
        imageUrl: m.image_url,
        partNumbers: []
      });
    }
    byModel.get(key).partNumbers.push(m.part_number);
  }
  
  console.log(`Unique models (prodline:folder combinations): ${byModel.size}`);
  
  // Show models with multiple part numbers (proves same image works for multiple sizes)
  console.log('\nModels with multiple sizes (same image):');
  let count = 0;
  for (const [key, model] of byModel) {
    if (model.partNumbers.length > 1 && count < 10) {
      console.log(`  ${key}: ${model.partNumbers.length} part numbers`);
      console.log(`    Sample parts: ${model.partNumbers.slice(0, 3).join(', ')}...`);
      console.log(`    Image: ${model.imageUrl.split('/').slice(-2).join('/')}`);
      count++;
    }
  }
  
  // Now we need to figure out what brand/model these are
  // The prodline+folder might correspond to a specific tire pattern
  console.log('\n\nTo create brand+model mapping, we need to cross-reference with K&M product data...');
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
