#!/usr/bin/env node
require('dotenv').config({path: '.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl: {rejectUnauthorized: false}});

async function main() {
  // Get unique prodline values and count of images per prodline
  const { rows } = await pool.query(`
    SELECT prodline, COUNT(*) as image_count, MIN(image_url) as sample_url
    FROM km_image_mappings 
    WHERE image_url IS NOT NULL
    GROUP BY prodline
    ORDER BY image_count DESC
  `);
  
  console.log(`Found ${rows.length} unique prodlines with images:\n`);
  rows.forEach(r => {
    const imgFile = r.sample_url.split('/').slice(-2).join('/');
    console.log(`  prodline=${r.prodline.padEnd(4)} | ${r.image_count} images | ${imgFile}`);
  });
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
