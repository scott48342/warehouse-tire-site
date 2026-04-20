#!/usr/bin/env node
/**
 * Album-based Gallery Migration
 * 
 * Iterates through extracted KMC/Moto Metal albums, navigates to each in Canto,
 * scrapes signed URLs, downloads images, uploads to Vercel Blob.
 */

import puppeteer from 'puppeteer-core';
import pg from 'pg';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const CDP_URL = 'http://127.0.0.1:9222';
const PROGRESS_FILE = path.join(__dirname, 'album-migrate-progress.json');

// Load album data
function loadAlbums() {
  const albums = [];
  
  ['kmc-full.json', 'motometal-full.json'].forEach(file => {
    const filepath = path.join(__dirname, 'extracted', file);
    if (fs.existsSync(filepath)) {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (data.albums) {
        albums.push(...data.albums.map(a => ({ ...a, brand: data.brand })));
      }
    }
  });
  
  return albums;
}

async function connectToBrowser() {
  const browser = await puppeteer.connect({ browserURL: CDP_URL, defaultViewport: null });
  const pages = await browser.pages();
  const cantoPage = pages.find(p => p.url().includes('canto'));
  if (!cantoPage) throw new Error('No Canto page found');
  return { browser, page: cantoPage };
}

async function navigateToAlbum(page, albumCode) {
  const url = `https://wheelpros.canto.com/v/WheelPros/album/${albumCode}?viewIndex=0`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
}

async function getSignedUrls(page) {
  // Scroll to load all images
  let lastCount = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 500));
  }
  
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter(i => i.src.includes('d3opzdukpbxlns.cloudfront.net') && i.src.includes('Signature='))
      .map(i => ({
        signedUrl: i.src,
        baseUrl: i.src.split('?')[0],
        imageId: i.src.match(/\/([a-f0-9]{32})\./)?.[1]
      }))
      .filter(u => u.imageId);
  });
}

async function downloadImage(signedUrl) {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'image/jpeg'
  };
}

async function uploadToBlob(buffer, filename, contentType) {
  const blob = await put(`gallery/${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType
  });
  return blob.url;
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { processedAlbums: [], migratedImages: 0, failedImages: 0 };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const albumLimit = parseInt(args.find(a => a.startsWith('--albums='))?.split('=')[1] || '10');
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Album-Based Gallery Migration         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Album limit: ${albumLimit}`);
  console.log('');
  
  const albums = loadAlbums();
  console.log(`Total albums: ${albums.length}`);
  
  const progress = resume ? loadProgress() : { processedAlbums: [], migratedImages: 0, failedImages: 0 };
  const pendingAlbums = albums.filter(a => !progress.processedAlbums.includes(a.code));
  console.log(`Pending albums: ${pendingAlbums.length}`);
  
  const { browser, page } = await connectToBrowser();
  console.log('Connected to Canto');
  
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });
  
  let albumsProcessed = 0;
  
  for (const album of pendingAlbums.slice(0, albumLimit)) {
    console.log(`\n═══ Album: ${album.name} (${album.code}) ═══`);
    
    try {
      await navigateToAlbum(page, album.code);
      const signedUrls = await getSignedUrls(page);
      console.log(`  Found ${signedUrls.length} signed URLs`);
      
      for (const { signedUrl, imageId } of signedUrls) {
        // Find matching DB record
        const { rows } = await pool.query(`
          SELECT id FROM gallery_assets 
          WHERE (source_url LIKE $1 OR cdn_url LIKE $1)
            AND cdn_url NOT LIKE '%blob.vercel%'
          LIMIT 1
        `, [`%${imageId}%`]);
        
        if (rows.length === 0) continue;
        
        const dbId = rows[0].id;
        
        if (dryRun) {
          console.log(`  [DRY] Would migrate ID ${dbId}`);
          progress.migratedImages++;
          continue;
        }
        
        try {
          const { buffer, contentType } = await downloadImage(signedUrl);
          const filename = `${imageId.slice(0,16)}-${dbId}.jpg`;
          const blobUrl = await uploadToBlob(buffer, filename, contentType);
          
          await pool.query(
            `UPDATE gallery_assets SET cdn_url = $1, source_url = $1, thumbnail_url = $1 WHERE id = $2`,
            [blobUrl, dbId]
          );
          
          console.log(`  ✓ ID ${dbId} → blob`);
          progress.migratedImages++;
          
        } catch (e) {
          console.log(`  ✗ ID ${dbId}: ${e.message}`);
          progress.failedImages++;
        }
        
        await new Promise(r => setTimeout(r, 150));
      }
      
      progress.processedAlbums.push(album.code);
      albumsProcessed++;
      saveProgress(progress);
      
    } catch (e) {
      console.log(`  ✗ Album error: ${e.message}`);
    }
    
    // Delay between albums
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n════════════════════════════════════════');
  console.log(`Albums processed: ${albumsProcessed}`);
  console.log(`Images migrated: ${progress.migratedImages}`);
  console.log(`Images failed: ${progress.failedImages}`);
  console.log('════════════════════════════════════════');
  
  await pool.end();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
