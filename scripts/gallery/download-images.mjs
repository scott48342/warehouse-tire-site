#!/usr/bin/env node
/**
 * Gallery Image Downloader
 * 
 * Downloads images using Chrome's CDP - navigates to each image URL
 * (which sends cookies) and captures the response.
 * 
 * Prerequisites:
 * 1. Close ALL Chrome windows
 * 2. Start Chrome with: chrome --remote-debugging-port=9222
 * 3. In that Chrome, go to https://wheelpros.canto.com/v/WheelPros/landing
 * 4. Make sure images are visible
 * 5. Run this script
 * 
 * Usage:
 *   node scripts/gallery/download-images.mjs --limit=10   # Test with 10
 *   node scripts/gallery/download-images.mjs              # All images
 */

import puppeteer from 'puppeteer-core';
import pg from 'pg';
import { put } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const CDP_PORT = 9222;
const PROGRESS_FILE = path.join(__dirname, 'download-progress.json');
const LOCAL_CACHE_DIR = path.join(__dirname, 'image-cache');

// ============================================================================
// DATABASE
// ============================================================================

function getPool() {
  return new pg.Pool({ connectionString: process.env.POSTGRES_URL, max: 3 });
}

async function getImages(pool, limit, offset = 0) {
  const query = `
    SELECT id, thumbnail_url, source_url
    FROM gallery_assets
    WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
      AND thumbnail_url NOT LIKE '%blob.vercel%'
    ORDER BY id
    ${limit ? `LIMIT ${limit}` : ''}
    OFFSET ${offset}
  `;
  return (await pool.query(query)).rows;
}

async function getTotal(pool) {
  const r = await pool.query(`
    SELECT COUNT(*) FROM gallery_assets
    WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
      AND thumbnail_url NOT LIKE '%blob.vercel%'
  `);
  return parseInt(r.rows[0].count);
}

async function updateUrls(pool, id, thumbUrl, sourceUrl) {
  await pool.query(
    'UPDATE gallery_assets SET thumbnail_url = $1, source_url = $2 WHERE id = $3',
    [thumbUrl, sourceUrl, id]
  );
}

// ============================================================================
// PROGRESS
// ============================================================================

async function loadProgress() {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf8'));
  } catch {
    return { processed: 0, failed: [] };
  }
}

async function saveProgress(p) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ============================================================================
// IMAGE DOWNLOAD VIA CDP
// ============================================================================

async function downloadImage(page, url) {
  // Enable request interception to capture response
  const client = await page.createCDPSession();
  
  let imageData = null;
  
  await client.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Response' }]
  });
  
  const responsePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    
    client.on('Fetch.requestPaused', async (event) => {
      try {
        if (event.request.url === url && event.responseStatusCode === 200) {
          const body = await client.send('Fetch.getResponseBody', {
            requestId: event.requestId
          });
          imageData = body.base64Encoded 
            ? Buffer.from(body.body, 'base64')
            : Buffer.from(body.body);
          clearTimeout(timeout);
        }
        await client.send('Fetch.continueRequest', { requestId: event.requestId });
      } catch (e) {
        try { await client.send('Fetch.continueRequest', { requestId: event.requestId }); } catch {}
      }
    });
  });
  
  // Navigate to the image
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    // Ignore navigation errors, we care about the response
  }
  
  // Wait a bit for the image data
  await new Promise(r => setTimeout(r, 1000));
  
  await client.send('Fetch.disable');
  await client.detach();
  
  if (!imageData) {
    // Fallback: try screenshot
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 90 });
    return screenshot;
  }
  
  return imageData;
}

// Alternative: simpler approach using page screenshot
async function downloadImageSimple(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 800, height: 800 });
    
    const response = await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 20000 
    });
    
    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status() || 'unknown'}`);
    }
    
    // Get the response buffer
    const buffer = await response.buffer();
    return buffer;
    
  } finally {
    await page.close();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const resume = args.includes('--resume');
  
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║    Gallery Image Download + Upload        ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  
  // Connect to Chrome
  console.log(`Connecting to Chrome on port ${CDP_PORT}...`);
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${CDP_PORT}`,
      defaultViewport: null
    });
    console.log('✓ Connected to Chrome');
  } catch (e) {
    console.error('');
    console.error('✗ Could not connect to Chrome!');
    console.error('');
    console.error('Please:');
    console.error('1. Close ALL Chrome windows');
    console.error('2. Open a command prompt and run:');
    console.error('   chrome --remote-debugging-port=9222');
    console.error('3. In that Chrome, go to:');
    console.error('   https://wheelpros.canto.com/v/WheelPros/landing');
    console.error('4. Wait for images to load');
    console.error('5. Run this script again');
    process.exit(1);
  }
  
  // Verify Canto is open
  const pages = await browser.pages();
  const cantoPage = pages.find(p => p.url().includes('canto.com'));
  if (!cantoPage) {
    console.error('');
    console.error('✗ No Canto page found!');
    console.error('Please open https://wheelpros.canto.com/v/WheelPros/landing in Chrome first');
    process.exit(1);
  }
  console.log('✓ Found Canto page');
  
  const pool = getPool();
  
  try {
    const total = await getTotal(pool);
    console.log(`Total images to process: ${total}`);
    
    let progress = resume ? await loadProgress() : { processed: 0, failed: [] };
    const images = await getImages(pool, limit, resume ? progress.processed : 0);
    
    console.log(`Processing ${images.length} images...`);
    console.log('');
    
    let success = 0, fail = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < images.length; i++) {
      const { id, thumbnail_url, source_url } = images[i];
      const current = (resume ? progress.processed : 0) + i + 1;
      
      process.stdout.write(`[${current}/${total}] ID ${id}... `);
      
      try {
        // Download thumbnail
        const thumbBuffer = await downloadImageSimple(browser, thumbnail_url);
        
        // Generate filename
        const match = thumbnail_url.match(/\/([a-f0-9]+)\.\d+\.jpg/i) || 
                      thumbnail_url.match(/\/image\/([a-z0-9]+)/i);
        const imageId = match ? match[1].substring(0, 12) : `img`;
        const thumbName = `${imageId}-${id}-thumb.jpg`;
        const fullName = `${imageId}-${id}-full.jpg`;
        
        // Upload thumbnail to Vercel Blob
        const thumbBlob = await put(`gallery/${thumbName}`, thumbBuffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'image/jpeg'
        });
        
        // Download and upload full image if different
        let fullUrl = thumbBlob.url;
        if (source_url && source_url !== thumbnail_url) {
          try {
            const fullBuffer = await downloadImageSimple(browser, source_url);
            const fullBlob = await put(`gallery/${fullName}`, fullBuffer, {
              access: 'public',
              addRandomSuffix: false,
              contentType: 'image/jpeg'
            });
            fullUrl = fullBlob.url;
          } catch {
            // Use thumb as full
          }
        }
        
        // Update database
        await updateUrls(pool, id, thumbBlob.url, fullUrl);
        
        console.log('✓');
        success++;
        
      } catch (e) {
        console.log(`✗ ${e.message}`);
        fail++;
        progress.failed.push({ id, error: e.message });
      }
      
      // Save progress every 10
      if ((i + 1) % 10 === 0) {
        progress.processed = (resume ? progress.processed : 0) + i + 1;
        await saveProgress(progress);
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Final save
    progress.processed = (resume ? progress.processed : 0) + images.length;
    await saveProgress(progress);
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('');
    console.log('════════════════════════════════════════════');
    console.log(`✓ Success: ${success}`);
    console.log(`✗ Failed: ${fail}`);
    console.log(`⏱ Time: ${elapsed} minutes`);
    console.log('════════════════════════════════════════════');
    
  } finally {
    await pool.end();
    // Don't disconnect browser
  }
}

main().catch(console.error);
