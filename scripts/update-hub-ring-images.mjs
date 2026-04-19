/**
 * Update Hub Rings with Generic Image
 * 
 * Uses a single representative hub ring image for all hub rings
 * since WheelPros doesn't have individual hub ring images.
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

// Generic hub ring image from WheelPros
const HUB_RING_IMAGE = 'https://media.wheelpros.com/asset/f911a2e6-53d6-4b8a-8def-e8481cecbce2/Large/73-5961-png.png';

async function main() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });
  
  try {
    // Update all hub rings with the generic image
    const result = await pool.query(`
      UPDATE accessories 
      SET image_url = $1, updated_at = NOW()
      WHERE category = 'hub_ring'
      RETURNING sku
    `, [HUB_RING_IMAGE]);
    
    console.log(`Updated ${result.rowCount} hub rings with generic image`);
    
    // Get category stats
    const stats = await pool.query(`
      SELECT category, COUNT(*) as total, 
             COUNT(*) FILTER (WHERE image_url IS NOT NULL) as with_images
      FROM accessories 
      GROUP BY category 
      ORDER BY total DESC
    `);
    
    console.log('\nCategory image stats:');
    for (const row of stats.rows) {
      console.log(`  ${row.category}: ${row.with_images}/${row.total} with images`);
    }
    
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
