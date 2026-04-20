/**
 * Canto Gallery Image Extractor
 * Extracts vehicle gallery images from WheelPros Canto for specified brands
 * 
 * Usage: node extract-canto-images.mjs [brand]
 *   brand: motometal, xd, blackrhino, or all (default)
 * 
 * Requirements:
 * - Browser running with clawd profile at http://127.0.0.1:18800
 * - Already logged into wheelpros.canto.com
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRANDS = {
  'motometal': {
    name: 'Moto Metal',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/L6OF6',
    outputFile: 'extracted/motometal-full.json',
    expectedAlbums: 52
  },
  'xd': {
    name: 'XD',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/LGO1O',
    outputFile: 'extracted/xd-full.json',
    expectedAlbums: 80
  },
  'blackrhino': {
    name: 'Black Rhino',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/N3300',
    outputFile: 'extracted/blackrhino-full.json',
    expectedAlbums: 194
  }
};

const CDP_URL = 'http://127.0.0.1:18800';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForImages(page, timeout = 10000) {
  const start = Date.now();
  let lastCount = 0;
  let stableCount = 0;
  
  while (Date.now() - start < timeout) {
    const count = await page.evaluate(() => {
      return document.querySelectorAll('img[src*="d3opzdukpbxlns.cloudfront.net"]').length;
    });
    
    if (count === lastCount && count > 0) {
      stableCount++;
      if (stableCount >= 3) return count;
    } else {
      stableCount = 0;
      lastCount = count;
    }
    
    await sleep(500);
  }
  
  return lastCount;
}

async function extractAlbumImages(page) {
  // Wait for images to load
  await waitForImages(page);
  
  // Scroll to ensure all images are loaded (for larger albums)
  await page.evaluate(async () => {
    const scrollContainer = document.querySelector('[class*="content"]') || document.documentElement;
    for (let i = 0; i < 5; i++) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
      await new Promise(r => setTimeout(r, 300));
    }
    scrollContainer.scrollTop = 0;
  });
  
  await sleep(1000);
  
  // Extract all cloudfront image URLs
  const images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    const results = [];
    const seen = new Set();
    
    imgs.forEach(img => {
      const src = img.src || '';
      // Only get the actual content images (d3opzdukpbxlns), not logos
      if (src.includes('d3opzdukpbxlns.cloudfront.net')) {
        // Extract the unique image ID
        const match = src.match(/\/([a-f0-9-]+)\/([a-f0-9]+)\.\d+\.jpg/);
        if (match && !seen.has(match[2])) {
          seen.add(match[2]);
          
          // Convert to 800 version for high-res
          const highResUrl = src.replace(/\.\d+\.jpg/, '.800.jpg');
          
          results.push({
            url: highResUrl,
            alt: img.alt || img.title || '',
            imageId: match[2]
          });
        }
      }
    });
    
    return results;
  });
  
  return images;
}

async function getAlbumListFromPage(page) {
  await sleep(2000);
  
  const albums = await page.evaluate(() => {
    const items = [];
    
    // Look for list items in the content area
    const listItems = document.querySelectorAll('li');
    listItems.forEach(li => {
      const text = li.textContent || '';
      // Match pattern: "AlbumName (count)"
      const match = text.match(/^([A-Z0-9][A-Za-z0-9_\s.'-]+?)\s*\((\d+)\)$/);
      if (match) {
        items.push({
          name: match[1].trim(),
          expectedCount: parseInt(match[2])
        });
      }
    });
    
    return items;
  });
  
  return albums;
}

async function extractBrand(browser, brandKey, startFromAlbum = 0) {
  const brand = BRANDS[brandKey];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Extracting: ${brand.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  // Load existing progress if any
  const outputPath = path.join(__dirname, brand.outputFile);
  let result;
  try {
    const existing = await fs.readFile(outputPath, 'utf8');
    result = JSON.parse(existing);
    console.log(`Resuming from existing file with ${result.albums.length} albums`);
    startFromAlbum = result.albums.length;
  } catch {
    result = {
      brand: brand.name,
      extractedAt: new Date().toISOString(),
      albums: []
    };
  }
  
  // Navigate to the Vehicles folder
  console.log(`Navigating to Vehicles folder: ${brand.vehiclesFolderUrl}`);
  await page.goto(brand.vehiclesFolderUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  
  // Get album count
  const itemsText = await page.evaluate(() => {
    const match = document.body.innerText.match(/(\d+)\s*Items/);
    return match ? parseInt(match[1]) : 0;
  });
  
  console.log(`Found ${itemsText} albums in folder`);
  
  // Get all album names from tree view (they're more reliable than content list)
  const albumNames = await page.evaluate(() => {
    const names = [];
    const treeItems = document.querySelectorAll('[role="treeitem"]');
    treeItems.forEach(item => {
      const label = item.getAttribute('aria-label') || '';
      if (label.startsWith('album ')) {
        const name = label.replace('album ', '');
        names.push(name);
      }
    });
    return names;
  });
  
  console.log(`Found ${albumNames.length} album names in tree view`);
  
  if (albumNames.length === 0) {
    // Try expanding the tree
    await page.evaluate(() => {
      const folder = document.querySelector('[aria-label*="Vehicles"]');
      if (folder) folder.click();
    });
    await sleep(2000);
  }
  
  // Process each album
  for (let i = startFromAlbum; i < albumNames.length; i++) {
    const albumName = albumNames[i];
    console.log(`\n[${i + 1}/${albumNames.length}] Processing: ${albumName}`);
    
    try {
      // Click on the album in the tree view
      const clicked = await page.evaluate((name) => {
        const treeItems = document.querySelectorAll('[role="treeitem"]');
        for (const item of treeItems) {
          if (item.getAttribute('aria-label') === `album ${name}`) {
            const clickable = item.querySelector('[cursor="pointer"]') || item;
            clickable.click();
            return true;
          }
        }
        return false;
      }, albumName);
      
      if (!clicked) {
        console.log(`  Warning: Could not click album "${albumName}"`);
        continue;
      }
      
      // Wait for navigation
      await sleep(2500);
      
      // Get album code from URL
      const currentUrl = await page.url();
      const codeMatch = currentUrl.match(/\/album\/([A-Z0-9]+)/i) || currentUrl.match(/\/folder\/([A-Z0-9]+)/i);
      const albumCode = codeMatch ? codeMatch[1] : 'unknown';
      
      // Extract images
      const images = await extractAlbumImages(page);
      
      console.log(`  Extracted ${images.length} images (code: ${albumCode})`);
      
      result.albums.push({
        name: albumName,
        code: albumCode,
        imageCount: images.length,
        images: images.map(img => ({
          url: img.url,
          alt: img.alt
        }))
      });
      
      // Save progress every 5 albums
      if ((i + 1) % 5 === 0 || i === albumNames.length - 1) {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.log(`  Progress saved (${result.albums.length} albums)`);
      }
      
      // Navigate back to folder
      await page.goto(brand.vehiclesFolderUrl, { waitUntil: 'networkidle2' });
      await sleep(2000);
      
    } catch (err) {
      console.log(`  Error processing album: ${err.message}`);
    }
  }
  
  // Final save
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  
  const totalImages = result.albums.reduce((sum, a) => sum + a.imageCount, 0);
  console.log(`\nCompleted ${brand.name}: ${result.albums.length} albums, ${totalImages} total images`);
  console.log(`Saved to: ${outputPath}`);
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const brandArg = args[0]?.toLowerCase() || 'all';
  
  console.log('Canto Gallery Image Extractor');
  console.log('Connecting to browser at', CDP_URL);
  
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null
    });
    console.log('Connected to browser');
  } catch (err) {
    console.error('Failed to connect to browser:', err.message);
    console.log('\nMake sure the clawd browser profile is running.');
    process.exit(1);
  }
  
  const results = {};
  const brandsToProcess = brandArg === 'all' 
    ? ['motometal', 'xd', 'blackrhino']
    : [brandArg];
  
  for (const brandKey of brandsToProcess) {
    if (!BRANDS[brandKey]) {
      console.error(`Unknown brand: ${brandKey}`);
      continue;
    }
    try {
      results[brandKey] = await extractBrand(browser, brandKey);
    } catch (err) {
      console.error(`Error processing ${brandKey}:`, err.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('EXTRACTION COMPLETE');
  console.log('='.repeat(60));
  
  for (const [key, result] of Object.entries(results)) {
    if (result) {
      const totalImages = result.albums.reduce((sum, a) => sum + a.imageCount, 0);
      console.log(`${result.brand}: ${result.albums.length} albums, ${totalImages} images`);
    }
  }
}

main().catch(console.error);
