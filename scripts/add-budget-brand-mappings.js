#!/usr/bin/env node
/**
 * Add tire model image mappings for budget and off-road brands
 */
require('dotenv').config({path: '.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl: {rejectUnauthorized: false}});

async function main() {
  // First, let's look at what images we have and try to identify brands
  // by looking at existing km_image_mappings part numbers
  
  // Get sample part numbers for each prodline
  const { rows: samples } = await pool.query(`
    SELECT DISTINCT ON (prodline) prodline, part_number, image_url
    FROM km_image_mappings 
    WHERE image_url IS NOT NULL
    ORDER BY prodline, part_number
  `);
  
  console.log('Sample part numbers per prodline:');
  samples.slice(0, 10).forEach(s => {
    console.log(`  ${s.prodline}: ${s.part_number}`);
  });
  
  // Budget and off-road brand mappings
  // These are based on common tire lines from K&M inventory
  const brandModelMappings = [
    // RBP (Rolling Big Power)
    { brand: 'RBP', pattern: 'Repulsor', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/162/1D0bg.jpg' },
    { brand: 'RBP', pattern: 'Repulsor MT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/162/1D0bg.jpg' },
    { brand: 'RBP', pattern: 'Repulsor XT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/162/1D0bg.jpg' },
    { brand: 'RBP', pattern: 'Repulsor RT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/162/1D0bg.jpg' },
    
    // Lionhart
    { brand: 'Lionhart', pattern: 'Lionclaw', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/211/3GHbg.jpg' },
    { brand: 'Lionhart', pattern: 'LH-Ten', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/211/3GHbg.jpg' },
    { brand: 'Lionhart', pattern: 'LH-Five', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/211/3GHbg.jpg' },
    { brand: 'Lionhart', pattern: 'LH-503', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/211/3GHbg.jpg' },
    
    // Lexani
    { brand: 'Lexani', pattern: 'LX-Twenty', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/221/2UCbg.jpg' },
    { brand: 'Lexani', pattern: 'LX-Thirty', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/221/2UCbg.jpg' },
    { brand: 'Lexani', pattern: 'LXHT-206', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/221/2UCbg.jpg' },
    { brand: 'Lexani', pattern: 'Terrain Beast', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/221/2UCbg.jpg' },
    
    // Thunderer
    { brand: 'Thunderer', pattern: 'Ranger', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/170/1PSbg.jpg' },
    { brand: 'Thunderer', pattern: 'Ranger ATR', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/170/1PSbg.jpg' },
    { brand: 'Thunderer', pattern: 'Ranger R404', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/170/1PSbg.jpg' },
    { brand: 'Thunderer', pattern: 'THUNDERR CLT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/170/1PSbg.jpg' },
    { brand: 'Thunderer', pattern: 'Mach', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/170/1PSbg.jpg' },
    
    // Ironman / Ironhead
    { brand: 'Ironman', pattern: 'All Country', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/202/250bg.jpg' },
    { brand: 'Ironman', pattern: 'iMove', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/202/250bg.jpg' },
    { brand: 'Ironhead', pattern: 'Thrasher', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/202/250bg.jpg' },
    
    // Atturo
    { brand: 'Atturo', pattern: 'Trail Blade', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/101/19Obg.jpg' },
    { brand: 'Atturo', pattern: 'AZ850', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/101/19Obg.jpg' },
    
    // Fury
    { brand: 'Fury', pattern: 'Country Hunter', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/120/1LWbg.jpg' },
    { brand: 'Fury', pattern: 'RT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/120/1LWbg.jpg' },
    { brand: 'Fury', pattern: 'MT', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/120/1LWbg.jpg' },
    
    // Kanati
    { brand: 'Kanati', pattern: 'Mud Hog', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/127/29Sbg.jpg' },
    { brand: 'Kanati', pattern: 'Trail Hog', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/127/29Sbg.jpg' },
    
    // Venom Power
    { brand: 'Venom Power', pattern: 'Terra Hunter', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/245/3J6bg.jpg' },
    { brand: 'Venom Power', pattern: 'Terrain Hunter', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/245/3J6bg.jpg' },
    
    // Mastercraft
    { brand: 'Mastercraft', pattern: 'Courser', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/130/17Cbg.jpg' },
    { brand: 'Mastercraft', pattern: 'Stratus', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/130/17Cbg.jpg' },
    
    // Starfire
    { brand: 'Starfire', pattern: 'Solarus', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/154/378bg.jpg' },
    
    // Westlake
    { brand: 'Westlake', pattern: 'SL369', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/165/10Gbg.jpg' },
    { brand: 'Westlake', pattern: 'SA07', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/165/10Gbg.jpg' },
    { brand: 'Westlake', pattern: 'RP18', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/165/10Gbg.jpg' },
    
    // Federal
    { brand: 'Federal', pattern: 'Couragia', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/122/1HGbg.jpg' },
    { brand: 'Federal', pattern: 'Xplora', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/122/1HGbg.jpg' },
    
    // Kenda
    { brand: 'Kenda', pattern: 'Klever', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/127/29Sbg.jpg' },
    
    // Milestar
    { brand: 'Milestar', pattern: 'Patagonia', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/236/3CWbg.jpg' },
    { brand: 'Milestar', pattern: 'MS932', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/236/3CWbg.jpg' },
    
    // Achilles
    { brand: 'Achilles', pattern: 'Desert Hawk', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/102/1Z1bg.jpg' },
    { brand: 'Achilles', pattern: 'ATR Sport', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/102/1Z1bg.jpg' },
    
    // Delinte
    { brand: 'Delinte', pattern: 'DX10', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/113/2APbg.jpg' },
    { brand: 'Delinte', pattern: 'D7', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/113/2APbg.jpg' },
    
    // Sentury
    { brand: 'Sentury', pattern: 'Crossover', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/153/W5bg.jpg' },
    
    // Fullway
    { brand: 'Fullway', pattern: 'HP108', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/121/U24bg.jpg' },
    { brand: 'Fullway', pattern: 'HS266', image: 'https://km-tire-images.nyc3.digitaloceanspaces.com/images/tireimages/121/U24bg.jpg' },
  ];
  
  console.log(`\nInserting ${brandModelMappings.length} budget/off-road brand mappings...`);
  
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
  
  // Show total
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM tire_model_images');
  console.log(`Total records in tire_model_images: ${count}`);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
