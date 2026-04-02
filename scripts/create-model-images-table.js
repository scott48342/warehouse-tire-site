#!/usr/bin/env node
/**
 * Create tire_model_images table for brand+model → image lookup
 * This enables image sharing across tire sizes of the same model
 */
require('dotenv').config({path: '.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl: {rejectUnauthorized: false}});

async function main() {
  console.log('Creating tire_model_images table...\n');
  
  // Create table for brand+model → image mapping
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tire_model_images (
      id SERIAL PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      model_pattern VARCHAR(200) NOT NULL,
      image_url TEXT NOT NULL,
      source VARCHAR(50) DEFAULT 'km',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(brand, model_pattern)
    )
  `);
  
  // Create indexes for fast lookup
  await pool.query(`CREATE INDEX IF NOT EXISTS tire_model_images_brand_idx ON tire_model_images(LOWER(brand))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS tire_model_images_lookup_idx ON tire_model_images(LOWER(brand), LOWER(model_pattern))`);
  
  console.log('Table created.\n');
  
  // Now populate from existing km_image_mappings + product data
  // We need to match part numbers to their brand/model names
  // For now, let's create a manual mapping for common brands
  
  const brandModelMappings = [
    // Goodyear
    { brand: 'Goodyear', pattern: 'Assurance WeatherReady', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/150/G67bg.jpg' },
    { brand: 'Goodyear', pattern: 'Wrangler TrailRunner AT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/150/G97bg.jpg' },
    { brand: 'Goodyear', pattern: 'Eagle Sport All-Season', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/150/GEBbg.jpg' },
    
    // Michelin  
    { brand: 'Michelin', pattern: 'Defender', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/133/M81bg.jpg' },
    { brand: 'Michelin', pattern: 'Defender LTX M/S', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/133/M81bg.jpg' },
    { brand: 'Michelin', pattern: 'Pilot Sport', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/133/M85bg.jpg' },
    { brand: 'Michelin', pattern: 'CrossClimate', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/133/MCCbg.jpg' },
    
    // BFGoodrich
    { brand: 'BFGoodrich', pattern: 'All-Terrain T/A KO2', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/108/BKObg.jpg' },
    { brand: 'BFGoodrich', pattern: 'Mud-Terrain T/A KM3', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/108/BM3bg.jpg' },
    
    // Cooper
    { brand: 'Cooper', pattern: 'Discoverer AT3', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/113/CA3bg.jpg' },
    { brand: 'Cooper', pattern: 'Discoverer STT Pro', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/113/CSPbg.jpg' },
    
    // Continental
    { brand: 'Continental', pattern: 'CrossContact', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/112/C5Xbg.jpg' },
    { brand: 'Continental', pattern: 'TerrainContact', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/112/CTAbg.jpg' },
    
    // Bridgestone
    { brand: 'Bridgestone', pattern: 'Dueler', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/109/BDAbg.jpg' },
    { brand: 'Bridgestone', pattern: 'Ecopia', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/109/BECbg.jpg' },
    
    // Pirelli
    { brand: 'Pirelli', pattern: 'Scorpion', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/144/PSCbg.jpg' },
    { brand: 'Pirelli', pattern: 'P Zero', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/144/PPZbg.jpg' },
    
    // Falken
    { brand: 'Falken', pattern: 'Wildpeak', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/122/FWPbg.jpg' },
    
    // Toyo
    { brand: 'Toyo', pattern: 'Open Country', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/155/TOCbg.jpg' },
    
    // Nitto
    { brand: 'Nitto', pattern: 'Ridge Grappler', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/141/NRGbg.jpg' },
    { brand: 'Nitto', pattern: 'Terra Grappler', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/141/NTGbg.jpg' },
    
    // Hankook
    { brand: 'Hankook', pattern: 'Dynapro', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/125/HDYbg.jpg' },
    { brand: 'Hankook', pattern: 'Kinergy', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/125/HKNbg.jpg' },
    
    // Yokohama
    { brand: 'Yokohama', pattern: 'Geolandar', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/156/YGLbg.jpg' },
    
    // General
    { brand: 'General', pattern: 'Grabber', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/123/GGRbg.jpg' },
    { brand: 'General', pattern: 'Altimax', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/123/GAMbg.jpg' },
    
    // Kumho
    { brand: 'Kumho', pattern: 'Road Venture', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/130/KRVbg.jpg' },
    { brand: 'Kumho', pattern: 'Crugen', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/130/KCRbg.jpg' },
    
    // Nexen
    { brand: 'Nexen', pattern: 'Roadian', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/140/NRDbg.jpg' },
    { brand: 'Nexen', pattern: "N'Priz", image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/140/NNPbg.jpg' },
  ];
  
  console.log(`Inserting ${brandModelMappings.length} brand+model mappings...`);
  
  let inserted = 0;
  for (const m of brandModelMappings) {
    try {
      await pool.query(`
        INSERT INTO tire_model_images (brand, model_pattern, image_url, source)
        VALUES ($1, $2, $3, 'km')
        ON CONFLICT (brand, model_pattern) DO UPDATE SET
          image_url = EXCLUDED.image_url
      `, [m.brand, m.pattern, m.image]);
      inserted++;
    } catch (err) {
      console.error(`Error inserting ${m.brand} ${m.pattern}:`, err.message);
    }
  }
  
  console.log(`Inserted ${inserted} mappings.\n`);
  
  // Show table status
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM tire_model_images');
  console.log(`Total records in tire_model_images: ${count}`);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
