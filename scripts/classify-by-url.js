const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function classify() {
  // Get all unclassified styles
  const res = await pool.query(
    'SELECT style_key, image_url FROM wheel_style_assets WHERE is_front_facing IS NULL'
  );
  console.log('Unclassified styles:', res.rows.length);
  
  let frontFacing = 0;
  let angled = 0;
  let unknown = 0;
  
  for (const row of res.rows) {
    const url = row.image_url || '';
    let isFront = null;
    let confidence = 0;
    let notes = '';
    
    // Check URL patterns
    if (url.includes('-A1-') || url.includes('_A1.') || url.includes('-A1.')) {
      isFront = true;
      confidence = 90;
      notes = 'URL pattern: A1 (front angle)';
      frontFacing++;
    } else if (url.includes('-A2-') || url.includes('_A2') || url.includes('_rt') || url.includes('-rt')) {
      isFront = false;
      confidence = 85;
      notes = 'URL pattern: A2/rt (angled view)';
      angled++;
    } else if (url.includes('Standard')) {
      isFront = true;
      confidence = 80;
      notes = 'URL pattern: Standard (likely front)';
      frontFacing++;
    } else if (/images\.wheelpros\.com.*\/h[A-Z]/.test(url)) {
      // Legacy h-prefix - assume front for now
      isFront = true;
      confidence = 70;
      notes = 'URL pattern: Legacy h-prefix (assumed front)';
      frontFacing++;
    } else if (url) {
      // Has image but unknown pattern - assume front
      isFront = true;
      confidence = 50;
      notes = 'URL pattern: Unknown (assumed front)';
      unknown++;
      frontFacing++;
    } else {
      // No image
      isFront = false;
      confidence = 0;
      notes = 'No image URL';
      angled++;
    }
    
    const status = isFront ? 'usable' : 'needs_normalization';
    
    await pool.query(
      `UPDATE wheel_style_assets 
       SET is_front_facing = $1, 
           classification_confidence = $2, 
           notes = $3, 
           classified_by = $4, 
           classified_at = NOW(), 
           visualizer_status = $5, 
           updated_at = NOW() 
       WHERE style_key = $6`,
      [isFront, confidence, notes, 'url_pattern', status, row.style_key]
    );
  }
  
  console.log('\n✅ Classification complete:');
  console.log('  Front-facing (usable):', frontFacing);
  console.log('  Angled/No image:', angled);
  console.log('  Unknown (assumed front):', unknown);
  
  // Get summary
  const summary = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE is_front_facing = true) as front_facing,
      COUNT(*) FILTER (WHERE is_front_facing = false) as angled,
      COUNT(*) FILTER (WHERE visualizer_status = 'usable') as usable
    FROM wheel_style_assets
  `);
  
  console.log('\nDatabase totals:');
  console.log('  Front-facing:', summary.rows[0].front_facing);
  console.log('  Angled:', summary.rows[0].angled);
  console.log('  Usable for visualizer:', summary.rows[0].usable);
  
  await pool.end();
}

classify().catch(e => { 
  console.error('Error:', e.message); 
  pool.end(); 
});
