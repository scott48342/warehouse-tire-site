#!/usr/bin/env node
require('dotenv').config({path: '.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl: {rejectUnauthorized: false}});

async function main() {
  // Get unique prodline → image mappings
  const { rows } = await pool.query(`
    SELECT DISTINCT prodline, folder_id, image_url 
    FROM km_image_mappings 
    WHERE prodline IS NOT NULL AND image_url IS NOT NULL
    ORDER BY prodline
  `);
  
  console.log(`Total unique prodlines: ${rows.length}`);
  console.log('\nSample mappings:');
  rows.slice(0, 15).forEach(row => {
    const imgFile = row.image_url.split('/').slice(-1)[0];
    console.log(`  prodline=${row.prodline} → ${imgFile}`);
  });
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
