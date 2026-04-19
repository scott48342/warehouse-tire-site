/**
 * Test fetching a Morimoto product page
 */

const url = 'https://www.morimotohid.com/Morimoto-2Banger-LED-Ditch-Light-System-Silverado-HD-2020_2';

async function main() {
  console.log(`Fetching: ${url}\n`);
  
  const resp = await fetch(url);
  const html = await resp.text();
  
  console.log(`Response status: ${resp.status}`);
  console.log(`HTML length: ${html.length}\n`);
  
  // Find image URLs in full HTML
  const allImageUrls = html.match(/https?:\/\/[^\s"'<>]+\.(jpg|png|webp)/gi) || [];
  console.log(`All image URLs found: ${allImageUrls.length}`);
  
  // Filter to product images
  const productImages = allImageUrls.filter(u => u.includes('Item') || u.includes('morimoto'));
  console.log(`Product image URLs: ${productImages.length}`);
  productImages.slice(0, 15).forEach(url => console.log(`  ${url}`));
  
  // Check for data layers / JSON
  const jsonMatches = html.match(/\{[^{}]*"itemid"[^{}]*\}/gi) || [];
  console.log(`\nJSON with itemid: ${jsonMatches.length}`);
  
  // Look for SKU patterns
  const skuMatches = html.match(/BAF\d+/g) || [];
  console.log(`\nSKU patterns found: ${[...new Set(skuMatches)].join(', ')}`);
}

main().catch(console.error);
