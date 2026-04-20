/**
 * Extract Canto albums via Chrome DevTools Protocol
 * Connects to existing browser session and extracts albums
 * 
 * Usage: node extract-via-cdp.mjs <cdp-port> <brand>
 * Example: node extract-via-cdp.mjs 18800 KMC
 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';

const CDP_PORT = parseInt(process.argv[2]) || 18800;
const BRAND = process.argv[3] || 'KMC';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function extractAlbumsFromPage(Runtime) {
  const { result } = await Runtime.evaluate({
    expression: `
      (() => {
        const url = window.location.href;
        const albumMatch = url.match(/album\\/([A-Z0-9]+)/i);
        const albumCode = albumMatch ? albumMatch[1] : null;
        
        // Get album name from breadcrumb
        const pathItems = document.querySelectorAll('[class*="path"]');
        let albumName = '';
        pathItems.forEach(p => {
          const text = p.textContent?.trim();
          if (text && !text.includes('/')) albumName = text;
        });
        
        // Get all thumbnail images
        const listItems = document.querySelectorAll('ul li img');
        const images = Array.from(listItems)
          .map(img => ({
            src: img.src,
            alt: img.alt,
            highRes: img.src.replace('.240.', '.800.')
          }))
          .filter(i => i.src && !i.src.includes('Personimage') && !i.src.includes('logo') && i.src.includes('cloudfront'));
        
        return JSON.stringify({
          albumCode,
          albumName,
          imageCount: images.length,
          images: images.slice(0, 50) // Limit to 50 per album
        });
      })()
    `,
    returnByValue: true
  });
  
  return JSON.parse(result.value);
}

async function getTreeItems(Runtime) {
  const { result } = await Runtime.evaluate({
    expression: `
      (() => {
        const items = document.querySelectorAll('[role="treeitem"][aria-label*="album"]');
        return JSON.stringify(Array.from(items).map((el, idx) => ({
          index: idx,
          label: el.getAttribute('aria-label'),
          text: el.textContent?.trim()
        })));
      })()
    `,
    returnByValue: true
  });
  
  return JSON.parse(result.value);
}

async function clickTreeItem(Runtime, index) {
  await Runtime.evaluate({
    expression: `
      (() => {
        const items = document.querySelectorAll('[role="treeitem"][aria-label*="album"]');
        if (items[${index}]) {
          items[${index}].click();
          return true;
        }
        return false;
      })()
    `,
    returnByValue: true
  });
}

async function main() {
  console.log(\`Connecting to CDP on port \${CDP_PORT}...\`);
  
  let client;
  try {
    client = await CDP({ port: CDP_PORT });
  } catch (err) {
    console.error('Failed to connect to CDP. Make sure browser is running with remote debugging.');
    console.error('Error:', err.message);
    process.exit(1);
  }
  
  const { Runtime, Page } = client;
  
  try {
    console.log('Connected! Extracting albums for', BRAND);
    
    // Get all album items
    const albums = await getTreeItems(Runtime);
    console.log(\`Found \${albums.length} album items in tree\`);
    
    const results = [];
    
    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
      
      // Skip non-vehicle albums
      if (album.label?.toLowerCase().includes('logo') ||
          album.label?.toLowerCase().includes('paid') ||
          album.label?.toLowerCase().includes('flyer')) {
        console.log(\`  [\${i+1}/\${albums.length}] Skipping: \${album.text}\`);
        continue;
      }
      
      console.log(\`  [\${i+1}/\${albums.length}] Processing: \${album.text}\`);
      
      // Click the album
      await clickTreeItem(Runtime, i);
      await sleep(2500);
      
      // Extract data
      const data = await extractAlbumsFromPage(Runtime);
      
      if (data.albumCode && data.images.length > 0) {
        results.push({
          brand: BRAND,
          name: album.text || data.albumName,
          path: data.albumCode,
          assetCount: data.imageCount,
          assets: data.images.map(img => ({
            url: img.highRes,
            thumbnail: img.src,
            filename: img.alt
          }))
        });
        console.log(\`    ✓ \${data.imageCount} images (code: \${data.albumCode})\`);
      } else {
        console.log(\`    ✗ No images or code\`);
      }
      
      await sleep(300);
    }
    
    // Save results
    const outputPath = \`./scripts/gallery/\${BRAND.toLowerCase()}-albums-extracted.json\`;
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(\`\\nSaved \${results.length} albums to \${outputPath}\`);
    console.log(\`Total assets: \${results.reduce((sum, r) => sum + r.assetCount, 0)}\`);
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
