/**
 * Analyze unknown image URL patterns
 * Run: node scripts/wheel-image-patterns.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function detectImageType(imageUrl) {
  if (!imageUrl) return 'unknown';
  const url = imageUrl.toUpperCase();
  
  if (url.includes('-FACE-') || url.includes('-FACE.') || url.includes('/FACE')) {
    return 'face';
  }
  if (url.includes('-A1-') || url.includes('-A1.') || 
      url.includes('-A2-') || url.includes('-A2.') ||
      url.includes('/A1') || url.includes('/A2')) {
    return 'angled';
  }
  return 'unknown';
}

async function main() {
  const filePath = path.join(__dirname, '..', 'src', 'techfeed', 'wheels_by_sku.json.gz');
  
  console.log('Loading techfeed wheels...');
  const buf = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(json);
  
  const wheels = Object.values(data.bySku);
  
  // Collect unknown image URL patterns
  const unknownPatterns = new Map(); // pattern -> count
  const unknownSamples = []; // first 20 full URLs
  
  for (const wheel of wheels) {
    const images = wheel.images || [];
    for (const img of images) {
      const type = detectImageType(img);
      if (type === 'unknown') {
        // Extract a pattern from the URL
        const url = img.toLowerCase();
        
        // Try to extract the file suffix pattern
        const match = url.match(/[-_]([a-z0-9]+)[-_.](?:png|jpg|jpeg|webp)/i);
        const pattern = match ? match[1] : 'other';
        
        unknownPatterns.set(pattern, (unknownPatterns.get(pattern) || 0) + 1);
        
        if (unknownSamples.length < 30) {
          unknownSamples.push({
            sku: wheel.sku,
            brand: wheel.brand_desc,
            url: img
          });
        }
      }
    }
  }
  
  // Sort patterns by frequency
  const sorted = [...unknownPatterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           UNKNOWN IMAGE URL PATTERNS                      ');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('TOP PATTERNS (extracted suffix before extension)');
  console.log('─────────────────────────────────────────────────────────');
  for (const [pattern, count] of sorted) {
    console.log(`${pattern.padEnd(20)} : ${count.toLocaleString()}`);
  }
  
  console.log('\n\nSAMPLE UNKNOWN URLS');
  console.log('─────────────────────────────────────────────────────────');
  for (const sample of unknownSamples.slice(0, 15)) {
    console.log(`[${sample.brand}] ${sample.sku}`);
    console.log(`  ${sample.url}`);
    console.log('');
  }
}

main().catch(console.error);
