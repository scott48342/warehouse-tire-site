require('dotenv').config({path:'.env.local'});
const pg = require('pg');
const pool = new pg.Pool({connectionString: process.env.POSTGRES_URL, ssl:{rejectUnauthorized:false}});

async function run() {
  // Get all unique brand + display_model_no combinations from WheelPros
  console.log('=== All Unique Tire Models in WheelPros Database ===\n');
  
  const {rows: models} = await pool.query(`
    SELECT DISTINCT 
      brand_desc as brand,
      raw->>'display_model_no' as full_model,
      COUNT(*) as variants,
      MIN(image_url) as sample_image
    FROM wp_tires 
    WHERE raw->>'display_model_no' IS NOT NULL
    GROUP BY brand_desc, raw->>'display_model_no'
    ORDER BY brand_desc, raw->>'display_model_no'
  `);
  
  // Get existing image mappings
  const {rows: imgRows} = await pool.query(`
    SELECT brand, model_pattern FROM tire_model_images
  `);
  const existingMappings = new Set(imgRows.map(r => (r.brand + '|' + r.model_pattern).toLowerCase()));
  
  console.log('Brand'.padEnd(20) + ' | ' + 'Full Model Name'.padEnd(35) + ' | Variants | Has Image?');
  console.log('-'.repeat(90));
  
  let missingCount = 0;
  let hasImageCount = 0;
  
  models.forEach(r => {
    if (!r.full_model) return;
    
    // Check if there's an exact match or partial match
    const key = (r.brand + '|' + r.full_model).toLowerCase();
    let hasImage = existingMappings.has(key);
    
    // Also check partial matches
    if (!hasImage) {
      for (const mapping of existingMappings) {
        const [mapBrand, mapModel] = mapping.split('|');
        if (mapBrand === r.brand.toLowerCase() && r.full_model.toLowerCase().includes(mapModel)) {
          hasImage = true;
          break;
        }
      }
    }
    
    const status = hasImage ? '✓' : '❌ MISSING';
    if (!hasImage) missingCount++;
    else hasImageCount++;
    
    console.log(
      r.brand.padEnd(20) + ' | ' + 
      (r.full_model || '').padEnd(35) + ' | ' + 
      String(r.variants).padStart(5) + '   | ' + 
      status
    );
  });
  
  console.log('\n' + '='.repeat(90));
  console.log(`Total: ${models.length} models | With images: ${hasImageCount} | Missing: ${missingCount}`);
  
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
