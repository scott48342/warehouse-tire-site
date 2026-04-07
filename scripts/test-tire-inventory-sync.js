/**
 * Test tire inventory sync locally
 */
const Client = require('ssh2-sftp-client');
const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const SFTP_CONFIG = {
  host: "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS || "",
};

const TIRE_FEED_PATH = "/CommonFeed/USD/TIRE/tireInvPriceData.json";

async function main() {
  console.log('=== Testing Tire Inventory Sync ===\n');
  
  // 1. Download from SFTP
  console.log('1. Downloading from SFTP...');
  const sftp = new Client();
  await sftp.connect(SFTP_CONFIG);
  const data = await sftp.get(TIRE_FEED_PATH);
  await sftp.end();
  console.log(`   Downloaded ${(data.length / 1024 / 1024).toFixed(2)} MB`);
  
  // 2. Parse JSON
  console.log('\n2. Parsing JSON...');
  const records = JSON.parse(data.toString('utf8'));
  console.log(`   Found ${records.length} tire records`);
  
  // 3. Sample the data
  console.log('\n3. Sample records:');
  for (let i = 0; i < Math.min(5, records.length); i++) {
    const r = records[i];
    console.log(`   ${r.PartNumber}: ${r.Brand || 'N/A'} - QOH: ${r.TotalQOH || 0}`);
  }
  
  // 4. Count with stock
  const withStock = records.filter(r => parseInt(r.TotalQOH || 0) >= 4);
  console.log(`\n4. Records with stock >= 4: ${withStock.length} / ${records.length}`);
  
  // 5. Check 225/55R17 specifically
  console.log('\n5. Checking 225/55R17 tires in feed:');
  const size225 = records.filter(r => {
    const pn = (r.PartNumber || '').toUpperCase();
    const desc = (r.Description || '').toUpperCase();
    return pn.includes('2255517') || desc.includes('225/55R17') || desc.includes('225/55-17');
  });
  console.log(`   Found ${size225.length} records for 225/55R17`);
  size225.slice(0, 10).forEach(r => {
    console.log(`   ${r.PartNumber}: ${r.Brand} - QOH: ${r.TotalQOH || 0}`);
  });
  
  // 6. Update database (first 100 as test)
  console.log('\n6. Updating database (full sync)...');
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  // Process in batches
  const batchSize = 500;
  let updated = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const values = [];
    const placeholders = [];
    
    batch.forEach((record, idx) => {
      const offset = idx * 4;
      placeholders.push(`($${offset + 1}, 'tire', 'TOTAL', $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      values.push(
        record.PartNumber,
        parseInt(record.TotalQOH || 0),
        record.RunDate ? new Date(record.RunDate) : new Date(),
        new Date()
      );
    });
    
    const query = `
      INSERT INTO wp_inventory (sku, product_type, location_id, qoh, run_date, updated_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (sku, product_type, location_id) 
      DO UPDATE SET 
        qoh = EXCLUDED.qoh,
        run_date = EXCLUDED.run_date,
        updated_at = EXCLUDED.updated_at
    `;
    
    await pool.query(query, values);
    updated += batch.length;
    
    if ((i + batchSize) % 2000 === 0 || i + batchSize >= records.length) {
      console.log(`   Processed ${Math.min(i + batchSize, records.length)}/${records.length}`);
    }
  }
  
  console.log(`   Updated ${updated} records`);
  
  // 7. Verify
  console.log('\n7. Verifying update...');
  const verify = await pool.query(`
    SELECT COUNT(*) as cnt, MAX(updated_at) as last_update 
    FROM wp_inventory 
    WHERE product_type = 'tire'
  `);
  console.log(`   Tires in wp_inventory: ${verify.rows[0].cnt}`);
  console.log(`   Last update: ${verify.rows[0].last_update}`);
  
  // Check 225/55R17 again
  const verify225 = await pool.query(`
    SELECT t.sku, t.brand_desc, COALESCE(i.qoh, 0) as stock 
    FROM wp_tires t 
    LEFT JOIN wp_inventory i ON i.sku = t.sku AND i.product_type = 'tire' AND i.location_id = 'TOTAL' 
    WHERE t.simple_size = '2255517' 
    ORDER BY COALESCE(i.qoh, 0) DESC 
    LIMIT 10
  `);
  console.log(`\n   225/55R17 after sync:`);
  verify225.rows.forEach(r => {
    console.log(`   ${r.sku}: ${r.brand_desc} - stock: ${r.stock}`);
  });
  
  await pool.end();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
