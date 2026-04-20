#!/usr/bin/env node
/**
 * Gallery Image Migration Script
 * 
 * Downloads images from WheelPros Canto CDN (using browser session cookies)
 * and re-uploads to Vercel Blob for public access.
 * 
 * Prerequisites:
 * 1. Have Chrome open with Canto portal tab (https://wheelpros.canto.com/v/WheelPros/landing)
 * 2. Clawdbot browser relay connected (click extension icon on that tab)
 * 
 * Usage:
 *   node scripts/gallery/migrate-to-blob.mjs --dry-run     # Test without uploading
 *   node scripts/gallery/migrate-to-blob.mjs --limit=10    # Process 10 images
 *   node scripts/gallery/migrate-to-blob.mjs               # Process all images
 *   node scripts/gallery/migrate-to-blob.mjs --resume      # Resume from last position
 */

import puppeteer from 'puppeteer-core';
import pg from 'pg';
import { put } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// ============================================================================
// CONFIG
// ============================================================================

const CDP_URL = 'http://127.0.0.1:9222'; // Chrome DevTools Protocol
const BATCH_SIZE = 10;
const DELAY_BETWEEN_IMAGES = 300; // ms
const DELAY_BETWEEN_BATCHES = 2000; // ms
const PROGRESS_FILE = path.join(__dirname, 'migrate-progress.json');

// ============================================================================
// BROWSER CONNECTION
// ============================================================================

async function connectToBrowser() {
  console.log('Connecting to Chrome...');
  
  // Try standard CDP port first
  try {
    const browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null
    });
    console.log('Connected via CDP port 9222');
    return browser;
  } catch (e) {
    console.log('CDP 9222 failed, trying Clawdbot relay...');
  }
  
  // Try Clawdbot browser relay
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:18792',
      defaultViewport: null
    });
    console.log('Connected via Clawdbot relay');
    return browser;
  } catch (e) {
    console.error('Could not connect to browser.');
    console.error('Make sure Chrome is running with remote debugging:');
    console.error('  chrome --remote-debugging-port=9222');
    console.error('Or use Clawdbot browser relay');
    throw e;
  }
}

async function getCantoPage(browser) {
  const pages = await browser.pages();
  
  // Find page with Canto loaded
  for (const page of pages) {
    const url = page.url();
    if (url.includes('canto.com')) {
      console.log('Found Canto page');
      return page;
    }
  }
  
  // If no Canto page, use first page and navigate
  console.log('No Canto page found, using first page...');
  const page = pages[0] || await browser.newPage();
  await page.goto('https://wheelpros.canto.com/v/WheelPros/landing?viewIndex=0', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  return page;
}

// ============================================================================
// IMAGE FETCHING VIA BROWSER
// ============================================================================

async function fetchImageViaBrowser(page, url) {
  const result = await page.evaluate(async (imageUrl) => {
    try {
      const response = await fetch(imageUrl, { credentials: 'include' });
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ 
          data: reader.result.split(',')[1],
          contentType 
        });
        reader.onerror = () => resolve({ error: 'FileReader error' });
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return { error: e.message };
    }
  }, url);
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return {
    buffer: Buffer.from(result.data, 'base64'),
    contentType: result.contentType
  };
}

// ============================================================================
// VERCEL BLOB UPLOAD
// ============================================================================

async function uploadToBlob(buffer, filename, contentType = 'image/jpeg') {
  const blob = await put(`gallery/${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType
  });
  return blob.url;
}

// ============================================================================
// DATABASE
// ============================================================================

function getPool() {
  return new pg.Pool({ 
    connectionString: process.env.POSTGRES_URL,
    max: 3
  });
}

async function getImagesToMigrate(pool, limit = null, offset = 0) {
  const query = `
    SELECT id, thumbnail_url, source_url
    FROM gallery_assets
    WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
      AND thumbnail_url NOT LIKE '%vercel-storage%'
      AND thumbnail_url NOT LIKE '%blob.vercel%'
    ORDER BY id
    ${limit ? `LIMIT ${limit}` : ''}
    ${offset ? `OFFSET ${offset}` : ''}
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function updateImageUrls(pool, id, newThumbnailUrl, newSourceUrl) {
  await pool.query(
    `UPDATE gallery_assets SET thumbnail_url = $1, source_url = $2 WHERE id = $3`,
    [newThumbnailUrl, newSourceUrl, id]
  );
}

async function getTotalCount(pool) {
  const result = await pool.query(`
    SELECT COUNT(*) as count FROM gallery_assets
    WHERE (thumbnail_url LIKE '%cloudfront.net%' OR thumbnail_url LIKE '%canto.com%')
      AND thumbnail_url NOT LIKE '%vercel-storage%'
      AND thumbnail_url NOT LIKE '%blob.vercel%'
  `);
  return parseInt(result.rows[0].count);
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { lastId: 0, processed: 0, failed: [], startedAt: new Date().toISOString() };
  }
}

async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrateImage(page, pool, row, dryRun = false) {
  const { id, thumbnail_url, source_url } = row;
  
  // Extract image ID from URL for naming
  let imageId;
  const cfMatch = thumbnail_url.match(/\/([a-f0-9]{20,})\.\d+\.jpg/i);
  const cantoMatch = thumbnail_url.match(/\/image\/([a-z0-9]+)/i);
  
  if (cfMatch) {
    imageId = cfMatch[1].substring(0, 16); // Truncate for shorter filenames
  } else if (cantoMatch) {
    imageId = cantoMatch[1].substring(0, 16);
  } else {
    imageId = `img-${id}`;
  }
  
  const thumbFilename = `${imageId}-${id}-thumb.jpg`;
  const fullFilename = `${imageId}-${id}-full.jpg`;
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would migrate: ${thumbFilename}`);
    return { success: true, dryRun: true };
  }
  
  try {
    // Download thumbnail via browser
    console.log(`  Downloading thumbnail...`);
    const thumbData = await fetchImageViaBrowser(page, thumbnail_url);
    
    // Download full image if different
    let fullData = thumbData;
    if (source_url && source_url !== thumbnail_url) {
      console.log(`  Downloading full image...`);
      try {
        fullData = await fetchImageViaBrowser(page, source_url);
      } catch (e) {
        console.log(`  Full image failed, using thumbnail: ${e.message}`);
        fullData = thumbData;
      }
    }
    
    // Upload to Vercel Blob
    console.log(`  Uploading to Blob...`);
    const newThumbUrl = await uploadToBlob(thumbData.buffer, thumbFilename, thumbData.contentType);
    
    let newFullUrl = newThumbUrl;
    if (source_url && source_url !== thumbnail_url && fullData !== thumbData) {
      newFullUrl = await uploadToBlob(fullData.buffer, fullFilename, fullData.contentType);
    }
    
    // Update database
    console.log(`  Updating database...`);
    await updateImageUrls(pool, id, newThumbUrl, newFullUrl);
    
    return { success: true, newThumbUrl, newFullUrl };
    
  } catch (error) {
    console.error(`  ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║    Gallery Image Migration Tool        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '🚀 LIVE'}`);
  console.log(`Limit: ${limit || 'ALL'}`);
  console.log(`Resume: ${resume}`);
  console.log('');
  
  // Connect to browser
  let browser;
  let page;
  
  try {
    browser = await connectToBrowser();
    page = await getCantoPage(browser);
    
    // Wait a moment for cookies to be ready
    await new Promise(r => setTimeout(r, 2000));
    
  } catch (error) {
    console.error('Failed to connect to browser:', error.message);
    console.error('');
    console.error('Instructions:');
    console.error('1. Open Chrome');
    console.error('2. Go to: https://wheelpros.canto.com/v/WheelPros/landing');
    console.error('3. Make sure you can see the images');
    console.error('4. Start Chrome with: chrome --remote-debugging-port=9222');
    console.error('   Or use Clawdbot browser with relay attached');
    process.exit(1);
  }
  
  const pool = getPool();
  
  try {
    // Get total count
    const total = await getTotalCount(pool);
    console.log(`Total images to migrate: ${total}`);
    
    if (total === 0) {
      console.log('No images need migration!');
      return;
    }
    
    // Load progress if resuming
    let progress = resume ? await loadProgress() : { lastId: 0, processed: 0, failed: [], startedAt: new Date().toISOString() };
    
    if (resume && progress.processed > 0) {
      console.log(`Resuming from position ${progress.processed} (last ID: ${progress.lastId})`);
    }
    
    // Get images to process
    const images = await getImagesToMigrate(pool, limit, resume ? progress.processed : 0);
    console.log(`Processing ${images.length} images...`);
    console.log('');
    
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < images.length; i++) {
      const row = images[i];
      const current = (resume ? progress.processed : 0) + i + 1;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = i > 0 ? (i / (Date.now() - startTime) * 1000 * 60).toFixed(1) : '0';
      
      console.log(`[${current}/${total}] ID ${row.id} (${elapsed}s elapsed, ${rate}/min)`);
      
      const result = await migrateImage(page, pool, row, dryRun);
      
      if (result.success) {
        successCount++;
        if (!dryRun && result.newThumbUrl) {
          const shortUrl = result.newThumbUrl.length > 60 
            ? result.newThumbUrl.substring(0, 60) + '...'
            : result.newThumbUrl;
          console.log(`  ✓ ${shortUrl}`);
        }
      } else {
        failCount++;
        progress.failed.push({ id: row.id, error: result.error, url: row.thumbnail_url });
      }
      
      // Update progress
      progress.lastId = row.id;
      progress.processed = (resume ? progress.processed : 0) + i + 1;
      
      // Save progress every 10 images
      if (!dryRun && (i + 1) % 10 === 0) {
        await saveProgress(progress);
      }
      
      // Delay between images
      if (i < images.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_IMAGES));
      }
      
      // Longer delay between batches
      if ((i + 1) % BATCH_SIZE === 0 && i < images.length - 1) {
        console.log(`\n  ⏸ Batch pause (${DELAY_BETWEEN_BATCHES}ms)...\n`);
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Final progress save
    if (!dryRun) {
      progress.completedAt = new Date().toISOString();
      progress.successCount = successCount;
      progress.failCount = failCount;
      await saveProgress(progress);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║         Migration Complete             ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);
    console.log(`⏱ Time: ${totalTime} minutes`);
    
    if (progress.failed.length > 0) {
      console.log(`\nFailed IDs saved to: ${PROGRESS_FILE}`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    // Don't disconnect browser - user may want to keep using it
  }
}

main();
