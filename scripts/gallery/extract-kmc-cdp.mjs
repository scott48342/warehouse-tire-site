/**
 * KMC Canto Gallery Extractor using CDP
 * Connects to existing browser and extracts vehicle gallery images
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDP_URL = 'http://127.0.0.1:18800';
const OUTPUT_FILE = path.join(__dirname, 'extracted', 'kmc-full.json');
const FOLDER_URL = 'https://wheelpros.canto.com/v/WheelPros/folder/M6QU7';

// Map of album names to tree refs (from snapshot)
const ALBUM_REFS = {
  "ARCHER 2024 CHEVROLET COLORADO": "e43",
  "ARCHER 2025 TOYOTA TACOMA_BLACK": "e44",
  "ARCHER 2025 TOYOTA TACOMA_BRONZE": "e45",
  "KM235 2022 Jeep Wrangler": "e46",
  "KM235 Ford F150": "e47",
  "KM235 Jeep": "e48",
  "KM235 Jeep Gladiator": "e49",
  "KM235 Jeep Wrangler": "e50",
  "KM236  Toyota Tacoma": "e51",
  "KM236 Candy Red Jeep Gladiator": "e52",
  "KM236 Jeep Gladiator": "e53",
  "KM236 Lexus GX460": "e54",
  "KM237 GMC Sierra": "e55",
  "KM237 Toyota 4Runner": "e56",
  "KM237 Toyota Tacoma": "e57",
  "KM238 Ford Bronco": "e58",
  "KM238 Jeep Wrangler": "e59",
  "KM238 Jeep Wrangler (2)": "e60",
  "KM239 2024 Ford Bronco": "e61",
  "KM239 2024 Jeep Gladiator": "e62",
  "KM239 FORD RANGER TROPHY TRUCK": "e63",
  "KM444 1975 FORD BRONCO": "e64",
  "KM444 1992 Ford Bronco": "e65",
  "KM444 2024 Toyota Tundra": "e66",
  "KM445 FORD F150 RAPTOR": "e67",
  "KM445 Ford Ranger": "e68",
  "KM445 Ford Trophy Truck": "e69",
  "KM446 Ford Bronco": "e70",
  "KM446 Ford F150_Rig'd": "e71",
  "KM446 Ford Ranger": "e72",
  "KM446 RAM TRX": "e73",
  "KM447 2022 Ford Bronco": "e74",
  "KM447 2022 Ford F150 Raptor": "e75",
  "KM447 2024 FORD F150": "e76",
  "KM447 2024 Toyota Sequoia": "e77",
  "KM450 JEEP WRANGLER RUBICON": "e78",
  "KM451 2024 Lexus GX550": "e79",
  "KM451 Ford F250": "e80",
  "KM451 Ram 2500 Power Wagon": "e81",
  "KM452 2023 Ford F250": "e82",
  "KM541 Ford F250": "e83",
  "KM541 Jeep": "e84",
  "KM541 Jeep Gladiator": "e85",
  "KM541 Jeep Rubicon": "e86",
  "KM542 GMC Denali": "e87",
  "KM542 Jeep Gladiator": "e88",
  "KM542 Toyota RAV4": "e89",
  "KM544 Ford Raptor": "e90",
  "KM544 Ford Raptor_2": "e91",
  "KM544 Toyota Tundra": "e92",
  "KM545 Tacoma_FJ": "e93",
  "KM545 Toyota RAV4": "e94",
  "KM547 Chevrolet Colorado": "e95",
  "KM547 Jeep": "e96",
  "KM548 Ford F250": "e97",
  "KM548 Toyota 4Runner": "e98",
  "KM549 Dodge Ram": "e99",
  "KM549 Ford F150": "e100",
  "KM549 Ford Raptor": "e101",
  "KM549 Jeep Wrangler": "e102",
  "KM549 Toyota Tacoma": "e103",
  "KM550 JEEP GLADIATOR": "e104",
  "KM550 TOYOTA 4RUNNER": "e105",
  "KM550 TOYOTA TUNDRA": "e106",
  "KM551 Ford Bronco": "e107",
  "KM551 Jeep Gladiator": "e108",
  "KM552 2022 Ford Bronco": "e109",
  "KM552 2022 Ford Bronco V2": "e110",
  "KM552 2023 Ford F250": "e111",
  "KM552 2025 Ford F150 Raptor R": "e112",
  "KM552 Chevrolet Silverado": "e113",
  "KM552 Ford Ranger Raptor": "e114",
  "KM552 TOYOTA TACOMA": "e115",
  "KM552 Toyota Tundra": "e116",
  "KM553 2025 Ford F150 Raptor": "e117",
  "KM553 2025 TOYOTA 4RUNNER": "e118",
  "KM553 2025 Toyota Land Cruiser": "e119",
  "KM553 2025 Toyota Tundra": "e120",
  "KM553 Lexus GX550": "e121",
  "KM554 Jeep Gladiator": "e122",
  "KM554 Toyota Tundra": "e123",
  "KM555 2025 FORD F150 RAPTOR R": "e124",
  "KM555 2025 TOYOTA TACOMA": "e125",
  "KM556 CRUX FORD F150 RAPTOR": "e126",
  "KM556 CRUX JEEP WRANGLER": "e127",
  "KM556 FORD F150 RAPTOR": "e128",
  "KM708 Mazda CUV": "e129",
  "KM708 Nissan Rogue": "e130",
  "KM716 Toyota RAV4": "e131",
  "KM717 Lexus GX470": "e132",
  "KM717 Suzuki Jimny": "e133",
  "KM717 Toyota 4Runner": "e134",
  "KM718 Ford Raptor": "e135",
  "KM718 Toyota Tacoma": "e136",
  "KM719 2025 Toyota 4Runner": "e137",
  "KM722 Jeep": "e138",
  "KM722 Lexus GX460": "e139",
  "KM722 Toyota 4Runner": "e140",
  "KM723 Toyota Tacoma": "e141",
  "KM724 Ford Bronco": "e142",
  "KM725 Toyota Tacoma": "e143",
  "KM727 Ford F150": "e144",
  "KM727 Jeep Gladiator": "e145",
  "KM728 Ford Bronco": "e146",
  "KM728 Lexus GX470": "e147",
  "KM728 Toyota Tacoma": "e148",
  "KM729 Range Ford F150 Raptor": "e149",
  "KM729 Range Jeep Wrangler": "e150",
  "KM729 Range Lexus GX470": "e151",
  "KM729 Range Toyota 4Runner": "e152",
  "KM730 Ford Ranger Raptor": "e153",
  "KM730 Jeep Gladiator": "e154",
  "KM730 Lexus GX460": "e155",
  "KM733 2010 FORD F150 RAPTOR": "e156",
  "KM733 GMC SIERRA AT4X": "e157",
  "KM733 TOYOTA TUNDRA": "e158",
  "Mesa Forged Ford Bronco": "e159"
};

const ALBUM_NAMES = Object.keys(ALBUM_REFS);

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
  data.extractedAt = new Date().toISOString();
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
        let imgUrl = img.src;
        imgUrl = imgUrl.replace(/\.(240|480|320)\./, '.800.');
        imgUrl = imgUrl.split('?')[0]; // Remove query params
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

async function main() {
  console.log('🚀 KMC Canto Gallery Extractor');
  console.log(`📋 Processing ${ALBUM_NAMES.length} albums\n`);
  
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
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const albumName of ALBUM_NAMES) {
    if (extractedNames.has(albumName)) {
      console.log(`⏭️  [${skipped + processed + 1}/${ALBUM_NAMES.length}] Skipping: ${albumName}`);
      skipped++;
      continue;
    }
    
    try {
      // Navigate to folder if needed
      const currentUrl = page.url();
      if (!currentUrl.includes('folder/M6QU7')) {
        await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);
      }
      
      // Find and scroll the album into view, then click
      const clicked = await page.evaluate((name) => {
        const treeItems = document.querySelectorAll('[role="treeitem"]');
        for (const item of treeItems) {
          const label = item.getAttribute('aria-label') || '';
          if (label === 'album ' + name) {
            // Scroll the item into view
            item.scrollIntoView({ block: 'center', behavior: 'instant' });
            return true;
          }
        }
        return false;
      }, albumName);
      
      if (!clicked) {
        console.log(`⚠️  Could not find album: ${albumName}`);
        errors++;
        continue;
      }
      
      // Wait for scroll to complete
      await sleep(200);
      
      // Now get coordinates after scrolling
      const coords = await page.evaluate((name) => {
        const treeItems = document.querySelectorAll('[role="treeitem"]');
        for (const item of treeItems) {
          const label = item.getAttribute('aria-label') || '';
          if (label === 'album ' + name) {
            const bounds = item.getBoundingClientRect();
            return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
          }
        }
        return null;
      }, albumName);
      
      if (!coords || coords.y < 0 || coords.y > 10000) {
        console.log(`⚠️  Album not visible after scroll: ${albumName}`);
        errors++;
        continue;
      }
      
      // Double-click at the coordinates
      await page.mouse.click(coords.x, coords.y, { clickCount: 2 });
      
      // Wait for navigation (URL should change to album/)
      await sleep(3000);
      
      // Check if we're on an album page
      const url = await page.url();
      if (!url.includes('/album/')) {
        console.log(`⚠️  Navigation failed for: ${albumName}`);
        errors++;
        continue;
      }
      
      // Wait for images to load
      try {
        await page.waitForSelector('ul li img[src*="cloudfront"]', { timeout: 8000 });
      } catch (e) {
        // Some albums might have no images visible yet
      }
      
      // Extract images
      const albumData = await extractAlbumImages(page);
      
      if (albumData.code && albumData.imageCount > 0) {
        data.albums.push({
          name: albumName,
          code: albumData.code,
          imageCount: albumData.imageCount,
          images: albumData.images
        });
        extractedNames.add(albumName);
        
        // Save progress
        await saveData(data);
        
        console.log(`✅ [${data.albums.length}/${ALBUM_NAMES.length}] ${albumName}: ${albumData.imageCount} images (${albumData.code})`);
        processed++;
      } else {
        console.log(`⚠️  No images found for: ${albumName} (code: ${albumData.code})`);
        errors++;
      }
      
      // Go back to folder
      await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1000);
      
    } catch (err) {
      console.error(`❌ Error processing ${albumName}:`, err.message);
      errors++;
      
      // Try to recover
      try {
        await page.goto(FOLDER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);
      } catch (e) {
        // Continue anyway
      }
    }
    
    // Progress every 10
    if ((processed + skipped + errors) % 10 === 0 && (processed + skipped + errors) > 0) {
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
}

main().catch(console.error);
