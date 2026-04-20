#!/usr/bin/env node
/**
 * Gallery Migration using Signed URLs
 * 
 * Scrapes currently visible images on Canto page (which have signed URLs),
 * downloads them, and uploads to Vercel Blob.
 * 
 * Strategy:
 * 1. Connect to Canto page in Chrome
 * 2. Scroll to load images
 * 3. Extract signed URLs from visible <img> elements
 * 4. Download via fetch (with signed params)
 * 5. Upload to Vercel Blob
 * 6. Update database
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

const CDP_URL = 'http://127.0.0.1:9222';
const PROGRESS_FILE = path.join(__dirname, 'migrate-signed-progress.json');

async function connectToBrowser() {
  const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
  const pages = await browser.pages();
  const cantoPage = pages.find(p => p.url().includes('canto'));
  
  if (!cantoPage) throw new Error('No Canto page found. Open https://wheelpros.canto.com first.');
  return { browser, page: cantoPage };
}

async function getSignedImageUrls(page) {
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter(i => i.src.includes('d3opzdukpbxlns.cloudfront.net') && i.src.includes('Signature='))
      .map(i => ({
        signedUrl: i.src,
        // Extract base URL (without query params) for matching
        baseUrl: i.src.split('?')[0]
      }));
  });
}

async function scrollAndCollect(page, targetCount = 100) {
  const collected = new Map();
  let lastCount = 0;
  let staleRounds = 0;
  
  console.log(`Scrolling to collect ${targetCount} signed URLs...`);
  
  while (collected.size < targetCount && staleRounds < 5) {
    // Get current signed URLs
    const urls = await getSignedImageUrls(page);
    urls.forEach(u => {
      if (!collected.has(u.baseUrl)) {
        collected.set(u.baseUrl, u.signedUrl);
      }
    });
    
    console.log(`  Collected: ${collected.size}`);
    
    if (collected.size === lastCount) {
      staleRounds++;
    } else {
      staleRounds = 0;
      lastCount = collected.size;
    }
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise(r => setTimeout(r, 1500));
  }
  
  return Array.from(collected.entries()).map(([base, signed]) => ({ baseUrl: base, signedUrl: signed }));
}

async function downloadImage(signedUrl) {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType: response.headers.get('content-type') || 'image/jpeg' };
}

async function uploadToBlob(buffer, filename, contentType) {
  const blob = await put(`gallery/${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType
  });
  return blob.url;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
  const dryRun = args.includes('--dry-run');
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Signed URL Gallery Migration          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}`);
  console.log('');
  
  const { browser, page } = await connectToBrowser();
  console.log('Connected to Canto page');
  
  // Collect signed URLs by scrolling
  const signedUrls = await scrollAndCollect(page, limit);
  console.log(`\nCollected ${signedUrls.length} signed URLs`);
  
  if (signedUrls.length === 0) {
    console.log('No images found. Make sure Canto page has images visible.');
    return;
  }
  
  // Connect to DB
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Match signed URLs to database records
  let success = 0, failed = 0, notFound = 0;
  
  for (let i = 0; i < signedUrls.length; i++) {
    const { baseUrl, signedUrl } = signedUrls[i];
    
    // Extract image ID from URL
    const match = baseUrl.match(/\/([a-f0-9]{32})\.\d+\.jpg/i);
    if (!match) {
      console.log(`[${i+1}/${signedUrls.length}] Could not parse: ${baseUrl.slice(-50)}`);
      continue;
    }
    
    const imageId = match[1];
    
    // Find in database by source_url pattern
    const { rows } = await pool.query(`
      SELECT id, source_url FROM gallery_assets 
      WHERE source_url LIKE $1 OR thumbnail_url LIKE $1
      LIMIT 1
    `, [`%${imageId}%`]);
    
    if (rows.length === 0) {
      notFound++;
      continue;
    }
    
    const dbRecord = rows[0];
    console.log(`[${i+1}/${signedUrls.length}] ID ${dbRecord.id}: downloading...`);
    
    if (dryRun) {
      success++;
      continue;
    }
    
    try {
      // Download
      const { buffer, contentType } = await downloadImage(signedUrl);
      
      // Upload to Blob
      const filename = `${imageId.slice(0,16)}-${dbRecord.id}.jpg`;
      const blobUrl = await uploadToBlob(buffer, filename, contentType);
      
      // Update database
      await pool.query(
        `UPDATE gallery_assets SET source_url = $1, thumbnail_url = $1, cdn_url = $1 WHERE id = $2`,
        [blobUrl, dbRecord.id]
      );
      
      console.log(`  ✓ Uploaded: ${blobUrl.slice(-40)}`);
      success++;
      
      // Small delay
      await new Promise(r => setTimeout(r, 200));
      
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}`);
      failed++;
    }
  }
  
  console.log('\n════════════════════════════════════════');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Not in DB: ${notFound}`);
  console.log('════════════════════════════════════════');
  
  await pool.end();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
