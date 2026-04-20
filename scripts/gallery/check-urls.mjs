/**
 * Check gallery URL patterns
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  try {
    // 1. Get distinct URL patterns
    console.log('=== URL PATTERN ANALYSIS ===\n');
    
    const patterns = await pool.query(`
      SELECT 
        CASE 
          WHEN thumbnail_url LIKE '%canto.com%' THEN 'canto'
          WHEN thumbnail_url LIKE '%cloudfront.net%' THEN 'cloudfront'
          ELSE 'other'
        END as source,
        COUNT(*) as count,
        MIN(thumbnail_url) as example_thumbnail,
        MIN(source_url) as example_source
      FROM gallery_assets
      WHERE thumbnail_url IS NOT NULL
      GROUP BY 1
      ORDER BY count DESC
    `);
    
    console.log('URL Sources:');
    for (const row of patterns.rows) {
      console.log(`\n${row.source}: ${row.count} images`);
      console.log(`  Thumbnail: ${row.example_thumbnail}`);
      console.log(`  Source: ${row.example_source}`);
    }
    
    // 2. Get sample Canto URLs if any
    console.log('\n\n=== CANTO URL SAMPLES ===\n');
    const cantoSamples = await pool.query(`
      SELECT id, thumbnail_url, source_url 
      FROM gallery_assets 
      WHERE thumbnail_url LIKE '%canto%' 
      LIMIT 3
    `);
    
    if (cantoSamples.rows.length > 0) {
      for (const row of cantoSamples.rows) {
        console.log(`ID ${row.id}:`);
        console.log(`  Thumb: ${row.thumbnail_url}`);
        console.log(`  Full:  ${row.source_url}`);
      }
    } else {
      console.log('No Canto URLs found in thumbnail_url');
    }
    
    // 3. Check for any URLs with different patterns
    console.log('\n\n=== CLOUDFRONT URL STRUCTURE ===\n');
    const cfSample = await pool.query(`
      SELECT thumbnail_url, source_url 
      FROM gallery_assets 
      WHERE thumbnail_url LIKE '%cloudfront%' 
      LIMIT 1
    `);
    
    if (cfSample.rows.length > 0) {
      const thumb = cfSample.rows[0].thumbnail_url;
      const source = cfSample.rows[0].source_url;
      
      console.log('Thumbnail URL structure:');
      console.log(`  ${thumb}`);
      console.log(`  Pattern: cloudfront.net/{bucket-id}/{asset-id}.{size}.jpg`);
      console.log(`  Size suffix: .240.jpg (thumbnail)`);
      
      console.log('\nSource URL structure:');
      console.log(`  ${source}`);
      console.log(`  Size suffix: .800.jpg (full size)`);
    }
    
    // 4. Check when data was imported
    console.log('\n\n=== IMPORT TIMESTAMPS ===\n');
    const timestamps = await pool.query(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(*) as total
      FROM gallery_assets
    `);
    
    const ts = timestamps.rows[0];
    console.log(`Total assets: ${ts.total}`);
    console.log(`Earliest: ${ts.earliest}`);
    console.log(`Latest: ${ts.latest}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
