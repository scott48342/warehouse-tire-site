/**
 * Direct Canto Gallery Extractor
 * 
 * Usage: node extract-direct.mjs [brand]
 * Brands: motometal, xd, blackrhino
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
    outputFile: 'extracted/motometal-full.json'
  },
  'xd': {
    name: 'XD',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/LGO1O',
    outputFile: 'extracted/xd-full.json'
  },
  'blackrhino': {
    name: 'Black Rhino',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/N3300',
    outputFile: 'extracted/blackrhino-full.json'
  }
};

const CDP_URL = 'http://127.0.0.1:18800';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractBrand(page, brandKey) {
  const brand = BRANDS[brandKey];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Extracting: ${brand.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const outputPath = path.join(__dirname, brand.outputFile);
  
  // Check for existing progress
  let result;
  let processedNames = new Set();
  try {
    const existing = await fs.readFile(outputPath, 'utf8');
    result = JSON.parse(existing);
    result.albums.forEach(a => processedNames.add(a.name));
    console.log(`Resuming: ${result.albums.length} albums already done`);
  } catch {
    result = {
      brand: brand.name,
      extractedAt: new Date().toISOString(),
      albums: []
    };
  }
  
  // Navigate to folder
  console.log(`Navigating to: ${brand.vehiclesFolderUrl}`);
  await page.goto(brand.vehiclesFolderUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(5000);  // Wait longer for page to fully load
  
  // Get album list from page text
  const albumList = await page.evaluate(() => {
    const text = document.body.innerText;
    const albums = [];
    // Match album names with counts in format "Name (count)"
    const regex = /^(MO\d+[A-Za-z0-9_\s.'-]+?)\s*\((\d+)\)$/gm;
    let match;
    // Split by lines and check each
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const m = trimmed.match(/^([A-Z][A-Za-z0-9_\s.'-]+?)\s*\((\d+)\)$/);
      if (m && parseInt(m[2]) > 0) {
        // Filter to only album-like names (start with brand code)
        const name = m[1].trim();
        if (/^[A-Z]{2,3}\d/.test(name) || /^\d{4}/.test(name) || /^[A-Z][a-z]/.test(name)) {
          albums.push({ name, expectedCount: parseInt(m[2]) });
        }
      }
    }
    return albums;
  });
  
  console.log(`Found ${albumList.length} albums with images`);
  
  // Process each album
  for (let i = 0; i < albumList.length; i++) {
    const album = albumList[i];
    
    if (processedNames.has(album.name)) {
      console.log(`[${i+1}/${albumList.length}] Skipping (already done): ${album.name}`);
      continue;
    }
    
    console.log(`\n[${i+1}/${albumList.length}] ${album.name} (expecting ${album.expectedCount} images)`);
    
    try {
      // Click on album by finding the element with matching text
      const clicked = await page.evaluate((albumName, count) => {
        // Find all elements
        const allElements = document.querySelectorAll('*');
        const searchText = `${albumName} (${count})`;
        for (const el of allElements) {
          if (el.textContent?.trim() === searchText && el.offsetParent !== null) {
            // Find parent li or clickable element
            let clickTarget = el;
            let parent = el.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              if (parent.tagName === 'LI') {
                clickTarget = parent;
                break;
              }
              parent = parent.parentElement;
            }
            clickTarget.click();
            return true;
          }
        }
        // Fallback: try clicking anything containing the album name
        for (const el of allElements) {
          if (el.textContent?.includes(albumName + ' (') && 
              el.offsetParent !== null &&
              el.childElementCount < 3) {
            el.click();
            return true;
          }
        }
        return false;
      }, album.name, album.expectedCount);
      
      if (!clicked) {
        console.log(`  ⚠ Could not find album, skipping`);
        continue;
      }
      
      // Wait for navigation
      await sleep(4000);
      
      // Get album code from URL
      const url = page.url();
      const codeMatch = url.match(/\/album\/([A-Z0-9]+)/i);
      const code = codeMatch ? codeMatch[1] : 'unknown';
      
      // Wait for images to load
      await sleep(2000);
      
      // Scroll to load all images
      await page.evaluate(async () => {
        for (let i = 0; i < 15; i++) {
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise(r => setTimeout(r, 400));
        }
        window.scrollTo(0, 0);
      });
      
      await sleep(1500);
      
      // Extract images
      const images = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || '';
          if (src.includes('d3opzdukpbxlns.cloudfront.net')) {
            const match = src.match(/\/([a-f0-9-]+)\/([a-f0-9]+)\.\d+\.jpg/);
            if (match && !seen.has(match[2])) {
              seen.add(match[2]);
              const highRes = src.replace(/\.\d+\.jpg/, '.800.jpg');
              results.push({ url: highRes, alt: img.alt || '', id: match[2] });
            }
          }
        });
        return results;
      });
      
      console.log(`  ✓ Extracted ${images.length} images (code: ${code})`);
      
      result.albums.push({
        name: album.name,
        code: code,
        imageCount: images.length,
        images: images.map(img => ({ url: img.url, alt: img.alt }))
      });
      processedNames.add(album.name);
      
      // Save progress every 5 albums
      if ((result.albums.length) % 5 === 0) {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.log(`  💾 Saved progress (${result.albums.length} albums)`);
      }
      
      // Go back to folder
      await page.goto(brand.vehiclesFolderUrl, { waitUntil: 'networkidle2' });
      await sleep(3000);
      
      // Scroll the content area to load all albums
      await page.evaluate(async () => {
        const contentArea = document.querySelector('ul[role="list"]')?.parentElement || document.documentElement;
        for (let i = 0; i < 20; i++) {
          contentArea.scrollTop = i * 500;
          await new Promise(r => setTimeout(r, 200));
        }
        contentArea.scrollTop = 0;
      });
      await sleep(1000);
      
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }
  
  // Final save
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  
  const totalImages = result.albums.reduce((sum, a) => sum + a.imageCount, 0);
  console.log(`\n✅ ${brand.name}: ${result.albums.length} albums, ${totalImages} images`);
  console.log(`📁 Saved: ${outputPath}`);
  
  return result;
}

async function main() {
  const brandArg = process.argv[2]?.toLowerCase();
  
  if (!brandArg || !BRANDS[brandArg]) {
    console.log('Usage: node extract-direct.mjs [motometal|xd|blackrhino]');
    process.exit(1);
  }
  
  console.log('Connecting to browser...');
  const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];
  
  await extractBrand(page, brandArg);
  
  console.log('\nDone!');
}

main().catch(console.error);
