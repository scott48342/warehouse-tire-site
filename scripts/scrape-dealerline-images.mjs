/**
 * Scrape Accessory Images from WheelPros DealerLine
 * 
 * Extracts media.wheelpros.com image URLs from the dealer portal
 * and updates our database.
 * 
 * Usage:
 *   1. Run in browser console on dl.wheelpros.com (logged in)
 *   2. Or use with Puppeteer/Playwright
 * 
 * Browser Console Usage:
 *   - Navigate to: https://dl.wheelpros.com/us_en/ymm/search/?api-type=accessories&pageSize=100
 *   - Paste this script in console
 *   - Call: await scrapeAndDownload()
 */

// This script is designed to run in browser console
const SCRAPER_CODE = `
(async function scrapeAllProducts() {
  const allProducts = [];
  const categories = [
    { name: 'lugnuts', url: 'https://dl.wheelpros.com/us_en/ymm/search/?api-type=lugnuts&pageSize=100&inventorylocations=AL&clearYmm=true' },
    { name: 'accessories', url: 'https://dl.wheelpros.com/us_en/ymm/search/?api-type=accessories&pageSize=100&inventorylocations=AL&clearYmm=true' },
  ];
  
  function extractFromPage() {
    const products = [];
    document.querySelectorAll('li').forEach(li => {
      const html = li.innerHTML;
      const skuMatch = html.match(/SKU:\\s*([A-Z0-9\\-]+)/i);
      if (!skuMatch) return;
      
      const sku = skuMatch[1];
      const titleEl = li.querySelector('strong a');
      const title = titleEl?.textContent?.trim() || '';
      
      // Find media.wheelpros.com or dl.wheelpros.com/media image URLs
      let imageUrl = null;
      li.querySelectorAll('img').forEach(img => {
        if (img.src.includes('media.wheelpros.com/asset/')) {
          imageUrl = img.src;
        } else if (img.src.includes('dl.wheelpros.com/media/catalog/product') && 
                   !img.src.includes('new_product') && !img.src.includes('gif')) {
          imageUrl = img.src;
        }
      });
      
      if (imageUrl) {
        products.push({ sku, title, imageUrl });
      }
    });
    return products;
  }
  
  async function scrapeCategoryPages(startUrl, categoryName) {
    const products = [];
    let page = 1;
    const maxPages = 20;
    
    // Navigate to first page
    window.location.href = startUrl;
    await new Promise(r => setTimeout(r, 3000));
    
    while (page <= maxPages) {
      console.log(\`[\${categoryName}] Scraping page \${page}...\`);
      
      const pageProducts = extractFromPage();
      console.log(\`  Found \${pageProducts.length} products with images\`);
      products.push(...pageProducts);
      
      // Check for next page
      const nextLink = document.querySelector('a[title="Next"], a.action.next');
      if (nextLink && pageProducts.length > 0) {
        nextLink.click();
        await new Promise(r => setTimeout(r, 2500));
        page++;
      } else {
        break;
      }
    }
    
    return products;
  }
  
  // Scrape all categories
  for (const cat of categories) {
    try {
      const products = await scrapeCategoryPages(cat.url, cat.name);
      allProducts.push(...products);
    } catch (err) {
      console.error(\`Error scraping \${cat.name}:\`, err);
    }
  }
  
  // Dedupe by SKU
  const uniqueProducts = [];
  const seenSkus = new Set();
  for (const p of allProducts) {
    if (!seenSkus.has(p.sku)) {
      seenSkus.add(p.sku);
      uniqueProducts.push(p);
    }
  }
  
  console.log(\`Total unique products with images: \${uniqueProducts.length}\`);
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(uniqueProducts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dealerline-images.json';
  a.click();
  
  return uniqueProducts;
})();
`;

console.log('='.repeat(60));
console.log('DealerLine Image Scraper');
console.log('='.repeat(60));
console.log('');
console.log('To scrape images from the dealer portal:');
console.log('');
console.log('1. Open Chrome and login to https://dl.wheelpros.com');
console.log('2. Navigate to any accessories page');
console.log('3. Open Developer Tools (F12) > Console');
console.log('4. Paste the following code and press Enter:');
console.log('');
console.log('-'.repeat(60));
console.log(SCRAPER_CODE);
console.log('-'.repeat(60));
console.log('');
console.log('The script will:');
console.log('- Scrape through lugnuts and accessories pages');
console.log('- Extract media.wheelpros.com image URLs');
console.log('- Download a JSON file with SKU -> imageUrl mappings');
console.log('');
console.log('After downloading, run:');
console.log('  node scripts/import-dealerline-images.mjs dealerline-images.json');
