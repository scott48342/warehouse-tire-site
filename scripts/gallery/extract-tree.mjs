#!/usr/bin/env node

/**
 * Extract gallery images from Canto using tree navigation
 * Uses aria-labeled tree items for reliable album clicking
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Brand configurations with direct Vehicles folder URLs
const BRANDS = {
  motometal: {
    name: 'Moto Metal',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/L6OF6',
    prefix: 'MO',
    outputFile: 'motometal-full.json'
  },
  xd: {
    name: 'XD',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/LGO1O',
    prefix: 'XD',
    outputFile: 'xd-full.json'
  },
  blackrhino: {
    name: 'Black Rhino',
    vehiclesFolderUrl: 'https://wheelpros.canto.com/v/WheelPros/folder/PIAN4',
    prefix: '',
    outputFile: 'blackrhino-full.json'
  }
};

const EXTRACTED_DIR = path.join(process.cwd(), 'extracted');

async function connectToBrowser() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800',
    defaultViewport: null
  });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('canto.com')) || pages[0];
  return { browser, page };
}

async function extractBrand(brandKey) {
  const brand = BRANDS[brandKey];
  if (!brand) {
    console.error(`Unknown brand: ${brandKey}`);
    return;
  }

  console.log(`\n============================================================`);
  console.log(`Extracting: ${brand.name}`);
  console.log(`============================================================`);

  const { browser, page } = await connectToBrowser();
  const outputPath = path.join(EXTRACTED_DIR, brand.outputFile);
  
  // Load existing progress
  const processedNames = new Set();
  let result;
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
  await sleep(5000);
  
  // Get list of album tree items
  const albumItems = await page.evaluate((prefix) => {
    const items = [];
    // Find all treeitem elements that are albums (have "album" in aria-label)
    const treeItems = document.querySelectorAll('div[role="treeitem"]');
    for (const item of treeItems) {
      const label = item.getAttribute('aria-label') || '';
      if (label.startsWith('album ')) {
        const name = label.replace('album ', '');
        // Filter to only vehicle albums (start with brand prefix or are vehicle names)
        if (!prefix || name.startsWith(prefix) || /^[A-Z][a-z]/.test(name)) {
          items.push({ name, element: null });
        }
      }
    }
    return items;
  }, brand.prefix);
  
  console.log(`Found ${albumItems.length} albums in tree`);
  
  // Process each album
  for (let i = 0; i < albumItems.length; i++) {
    const albumName = albumItems[i].name;
    
    if (processedNames.has(albumName)) {
      console.log(`[${i+1}/${albumItems.length}] Skipping (already done): ${albumName}`);
      continue;
    }
    
    console.log(`\n[${i+1}/${albumItems.length}] ${albumName}`);
    
    try {
      // First, make sure we're on the folder page
      if (!page.url().includes(brand.vehiclesFolderUrl.split('/').pop())) {
        await page.goto(brand.vehiclesFolderUrl, { waitUntil: 'networkidle2' });
        await sleep(3000);
      }
      
      // Find and click the album treeitem
      const clicked = await page.evaluate((name) => {
        const treeItems = document.querySelectorAll('div[role="treeitem"]');
        for (const item of treeItems) {
          const label = item.getAttribute('aria-label') || '';
          if (label === `album ${name}`) {
            // Find clickable child
            const clickable = item.querySelector('[cursor="pointer"]') || item;
            clickable.click();
            return true;
          }
        }
        return false;
      }, albumName);
      
      if (!clicked) {
        console.log(`  ⚠ Could not find album in tree, skipping`);
        continue;
      }
      
      // Wait for navigation and images to load
      await sleep(4000);
      
      // Get album code from URL
      const url = page.url();
      const codeMatch = url.match(/\/album\/([A-Z0-9]+)/i);
      const code = codeMatch ? codeMatch[1] : 'unknown';
      
      // Scroll to load all images
      await page.evaluate(async () => {
        const container = document.querySelector('ul[role="list"]')?.parentElement || document.body;
        for (let i = 0; i < 15; i++) {
          container.scrollTop += 800;
          await new Promise(r => setTimeout(r, 300));
        }
        container.scrollTop = 0;
      });
      await sleep(1000);
      
      // Extract images
      const images = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || '';
          if (src.includes('d3opzdukpbxlns.cloudfront.net')) {
            const match = src.match(/(d3opzdukpbxlns\.cloudfront\.net\/[^/]+\/([A-Z0-9]+))/i);
            if (match && !seen.has(match[1])) {
              seen.add(match[1]);
              const highRes = src.replace(/\.\d+\.jpg/, '.800.jpg');
              results.push({ url: highRes, alt: img.alt || '', id: match[2] });
            }
          }
        });
        return results;
      });
      
      console.log(`  ✓ Extracted ${images.length} images (code: ${code})`);
      
      result.albums.push({
        name: albumName,
        code: code,
        imageCount: images.length,
        images: images.map(img => ({ url: img.url, alt: img.alt }))
      });
      processedNames.add(albumName);
      
      // Save progress every 5 albums
      if ((result.albums.length) % 5 === 0) {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.log(`  💾 Saved progress (${result.albums.length} albums)`);
      }
      
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
    console.log('Usage: node extract-tree.mjs <brand>');
    console.log('Brands: motometal, xd, blackrhino');
    process.exit(1);
  }
  
  console.log('Connecting to browser...');
  await extractBrand(brandArg);
  console.log('\nDone!');
}

main().catch(console.error);
