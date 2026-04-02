#!/usr/bin/env node
/**
 * Import K&M image mappings from mappings.json into the database
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const pg = require('pg');

const { Pool } = pg;

const MAPPINGS_FILE = path.join(__dirname, 'mappings.json');

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing POSTGRES_URL or DATABASE_URL');
    process.exit(1);
  }

  // Load mappings
  const data = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
  const mappings = data.mappings || {};
  const partNumbers = Object.keys(mappings);
  
  console.log(`Loaded ${partNumbers.length} mappings from ${MAPPINGS_FILE}`);
  console.log(`Sizes searched: ${data.sizesSearched?.join(', ') || 'unknown'}`);
  console.log();

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS km_image_mappings (
        part_number VARCHAR(50) PRIMARY KEY,
        prodline VARCHAR(20),
        folder_id VARCHAR(20),
        image_url TEXT,
        fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS km_image_mappings_prodline_idx ON km_image_mappings(prodline)`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const partNumber of partNumbers) {
      const mapping = mappings[partNumber];
      const imageUrl = mapping.imageUrl || mapping.image_url;
      
      if (!imageUrl) {
        errors++;
        continue;
      }

      // Extract prodline and folder from URL if possible
      // URL format: https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/{prodline}/{folderId}bg.jpg
      let prodline = null;
      let folderId = null;
      const urlMatch = imageUrl.match(/tireimages\/(\d+)\/([A-Za-z0-9]+)bg\.jpg/);
      if (urlMatch) {
        prodline = urlMatch[1];
        folderId = urlMatch[2];
      }

      try {
        const result = await pool.query(`
          INSERT INTO km_image_mappings (part_number, prodline, folder_id, image_url, fetched_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (part_number) DO UPDATE SET
            image_url = EXCLUDED.image_url,
            prodline = COALESCE(EXCLUDED.prodline, km_image_mappings.prodline),
            folder_id = COALESCE(EXCLUDED.folder_id, km_image_mappings.folder_id),
            fetched_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [partNumber, prodline, folderId, imageUrl]);

        if (result.rows[0]?.inserted) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`Error inserting ${partNumber}:`, err.message);
        errors++;
      }
    }

    console.log('=== Import Complete ===');
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Updated:  ${updated}`);
    console.log(`  Errors:   ${errors}`);
    console.log(`  Total:    ${inserted + updated}`);

    // Show count in DB
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM km_image_mappings');
    console.log(`\nTotal in database: ${rows[0].count}`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
