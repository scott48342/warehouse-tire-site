/**
 * Canto Gallery Batch Extractor
 * Connects to existing Chrome session and extracts vehicle gallery images
 * Usage: node canto-extractor.mjs --brand=KMC --folder=M6QU7
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDP_URL = 'http://127.0.0.1:18800';

// Brand folder mappings
const BRAND_FOLDERS = {
  'KMC': 'M6QU7',
  // Add more brands here
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractAlbumData(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const codeMatch = url.match(/album\/([A-Z0-9]+)/i);
    const code = codeMatch ? codeMatch[1] : null;
    
    // Get all images from the gallery
    const imgs = Array.from(document.querySelectorAll('ul li img'))
      .filter(img => img.src.includes('cloudfront'))
      .map(img => ({
        url: img.src.replace(/\.\d+\.jpg/, '.800.jpg').split('?')[0] + '.jpg',
        alt: img.alt || ''
      }));
    
    return { code, images: imgs, imageCount: imgs.length };
  });
}

async function getAlbumList(page) {
  // Get all album tree items within the Vehicles folder
  return await page.evaluate(() => {
    const albums = [];
    // Find all album tree items (they have the album icon)
    const treeItems = document.querySelectorAll('[role="treeitem"]');
    
    for (const item of treeItems) {
      const text = item.textContent?.trim();
      // Check if it's an album (has the album indicator text/icon)
      if (text && !text.includes('folder') && item.getAttribute('aria-label')?.includes('album')) {
        const name = item.querySelector('[class*="name"]')?.textContent?.trim() || 
                     item.textContent?.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
        if (name && name.length > 2) {
          albums.push({ name, element: item });
        }
      }
    }
    return albums.map(a => a.name);
  });
}

async function clickAlbumByName(page, albumName) {
  return await page.evaluate((name) => {
    const treeItems = document.querySelectorAll('[role="treeitem"]');
    for (const item of treeItems) {
      const itemText = item.textContent || '';
      if (itemText.includes(name)) {
        const clickTarget = item.querySelector('[cursor="pointer"]') || item;
        if (clickTarget) {
          // Double-click to navigate
          const event = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          clickTarget.dispatchEvent(event);
          return true;
        }
      }
    }
    return false;
  }, albumName);
}

async function extractBrand(brand, folderCode) {
  console.log(`\n🚀 Starting extraction for ${brand} (folder: ${folderCode})`);
  
  // Connect to existing browser
  const browser = await puppeteer.connect({
    browserURL: CDP_URL,
    defaultViewport: null
  });
  
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('canto.com')) || pages[0];
  
  if (!page) {
    console.error('No Canto page found!');
    return;
  }
  
  console.log(`📄 Connected to page: ${page.url()}`);
  
  // Navigate to the brand's Vehicles folder
  const folderUrl = `https://wheelpros.canto.com/v/WheelPros/folder/${folderCode}`;
  console.log(`📂 Navigating to: ${folderUrl}`);
  await page.goto(folderUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  
  // Load existing data or create new
  const outputPath = path.join(__dirname, 'extracted', `${brand.toLowerCase()}-full.json`);
  let data = {
    brand,
    extractedAt: new Date().toISOString(),
    albums: [],
    totalAlbums: 0,
    totalImages: 0
  };
  
  try {
    const existing = await fs.readFile(outputPath, 'utf-8');
    data = JSON.parse(existing);
    console.log(`📖 Loaded existing data: ${data.albums.length} albums already extracted`);
  } catch (e) {
    console.log('📝 Starting fresh extraction');
  }
  
  const extractedCodes = new Set(data.albums.map(a => a.code));
  
  // Get list of all albums visible in the tree
  // We'll iterate through the list items in the main content area
  const albumItems = await page.$$eval('ul[role="list"] li, .content-list li', items => 
    items.map(li => {
      const text = li.textContent?.trim() || '';
      // Extract album name from the item
      const nameMatch = text.match(/^([A-Z0-9_\s\-()]+)/i);
      return nameMatch ? nameMatch[1].trim() : null;
    }).filter(Boolean)
  );
  
  console.log(`📋 Found ${albumItems.length} albums to process`);
  
  // Process each album by clicking on it
  let processed = 0;
  let skipped = 0;
  
  for (let i = 0; i < albumItems.length; i++) {
    const albumName = albumItems[i];
    
    // Click on the album in the list
    const clicked = await page.evaluate((index) => {
      const items = document.querySelectorAll('ul li[cursor="pointer"], .masonry-item, [role="listitem"]');
      if (items[index]) {
        const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
        items[index].dispatchEvent(event);
        return true;
      }
      return false;
    }, i);
    
    if (!clicked) {
      console.log(`⚠️  Could not click album at index ${i}`);
      continue;
    }
    
    // Wait for navigation
    await sleep(3000);
    
    // Extract album data
    const albumData = await extractAlbumData(page);
    
    if (albumData.code && !extractedCodes.has(albumData.code)) {
      data.albums.push({
        name: albumName,
        code: albumData.code,
        imageCount: albumData.imageCount,
        images: albumData.images
      });
      extractedCodes.add(albumData.code);
      data.totalImages += albumData.imageCount;
      data.totalAlbums = data.albums.length;
      
      // Save progress
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      console.log(`✅ [${data.albums.length}/${albumItems.length}] ${albumName}: ${albumData.imageCount} images (code: ${albumData.code})`);
      processed++;
    } else if (extractedCodes.has(albumData.code)) {
      console.log(`⏭️  Skipping ${albumName} (already extracted)`);
      skipped++;
    }
    
    // Go back to folder view
    await page.goBack({ waitUntil: 'networkidle2' });
    await sleep(2000);
    
    // Progress update every 10 albums
    if ((processed + skipped) % 10 === 0) {
      console.log(`\n📊 Progress: ${processed} extracted, ${skipped} skipped, ${albumItems.length - processed - skipped} remaining\n`);
    }
  }
  
  console.log(`\n✨ ${brand} extraction complete!`);
  console.log(`   Albums: ${data.totalAlbums}`);
  console.log(`   Images: ${data.totalImages}`);
  console.log(`   Output: ${outputPath}`);
  
  return data;
}

// Main
const args = process.argv.slice(2);
const brandArg = args.find(a => a.startsWith('--brand='));
const brand = brandArg ? brandArg.split('=')[1].toUpperCase() : 'KMC';
const folderCode = BRAND_FOLDERS[brand];

if (!folderCode) {
  console.error(`Unknown brand: ${brand}`);
  console.log('Available brands:', Object.keys(BRAND_FOLDERS).join(', '));
  process.exit(1);
}

extractBrand(brand, folderCode).catch(console.error);
