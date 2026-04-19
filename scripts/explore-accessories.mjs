import Client from 'ssh2-sftp-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sftp = new Client();

// Simple CSV parser that handles quotes
function parseCSV(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

async function main() {
  await sftp.connect({
    host: 'ftp.wheelpros.com',
    port: 22,
    username: 'Warehouse1',
    password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!'
  });
  
  console.log('Downloading Accessory_TechGuide.csv...');
  const data = await sftp.get('/TechFeed/Accessory_TechGuide.csv');
  const lines = data.toString().split('\n').filter(l => l.trim());
  
  const header = parseCSV(lines[0]);
  console.log('\n=== COLUMNS ===');
  header.forEach((h, i) => console.log(`${i}: ${h}`));
  
  console.log('\n=== SAMPLE ROWS ===');
  for (let i = 1; i <= 10 && i < lines.length; i++) {
    const cols = parseCSV(lines[i]);
    console.log(`\n--- Row ${i} ---`);
    header.forEach((h, j) => {
      if (cols[j]) console.log(`  ${h}: ${cols[j]}`);
    });
  }
  
  // Analyze categories
  const types = {};
  const brands = {};
  const boltPatterns = {};
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSV(lines[i]);
    const row = {};
    header.forEach((h, j) => row[h] = cols[j]);
    
    const type = row.sub_type || row.category;
    const brand = row.brand_desc;
    const desc = row.product_desc || row.description || '';
    
    if (type) types[type] = (types[type] || 0) + 1;
    if (brand) brands[brand] = (brands[brand] || 0) + 1;
    
    // Extract bolt patterns from descriptions
    const bpMatch = desc.match(/(\d)X(\d{3}(?:\.\d)?)/i);
    if (bpMatch) {
      const bp = `${bpMatch[1]}x${bpMatch[2]}`;
      boltPatterns[bp] = (boltPatterns[bp] || 0) + 1;
    }
  }
  
  console.log('\n=== PRODUCT TYPES ===');
  Object.entries(types).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`${t}: ${c}`));
  
  console.log('\n=== TOP BRANDS ===');
  Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([b, c]) => console.log(`${b}: ${c}`));
  
  console.log('\n=== BOLT PATTERNS IN DESCRIPTIONS ===');
  Object.entries(boltPatterns).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([bp, c]) => console.log(`${bp}: ${c}`));
  
  console.log(`\n=== TOTAL: ${lines.length - 1} products ===`);
  
  await sftp.end();
}

main().catch(e => { console.error(e); process.exit(1); });
