/**
 * Scrape Accessories from WheelPros DealerLine Portal
 * 
 * This script must be run via browser automation with an authenticated session.
 * Run manually via browser console or puppeteer/playwright.
 * 
 * Usage:
 *   1. Login to dl.wheelpros.com in Chrome
 *   2. Navigate to accessories search page
 *   3. Open browser console and paste this script
 *   4. Run scrapeAllProducts()
 * 
 * Or use the JSON export endpoint approach below.
 */

// Configuration
const CONFIG = {
  baseUrl: 'https://dl.wheelpros.com/us_en/ymm/search/',
  pageSize: 100, // max per page
  categories: [
    { apiType: 'lugnuts', partType: 'Wheel Lug Nut Set' },
    { apiType: 'lugnuts', partType: 'Wheel Lock Kit' },
    { apiType: 'accessories', partType: 'Center Cap' },
    { apiType: 'accessories', partType: 'Hub Ring' },
    // Add more as needed
  ],
};

/**
 * Extract products from current page
 */
function extractProductsFromPage() {
  const products = [];
  
  document.querySelectorAll('li[class*="product"]').forEach(li => {
    try {
      // SKU
      const skuEl = li.querySelector('[class*="sku"]');
      const sku = skuEl?.textContent?.replace('SKU:', '').trim();
      if (!sku) return;
      
      // Title
      const titleEl = li.querySelector('strong a');
      const title = titleEl?.textContent?.trim();
      
      // Brand
      const brandEl = li.querySelector('[class*="brand"]');
      const brand = brandEl?.textContent?.trim();
      
      // Prices
      const priceEls = li.querySelectorAll('[class*="price"]');
      let dealerPrice = null, msrp = null;
      priceEls.forEach(el => {
        const text = el.textContent || '';
        if (text.includes('MSRP')) {
          msrp = parseFloat(text.replace(/[^0-9.]/g, ''));
        } else if (text.includes('$')) {
          dealerPrice = parseFloat(text.replace(/[^0-9.]/g, ''));
        }
      });
      
      // Images - find the best one
      let imageUrl = null;
      li.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.includes('new_product') && !img.src.includes('logo')) {
          if (img.src.includes('media.wheelpros.com') || img.src.includes('catalog/product')) {
            imageUrl = img.src;
          }
        }
      });
      
      // Link to product page
      const linkEl = li.querySelector('a[href*=".html"]');
      const productUrl = linkEl?.href;
      
      products.push({
        sku,
        title,
        brand,
        dealerPrice,
        msrp,
        imageUrl,
        productUrl,
      });
      
    } catch (err) {
      console.error('Error extracting product:', err);
    }
  });
  
  return products;
}

/**
 * Extract filter values from the sidebar
 */
function extractFilters() {
  const filters = {};
  
  // Find all filter sections
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    const name = tab.textContent?.replace('Filter is selected', '').trim();
    if (!name) return;
    
    // Try to find the filter panel content
    const panelId = tab.getAttribute('aria-controls');
    if (panelId) {
      const panel = document.getElementById(panelId);
      if (panel) {
        filters[name] = [];
        panel.querySelectorAll('li, label').forEach(item => {
          const text = item.textContent?.trim();
          if (text) filters[name].push(text);
        });
      }
    }
  });
  
  return filters;
}

/**
 * Get total number of products
 */
function getTotalProducts() {
  const countEl = document.querySelector('[class*="count"], [class*="total"]');
  if (countEl) {
    const match = countEl.textContent?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }
  return 0;
}

/**
 * Main scraper function - call from browser console
 */
async function scrapeAllProducts() {
  const allProducts = [];
  let page = 1;
  let hasMore = true;
  
  console.log('Starting scrape...');
  
  while (hasMore) {
    console.log(`Scraping page ${page}...`);
    
    const products = extractProductsFromPage();
    console.log(`  Found ${products.length} products`);
    
    allProducts.push(...products);
    
    // Check for next page
    const nextLink = document.querySelector('a[class*="next"], a:contains("Next")');
    if (nextLink && products.length > 0) {
      nextLink.click();
      await new Promise(r => setTimeout(r, 2000)); // Wait for page load
      page++;
    } else {
      hasMore = false;
    }
    
    // Safety limit
    if (page > 50) {
      console.log('Reached page limit');
      break;
    }
  }
  
  console.log(`Total products scraped: ${allProducts.length}`);
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(allProducts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dealerline-accessories.json';
  a.click();
  
  return allProducts;
}

// Export for use in browser console
window.scrapeAccessories = {
  extractProductsFromPage,
  extractFilters,
  scrapeAllProducts,
};

console.log('Scraper loaded! Call scrapeAccessories.scrapeAllProducts() to start.');
