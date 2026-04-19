/**
 * Explore Gorilla Automotive website to understand image patterns
 */

async function fetchPage(url) {
  console.log(`Fetching: ${url}\n`);
  const resp = await fetch(url);
  const html = await resp.text();
  
  console.log(`Status: ${resp.status}, Length: ${html.length}`);
  
  // Find all image URLs
  const imgUrls = html.match(/https?:\/\/[^\s"'<>]+\.(jpg|png|webp)/gi) || [];
  console.log(`\nImage URLs (${imgUrls.length}):`);
  
  // Filter to product images
  const productImgs = imgUrls.filter(u => 
    u.includes('product') || 
    u.includes('media') || 
    u.includes('gorilla') ||
    u.includes('catalog')
  );
  productImgs.slice(0, 10).forEach(u => console.log(`  ${u}`));
  
  // Look for main product image (usually in og:image or product gallery)
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImage) {
    console.log(`\nOG Image: ${ogImage[1]}`);
  }
  
  return html;
}

// Test a specific product
await fetchPage('https://www.gorilla-auto.com/gorilla-automotive-96644dx');
