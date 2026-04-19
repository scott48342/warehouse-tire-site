/**
 * Check TechGuide CSV for images for our target brands
 */
import { readFileSync } from 'fs';

const csv = readFileSync('data/Accessory_TechGuide.csv', 'utf-8');
const lines = csv.split('\n').slice(1); // Skip header

const brandCounts = {};
const brandImages = {};

for (const line of lines) {
  if (!line.trim()) continue;
  
  // Parse CSV (simple - assumes no quoted commas in our data)
  const parts = line.split(',');
  const sku = parts[0];
  const brand = parts[5]; // brand_desc
  const imageUrl = parts[8]; // image_url
  
  if (!brandCounts[brand]) {
    brandCounts[brand] = { total: 0, withImage: 0 };
  }
  brandCounts[brand].total++;
  
  if (imageUrl && imageUrl.startsWith('http')) {
    brandCounts[brand].withImage++;
    if (!brandImages[brand]) brandImages[brand] = [];
    if (brandImages[brand].length < 3) {
      brandImages[brand].push({ sku, imageUrl });
    }
  }
}

// Print target brands
const targets = ['Morimoto', 'Gorilla', 'GTR', 'Teraflex', 'Fox', 'Bilstein'];

console.log('=== Target Brand Image Coverage in TechGuide ===\n');

for (const [brand, counts] of Object.entries(brandCounts).sort((a, b) => b[1].total - a[1].total)) {
  const isTarget = targets.some(t => brand?.toLowerCase().includes(t.toLowerCase()));
  if (isTarget || counts.total > 500) {
    const pct = ((counts.withImage / counts.total) * 100).toFixed(1);
    console.log(`${brand}: ${counts.withImage}/${counts.total} have images (${pct}%)`);
    
    if (brandImages[brand]) {
      brandImages[brand].forEach(img => {
        console.log(`  Sample: ${img.sku} -> ${img.imageUrl}`);
      });
    }
    console.log('');
  }
}
