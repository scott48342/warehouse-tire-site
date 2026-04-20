/**
 * KMC Canto Gallery Batch Extractor
 * Connects to existing Chrome CDP session and extracts all vehicle album images
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDP_URL = 'http://127.0.0.1:18800';
const OUTPUT_FILE = path.join(__dirname, 'extracted', 'kmc-full.json');
const FOLDER_URL = 'https://wheelpros.canto.com/v/WheelPros/folder/M6QU7';

// Albums to extract (from tree view)
const VEHICLE_ALBUMS = [
  "ARCHER 2024 CHEVROLET COLORADO",
  "ARCHER 2025 TOYOTA TACOMA_BLACK",
  "ARCHER 2025 TOYOTA TACOMA_BRONZE",
  "KM235 2022 Jeep Wrangler",
  "KM235 Ford F150",
  "KM235 Jeep",
  "KM235 Jeep Gladiator",
  "KM235 Jeep Wrangler",
  "KM236  Toyota Tacoma",
  "KM236 Candy Red Jeep Gladiator",
  "KM236 Jeep Gladiator",
  "KM236 Lexus GX460",
  "KM237 GMC Sierra",
  "KM237 Toyota 4Runner",
  "KM237 Toyota Tacoma",
  "KM238 Ford Bronco",
  "KM238 Jeep Wrangler",
  "KM238 Jeep Wrangler (2)",
  "KM239 2024 Ford Bronco",
  "KM239 2024 Jeep Gladiator",
  "KM239 FORD RANGER TROPHY TRUCK",
  "KM444 1975 FORD BRONCO",
  "KM444 1992 Ford Bronco",
  "KM444 2024 Toyota Tundra",
  "KM445 FORD F150 RAPTOR",
  "KM445 Ford Ranger",
  "KM445 Ford Trophy Truck",
  "KM446 Ford Bronco",
  "KM446 Ford F150_Rig'd",
  "KM446 Ford Ranger",
  "KM446 RAM TRX",
  "KM447 2022 Ford Bronco",
  "KM447 2022 Ford F150 Raptor",
  "KM447 2024 FORD F150",
  "KM447 2024 Toyota Sequoia",
  "KM450 JEEP WRANGLER RUBICON",
  "KM451 2024 Lexus GX550",
  "KM451 Ford F250",
  "KM451 Ram 2500 Power Wagon",
  "KM452 2023 Ford F250",
  "KM541 Ford F250",
  "KM541 Jeep",
  "KM541 Jeep Gladiator",
  "KM541 Jeep Rubicon",
  "KM542 GMC Denali",
  "KM542 Jeep Gladiator",
  "KM542 Toyota RAV4",
  "KM544 Ford Raptor",
  "KM544 Ford Raptor_2",
  "KM544 Toyota Tundra",
  "KM545 Tacoma_FJ",
  "KM545 Toyota RAV4",
  "KM547 Chevrolet Colorado",
  "KM547 Jeep",
  "KM548 Ford F250",
  "KM548 Toyota 4Runner",
  "KM549 Dodge Ram",
  "KM549 Ford F150",
  "KM549 Ford Raptor",
  "KM549 Jeep Wrangler",
  "KM549 Toyota Tacoma",
  "KM550 JEEP GLADIATOR",
  "KM550 TOYOTA 4RUNNER",
  "KM550 TOYOTA TUNDRA",
  "KM551 Ford Bronco",
  "KM551 Jeep Gladiator",
  "KM552 2022 Ford Bronco",
  "KM552 2022 Ford Bronco V2",
  "KM552 2023 Ford F250",
  "KM552 2025 Ford F150 Raptor R",
  "KM552 Chevrolet Silverado",
  "KM552 Ford Ranger Raptor",
  "KM552 TOYOTA TACOMA",
  "KM552 Toyota Tundra",
  "KM553 2025 Ford F150 Raptor",
  "KM553 2025 TOYOTA 4RUNNER",
  "KM553 2025 Toyota Land Cruiser",
  "KM553 2025 Toyota Tundra",
  "KM553 Lexus GX550",
  "KM554 Jeep Gladiator",
  "KM554 Toyota Tundra",
  "KM555 2025 FORD F150 RAPTOR R",
  "KM555 2025 TOYOTA TACOMA",
  "KM556 CRUX FORD F150 RAPTOR",
  "KM556 CRUX JEEP WRANGLER",
  "KM556 FORD F150 RAPTOR",
  "KM708 Mazda CUV",
  "KM708 Nissan Rogue",
  "KM716 Toyota RAV4",
  "KM717 Lexus GX470",
  "KM717 Suzuki Jimny",
  "KM717 Toyota 4Runner",
  "KM718 Ford Raptor",
  "KM718 Toyota Tacoma",
  "KM719 2025 Toyota 4Runner",
  "KM722 Jeep",
  "KM722 Lexus GX460",
  "KM722 Toyota 4Runner",
  "KM723 Toyota Tacoma",
  "KM724 Ford Bronco",
  "KM725 Toyota Tacoma",
  "KM727 Ford F150",
  "KM727 Jeep Gladiator",
  "KM728 Ford Bronco",
  "KM728 Lexus GX470",
  "KM728 Toyota Tacoma",
  "KM729 Range Ford F150 Raptor",
  "KM729 Range Jeep Wrangler",
  "KM729 Range Lexus GX470",
  "KM729 Range Toyota 4Runner",
  "KM730 Ford Ranger Raptor",
  "KM730 Jeep Gladiator",
  "KM730 Lexus GX460",
  "KM733 2010 FORD F150 RAPTOR",
  "KM733 GMC SIERRA AT4X",
  "KM733 TOYOTA TUNDRA",
  "Mesa Forged Ford Bronco"
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadExistingData() {
  try {
    const content = await fs.readFile(OUTPUT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return {
      brand: 'KMC',
      extractedAt: new Date().toISOString(),
      albums: [],
      totalAlbums: 0,
      totalImages: 0
    };
  }
}

async function saveData(data) {
  data.totalAlbums = data.albums.length;
  data.totalImages = data.albums.reduce((sum, a) => sum + a.imageCount, 0);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

async function extractAlbumImages(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const codeMatch = url.match(/album\/([A-Z0-9]+)/i);
    const code = codeMatch ? codeMatch[1] : null;
    
    // Get all thumbnail images
    const imgs = Array.from(document.querySelectorAll('ul li img'))
      .filter(img => img.src && img.src.includes('cloudfront'))
      .map(img => {
        // Convert thumbnail URL to 800px version
        let imgUrl = img.src;
        imgUrl = imgUrl.replace(/\.(240|480|320)\./, '.800.');
        imgUrl = imgUrl.split('?')[0]; // Remove query params
        if (!imgUrl.endsWith('.jpg')) imgUrl += '.jpg';
        return {
          url: imgUrl,
          alt: img.alt || ''
        };
      });
    
    // Dedupe by URL
    const unique = [...new Map(imgs.map(i => [i.url, i])).values()];
    return { code, images: unique, imageCount: unique.length };
  });
}

async function clickAlbumInTree(page, albumName) {
  return await page.evaluate((name) => {
    const treeItems = document.querySelectorAll('[role="treeitem"]');
    for (const item of treeItems) {
      const label = item.getAttribute('aria-label') || '';
      if (label.includes('album') && label.includes(name)) {
        const clickable = item.querySelector('[cursor="pointer"]') || item;
        clickable.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true, cancelable: true, view: window
        }));
        return true;
      }
      // Also check text content
      const textContent = item.textContent || '';
      if (textContent.includes(name) && label.includes('album')) {
        const clickable = item.querySelector('[cursor="pointer"]') || item;
        clickable.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true, cancelable: true, view: window
        }));
        return true;
      }
    }
    return false;
  }, albumName);
}

async function main() {
  console.log('🚀 KMC Canto Gallery Batch Extractor');
  console.log(`📋 Processing ${VEHICLE_ALBUMS.length} albums\n`);
  
  // Connect to existing browser
  const browser = await puppeteer.connect({
    browserURL: CDP_URL,
    defaultViewport: null
  });
  
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('canto.com')) || pages[0];
  
  console.log(`📄 Connected to: ${page.url()}`);
  
  // Load existing data
  const data = await loadExistingData();
  const extractedNames = new Set(data.albums.map(a => a.name));
  console.log(`📖 Already extracted: ${data.albums.length} albums\n`);
  
  // Navigate to folder
  await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const albumName of VEHICLE_ALBUMS) {
    if (extractedNames.has(albumName)) {
      console.log(`⏭️  [${skipped + processed + 1}/${VEHICLE_ALBUMS.length}] Skipping: ${albumName}`);
      skipped++;
      continue;
    }
    
    try {
      // Make sure we're on the folder page
      if (!page.url().includes('folder/M6QU7')) {
        await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);
      }
      
      // Click on the album
      const clicked = await clickAlbumInTree(page, albumName);
      if (!clicked) {
        console.log(`⚠️  Could not find album: ${albumName}`);
        errors++;
        continue;
      }
      
      // Wait for album to load
      await sleep(3000);
      
      // Wait for images to appear
      try {
        await page.waitForSelector('ul li img[src*="cloudfront"]', { timeout: 10000 });
      } catch (e) {
        console.log(`⚠️  No images found for: ${albumName}`);
      }
      
      // Extract images
      const albumData = await extractAlbumImages(page);
      
      if (albumData.code) {
        data.albums.push({
          name: albumName,
          code: albumData.code,
          imageCount: albumData.imageCount,
          images: albumData.images
        });
        extractedNames.add(albumName);
        
        // Save progress
        await saveData(data);
        
        console.log(`✅ [${data.albums.length}/${VEHICLE_ALBUMS.length}] ${albumName}: ${albumData.imageCount} images (${albumData.code})`);
        processed++;
      } else {
        console.log(`⚠️  No album code found for: ${albumName}`);
        errors++;
      }
      
      // Go back to folder
      await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1500);
      
    } catch (err) {
      console.error(`❌ Error processing ${albumName}:`, err.message);
      errors++;
      
      // Try to recover
      try {
        await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);
      } catch (e) {
        console.error('Failed to recover, continuing...');
      }
    }
    
    // Progress every 10
    if ((processed + skipped) % 10 === 0 && processed + skipped > 0) {
      console.log(`\n📊 Progress: ${processed} new, ${skipped} skipped, ${errors} errors\n`);
    }
  }
  
  console.log('\n✨ Extraction complete!');
  console.log(`   Total albums: ${data.albums.length}`);
  console.log(`   Total images: ${data.totalImages}`);
  console.log(`   New this run: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  
  // Don't disconnect - leave browser open for user
  // await browser.disconnect();
}

main().catch(console.error);
