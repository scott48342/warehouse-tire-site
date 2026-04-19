/**
 * Explore Morimoto website structure to understand image URL patterns
 */

// Fetch a product page and find image URLs
async function fetchPage(url) {
  console.log(`\nFetching: ${url}`);
  const resp = await fetch(url);
  const html = await resp.text();
  
  // Find all image URLs in the page
  const imageMatches = html.matchAll(/https:\/\/www\.morimotohid\.com\/images\/[^"'\s>]+\.(jpg|png|webp)/gi);
  const images = [...new Set([...imageMatches].map(m => m[0]))];
  
  console.log(`\nFound ${images.length} unique images:`);
  images.slice(0, 10).forEach(img => console.log(`  ${img}`));
  
  // Look for main product image pattern
  const mainImage = html.match(/\/images\/Item%20Images\/(\d+)\.\d+\.jpg/);
  if (mainImage) {
    console.log(`\nMain image pattern found: ${mainImage[0]}`);
    console.log(`Item ID: ${mainImage[1]}`);
  }
  
  // Look for JSON product data
  const jsonMatch = html.match(/itemData\s*=\s*({[^;]+});/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      console.log('\nProduct JSON data found:');
      console.log(JSON.stringify(data, null, 2).slice(0, 1000));
    } catch (e) {}
  }
  
  // Look for SKU pattern
  const skuMatch = html.match(/SKU[:\s]+([A-Z0-9.-]+)/i);
  if (skuMatch) {
    console.log(`\nSKU found: ${skuMatch[1]}`);
  }
  
  return html;
}

// Test different product types
const urls = [
  'https://www.morimotohid.com/2020_Silverado_HD_Chevrolet_XB_LED_Morimoto',
  'https://www.morimotohid.com/morimoto-chevrolet-silverado-07-13-xb-led-headlights',
  'https://www.morimotohid.com/2banger-led-pod-lights'
];

for (const url of urls) {
  try {
    await fetchPage(url);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  console.log('\n---\n');
}
