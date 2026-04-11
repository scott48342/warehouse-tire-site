const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Extracting wheel styles for LoRA training...\n');
  
  // Get all distinct styles with images that are in stock
  const styles = await pool.query(`
    SELECT DISTINCT ON (w.style)
      w.style,
      w.brand_desc,
      w.display_style_no,
      w.image_url,
      w.image_urls,
      w.sku as sample_sku
    FROM wp_wheels w
    INNER JOIN wp_inventory i ON w.sku = i.sku AND i.qoh > 0 AND i.product_type = 'wheel'
    WHERE w.image_url IS NOT NULL AND w.image_url != ''
    ORDER BY w.style, w.sku
  `);
  
  console.log('Found', styles.rows.length, 'distinct styles with images + in stock');
  
  // Process and save
  const trainingData = styles.rows.map(row => {
    // Parse image_urls if it's a JSON array
    let allImages = [row.image_url];
    if (row.image_urls) {
      try {
        const parsed = typeof row.image_urls === 'string' 
          ? JSON.parse(row.image_urls) 
          : row.image_urls;
        if (Array.isArray(parsed)) {
          allImages = [...new Set([row.image_url, ...parsed])];
        }
      } catch (e) {}
    }
    
    // Create a safe filename from style
    const safeName = (row.brand_desc + '_' + row.style)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
    
    return {
      style: row.style,
      brand: row.brand_desc,
      displayName: row.display_style_no || row.style,
      sampleSku: row.sample_sku,
      loraName: safeName + '_wheel',
      triggerWord: safeName.replace(/_/g, '') + '_wheel',
      images: allImages.filter(Boolean)
    };
  });
  
  // Save to JSON
  const outPath = path.join(__dirname, 'wheel-styles-for-training.json');
  fs.writeFileSync(outPath, JSON.stringify(trainingData, null, 2));
  console.log('\nSaved to:', outPath);
  
  // Show sample
  console.log('\nSample entries:');
  trainingData.slice(0, 3).forEach(s => {
    console.log(`  ${s.brand} ${s.displayName} -> ${s.loraName} (${s.images.length} images)`);
  });
  
  // Stats
  const imageStats = trainingData.reduce((acc, s) => {
    acc[s.images.length] = (acc[s.images.length] || 0) + 1;
    return acc;
  }, {});
  console.log('\nImage count distribution:');
  Object.entries(imageStats).sort((a,b) => a[0]-b[0]).forEach(([count, styles]) => {
    console.log(`  ${count} image(s): ${styles} styles`);
  });
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
