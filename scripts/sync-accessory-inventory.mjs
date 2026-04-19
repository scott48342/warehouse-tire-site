/**
 * Sync Accessory Inventory
 * 
 * Downloads accessoriesInvPriceData.csv from WheelPros SFTP
 * and updates in_stock flag for all accessories.
 */
import pg from 'pg';
import Client from 'ssh2-sftp-client';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function downloadInventory() {
  const sftp = new Client();
  const localPath = './data/accessoriesInvPriceData.csv';
  
  try {
    await sftp.connect({
      host: 'sftp.wheelpros.com',
      port: 22,
      username: 'Warehouse1',
      password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
    });
    
    console.log('Downloading accessoriesInvPriceData.csv...');
    await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv', localPath);
    await sftp.end();
    
    console.log('Downloaded!');
    return localPath;
  } catch (err) {
    console.error('SFTP error:', err.message);
    await sftp.end().catch(() => {});
    throw err;
  }
}

async function parseInventory(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/ /g, '_'));
  
  console.log('CSV columns:', header.join(', '));
  
  // Find column indexes
  const skuIdx = header.findIndex(h => h === 'partnumber' || h === 'part_number' || h === 'sku');
  const qtyIdx = header.findIndex(h => h === 'totalqoh' || h === 'total_qoh' || h === 'qty');
  
  if (skuIdx === -1 || qtyIdx === -1) {
    throw new Error(`Missing columns. SKU index: ${skuIdx}, QTY index: ${qtyIdx}`);
  }
  
  const inventory = new Map();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sku = cols[skuIdx]?.trim();
    const qty = parseInt(cols[qtyIdx]) || 0;
    
    if (sku) {
      inventory.set(sku, qty);
    }
  }
  
  console.log(`Parsed ${inventory.size} SKUs from inventory feed`);
  return inventory;
}

async function updateInStock(inventory) {
  console.log('\nUpdating in_stock flags...');
  
  // Get all accessory SKUs
  const result = await pool.query('SELECT sku FROM accessories');
  const allSkus = result.rows.map(r => r.sku);
  console.log(`Total accessories in DB: ${allSkus.length}`);
  
  // Build arrays for batch update
  const inStockSkus = [];
  const outOfStockSkus = [];
  
  for (const sku of allSkus) {
    const qty = inventory.get(sku) || 0;
    if (qty > 0) {
      inStockSkus.push(sku);
    } else {
      outOfStockSkus.push(sku);
    }
  }
  
  console.log(`In stock: ${inStockSkus.length}`);
  console.log(`Out of stock: ${outOfStockSkus.length}`);
  
  // Batch update in_stock = true
  if (inStockSkus.length > 0) {
    await pool.query(
      'UPDATE accessories SET in_stock = true, updated_at = NOW() WHERE sku = ANY($1)',
      [inStockSkus]
    );
  }
  
  // Batch update in_stock = false
  if (outOfStockSkus.length > 0) {
    await pool.query(
      'UPDATE accessories SET in_stock = false, updated_at = NOW() WHERE sku = ANY($1)',
      [outOfStockSkus]
    );
  }
  
  return { inStock: inStockSkus.length, outOfStock: outOfStockSkus.length };
}

async function run() {
  console.log('=== Accessory Inventory Sync ===\n');
  
  // Ensure data directory exists
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
  }
  
  const csvPath = await downloadInventory();
  const inventory = await parseInventory(csvPath);
  const result = await updateInStock(inventory);
  
  await pool.end();
  
  console.log('\n✅ Done!');
  console.log(`   In stock: ${result.inStock}`);
  console.log(`   Out of stock: ${result.outOfStock}`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
