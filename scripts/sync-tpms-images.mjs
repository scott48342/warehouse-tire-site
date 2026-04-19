/**
 * Sync TPMS images from manufacturer sites
 * 
 * 31 Inc: https://31inc.com/wp-content/uploads/product-images/{part}.jpg
 *         SKU format: SS17-xxx -> strip "SS" prefix
 * 
 * Schrader: Need to scrape from sensata.com or schraderinternational.com
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function sync31Inc() {
  console.log('=== Syncing 31 Inc TPMS images ===\n');
  
  const result = await pool.query(`
    SELECT sku, title 
    FROM accessories 
    WHERE category = 'tpms' AND brand = '31 Inc' AND in_stock = true
  `);
  
  let updated = 0;
  let failed = 0;
  
  for (const row of result.rows) {
    // Convert SKU to 31 Inc part number (SS17-xxx -> 17-xxx)
    let part = row.sku;
    if (part.startsWith('SS')) {
      part = part.substring(2);
    }
    // Handle US08xxx series (different format)
    if (part.startsWith('US')) {
      part = part; // Keep as-is for now
    }
    
    const imageUrl = `https://31inc.com/wp-content/uploads/product-images/${part}.jpg`;
    
    const exists = await checkUrl(imageUrl);
    
    if (exists) {
      await pool.query(
        'UPDATE accessories SET image_url = $1, updated_at = NOW() WHERE sku = $2',
        [imageUrl, row.sku]
      );
      console.log(`✅ ${row.sku} -> ${part}.jpg`);
      updated++;
    } else {
      console.log(`❌ ${row.sku} -> ${part}.jpg (not found)`);
      failed++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n31 Inc: ${updated} updated, ${failed} not found`);
  return { updated, failed };
}

async function syncSchrader() {
  console.log('\n=== Checking Schrader TPMS images ===\n');
  
  const result = await pool.query(`
    SELECT sku, title 
    FROM accessories 
    WHERE category = 'tpms' AND brand = 'Schrader' AND in_stock = true
  `);
  
  // Schrader products are mostly service kits and tools
  // Their SKUs start with SEZ-
  // Try sensata.com image patterns
  
  let updated = 0;
  let failed = 0;
  
  for (const row of result.rows) {
    // Try various URL patterns
    const patterns = [
      `https://www.schraderinternational.com/getattachment/${row.sku}.jpg`,
      `https://www.sensata.com/sites/default/files/media/image/products/${row.sku.toLowerCase()}.png`,
    ];
    
    let found = false;
    for (const url of patterns) {
      if (await checkUrl(url)) {
        await pool.query(
          'UPDATE accessories SET image_url = $1, updated_at = NOW() WHERE sku = $2',
          [url, row.sku]
        );
        console.log(`✅ ${row.sku} -> found`);
        updated++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log(`❌ ${row.sku} - ${row.title}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\nSchrader: ${updated} updated, ${failed} not found`);
  return { updated, failed };
}

async function run() {
  const inc31 = await sync31Inc();
  const schrader = await syncSchrader();
  
  console.log('\n=== Summary ===');
  console.log(`31 Inc: ${inc31.updated}/${inc31.updated + inc31.failed}`);
  console.log(`Schrader: ${schrader.updated}/${schrader.updated + schrader.failed}`);
  
  await pool.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
