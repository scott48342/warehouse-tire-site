/**
 * Canto Browser Automation Extractor
 * Uses Puppeteer to navigate Canto portal and extract album data
 * 
 * Run with: node scripts/gallery/canto-browser-extractor.mjs
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CANTO_BASE = 'https://wheelpros.canto.com/v/WheelPros';

// Brand folder codes discovered through manual exploration
const BRANDS_TO_EXTRACT = [
  { name: 'KMC', folderCode: 'N68AG', vehiclesPath: 'KMC > Vehicles' },
  { name: 'XD', folderCode: null, vehiclesPath: 'XD > Vehicles' },
  { name: 'MOTO METAL', folderCode: null, vehiclesPath: 'MOTO METAL > Vehicles' },
  { name: 'BLACK RHINO', folderCode: null, vehiclesPath: 'BLACK RHINO > Vehicles' },
  { name: 'ASANTI', folderCode: null, vehiclesPath: 'ASANTI > Vehicles' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractAlbumData(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const albumMatch = url.match(/album\/([A-Z0-9]+)/i);
    const albumCode = albumMatch ? albumMatch[1] : null;
    
    // Get album name from breadcrumb or title
    const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] span, .path-item');
    const albumName = breadcrumbs.length > 0 
      ? breadcrumbs[breadcrumbs.length - 1]?.textContent?.trim()
      : document.title;
    
    // Get all images
    const listItems = document.querySelectorAll('ul li img');
    const images = Array.from(listItems)
      .map(img => ({
        src: img.src,
        alt: img.alt,
        // Extract higher resolution URL by replacing .240. with larger size
        highRes: img.src.replace('.240.', '.800.')
      }))
      .filter(i => i.src && !i.src.includes('Personimage') && !i.src.includes('logo'));
    
    return {
      albumCode,
      albumName,
      imageCount: images.length,
      images
    };
  });
}

async function navigateToVehicles(page, brandName) {
  console.log(`\n=== Navigating to ${brandName}/Vehicles ===\n`);
  
  // Click the brand folder in tree
  const brandSelector = `[role="treeitem"][aria-label*="folder ${brandName}" i]`;
  await page.waitForSelector(brandSelector, { timeout: 10000 });
  await page.click(brandSelector);
  await sleep(2000);
  
  // Click the Vehicles subfolder
  const vehiclesSelector = `[role="treeitem"][aria-label*="folder Vehicles"]`;
  await page.waitForSelector(vehiclesSelector, { timeout: 10000 });
  await page.click(vehiclesSelector);
  await sleep(2000);
  
  // Get all album items in the tree
  const albumItems = await page.$$eval(
    '[role="treeitem"][aria-label*="album"]',
    items => items.map(item => ({
      label: item.getAttribute('aria-label'),
      text: item.textContent?.trim()
    }))
  );
  
  console.log(`Found ${albumItems.length} albums in ${brandName}/Vehicles`);
  return albumItems;
}

async function extractBrandAlbums(page, brandName, existingAlbums = []) {
  const results = [];
  const skipped = [];
  
  // Get all album tree items under current brand's Vehicles
  const albumElements = await page.$$('[role="treeitem"][aria-label*="album"]');
  console.log(`Processing ${albumElements.length} albums for ${brandName}...`);
  
  for (let i = 0; i < albumElements.length; i++) {
    try {
      // Re-query because DOM may have changed
      const currentAlbums = await page.$$('[role="treeitem"][aria-label*="album"]');
      const albumEl = currentAlbums[i];
      
      if (!albumEl) continue;
      
      const albumLabel = await albumEl.evaluate(el => el.getAttribute('aria-label'));
      const albumText = await albumEl.evaluate(el => el.textContent?.trim());
      
      // Skip non-vehicle albums (like logos, ads, etc.)
      if (albumLabel?.toLowerCase().includes('logo') || 
          albumLabel?.toLowerCase().includes('paid ad') ||
          albumLabel?.toLowerCase().includes('flyer')) {
        console.log(`  Skipping: ${albumText}`);
        continue;
      }
      
      console.log(`  [${i+1}/${albumElements.length}] Processing: ${albumText}`);
      
      // Click the album
      await albumEl.click();
      await sleep(2500);
      
      // Extract album data
      const albumData = await extractAlbumData(page);
      
      if (albumData.albumCode && albumData.images.length > 0) {
        results.push({
          brand: brandName,
          name: albumText || albumData.albumName,
          path: albumData.albumCode,
          assetCount: albumData.imageCount,
          assets: albumData.images.map(img => ({
            url: img.highRes,
            thumbnail: img.src,
            filename: img.alt
          }))
        });
        console.log(`    ✓ Extracted ${albumData.imageCount} images (code: ${albumData.albumCode})`);
      } else {
        skipped.push({ name: albumText, reason: 'No images or code' });
        console.log(`    ✗ Skipped (no images or code)`);
      }
      
      // Brief pause between albums
      await sleep(500);
      
    } catch (err) {
      console.error(`    Error: ${err.message}`);
      skipped.push({ name: `Album ${i}`, reason: err.message });
    }
  }
  
  return { results, skipped };
}

async function main() {
  console.log('Canto Browser Extractor');
  console.log('=======================\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // Show browser for debugging
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to Canto portal
    console.log('Opening Canto portal...');
    await page.goto(CANTO_BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    const allResults = {};
    
    // Process each brand
    for (const brand of BRANDS_TO_EXTRACT) {
      try {
        // Navigate back to root if needed
        await page.goto(CANTO_BASE, { waitUntil: 'networkidle2' });
        await sleep(2000);
        
        // Navigate to brand's Vehicles folder
        await navigateToVehicles(page, brand.name);
        
        // Extract all albums
        const { results, skipped } = await extractBrandAlbums(page, brand.name);
        
        allResults[brand.name] = {
          albumCount: results.length,
          totalAssets: results.reduce((sum, r) => sum + r.assetCount, 0),
          albums: results,
          skipped
        };
        
        console.log(`\n${brand.name}: ${results.length} albums, ${allResults[brand.name].totalAssets} assets`);
        
      } catch (err) {
        console.error(`Error processing ${brand.name}: ${err.message}`);
        allResults[brand.name] = { error: err.message, albums: [] };
      }
    }
    
    // Save results
    const outputPath = path.join(process.cwd(), 'scripts/gallery/extracted-albums.json');
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    for (const [brand, data] of Object.entries(allResults)) {
      if (data.error) {
        console.log(`${brand}: ERROR - ${data.error}`);
      } else {
        console.log(`${brand}: ${data.albumCount} albums, ${data.totalAssets} assets`);
      }
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
