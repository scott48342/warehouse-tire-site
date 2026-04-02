#!/usr/bin/env node
/**
 * Tire Image Import Script
 * 
 * Downloads tire images from TireLibrary and uploads to Vercel Blob.
 * Stores mapping in tire_images table for fast lookups.
 * 
 * Usage:
 *   node import.js                    # Import all pending
 *   node import.js --size 2256517     # Search specific size and import
 *   node import.js --retry-failed     # Retry failed imports
 *   node import.js --status           # Show import status
 * 
 * Requires:
 *   POSTGRES_URL or DATABASE_URL
 *   BLOB_READ_WRITE_TOKEN (Vercel Blob)
 */

require('dotenv').config({ path: '.env.local' });

const { put } = require('@vercel/blob');
const pg = require('pg');

const { Pool } = pg;

// ============ Config ============

const TIRELIBRARY_BASE = 'https://tireweb.tirelibrary.com/images/Products';
const BATCH_SIZE = 20;
const DELAY_MS = 500; // Be nice to TireLibrary

// Common tire sizes to seed the database
const COMMON_SIZES = [
  // Passenger
  '2055516', '2155516', '2255016', '2055017', '2155517',
  '2255517', '2355517', '2155017', '2255017', '2355017',
  '2455017', '2055518', '2155518', '2255518', '2355518',
  '2455518', '2655018', '2256517', '2356517', '2456017',
  '2456517', '2556017', '2656017', '2356018', '2456018',
  '2556018', '2656018', '2755518', '2856018',
  // SUV/Truck
  '2357015', '2657015', '2457016', '2657016', '2457017',
  '2657017', '2757017', '2857017', '2457518', '2657518',
  '2757018', '2857018', '2657019', '2757019', '2857019',
  '2657020', '2757020', '2857020', '2957020', '3057020',
  '2757021', '2857021', '2957021', '3157021', '3357022',
];

// ============ Database ============

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Missing POSTGRES_URL or DATABASE_URL');
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

async function ensureTable() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS tire_images (
      pattern_id INTEGER PRIMARY KEY,
      brand VARCHAR(100),
      pattern VARCHAR(200),
      source_url TEXT NOT NULL,
      blob_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      content_type VARCHAR(50),
      file_size INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      uploaded_at TIMESTAMP
    )
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS tire_images_status_idx ON tire_images(status)`);
  await p.query(`CREATE INDEX IF NOT EXISTS tire_images_brand_idx ON tire_images(brand)`);
}

async function upsertTireImage(patternId, brand, pattern) {
  const p = getPool();
  const sourceUrl = `${TIRELIBRARY_BASE}/${patternId}.jpg`;
  
  await p.query(`
    INSERT INTO tire_images (pattern_id, brand, pattern, source_url, status, created_at)
    VALUES ($1, $2, $3, $4, 'pending', NOW())
    ON CONFLICT (pattern_id) DO UPDATE SET
      brand = COALESCE(EXCLUDED.brand, tire_images.brand),
      pattern = COALESCE(EXCLUDED.pattern, tire_images.pattern)
  `, [patternId, brand, pattern]);
}

async function markUploaded(patternId, blobUrl, contentType, fileSize) {
  const p = getPool();
  await p.query(`
    UPDATE tire_images SET
      blob_url = $2,
      status = 'uploaded',
      content_type = $3,
      file_size = $4,
      uploaded_at = NOW()
    WHERE pattern_id = $1
  `, [patternId, blobUrl, contentType, fileSize]);
}

async function markFailed(patternId, errorMessage) {
  const p = getPool();
  await p.query(`
    UPDATE tire_images SET
      status = 'failed',
      error_message = $2
    WHERE pattern_id = $1
  `, [patternId, errorMessage]);
}

async function markNotFound(patternId) {
  const p = getPool();
  await p.query(`
    UPDATE tire_images SET status = 'not_found' WHERE pattern_id = $1
  `, [patternId]);
}

async function getPendingImages(limit = BATCH_SIZE) {
  const p = getPool();
  const { rows } = await p.query(`
    SELECT pattern_id, brand, pattern, source_url
    FROM tire_images
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT $1
  `, [limit]);
  return rows;
}

async function getFailedImages(limit = BATCH_SIZE) {
  const p = getPool();
  const { rows } = await p.query(`
    SELECT pattern_id, brand, pattern, source_url
    FROM tire_images
    WHERE status = 'failed'
    ORDER BY created_at
    LIMIT $1
  `, [limit]);
  return rows;
}

async function getStats() {
  const p = getPool();
  const { rows } = await p.query(`
    SELECT status, COUNT(*) as count
    FROM tire_images
    GROUP BY status
    ORDER BY status
  `);
  return rows;
}

// ============ TireWire Search (to discover patternIds) ============

async function searchTireWire(size) {
  // Import the TireWire client
  const { searchTiresTirewire } = require('../../src/lib/tirewire/client');
  
  const results = await searchTiresTirewire(size);
  const patterns = new Map();
  
  for (const result of results) {
    for (const tire of result.tires) {
      if (tire.patternId && tire.patternId > 0) {
        patterns.set(tire.patternId, {
          patternId: tire.patternId,
          brand: tire.make,
          pattern: tire.pattern,
        });
      }
    }
  }
  
  return Array.from(patterns.values());
}

// ============ Image Processing ============

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      return { notFound: true };
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  
  return { buffer, contentType, size: buffer.length };
}

async function uploadToBlob(patternId, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const pathname = `tire-images/${patternId}.${ext}`;
  
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });
  
  return blob.url;
}

async function processImage(image) {
  const { pattern_id, source_url, brand, pattern } = image;
  
  try {
    console.log(`  [${pattern_id}] Downloading from TireLibrary...`);
    const result = await downloadImage(source_url);
    
    if (result.notFound) {
      console.log(`  [${pattern_id}] Not found on TireLibrary`);
      await markNotFound(pattern_id);
      return { status: 'not_found' };
    }
    
    console.log(`  [${pattern_id}] Uploading to Vercel Blob (${(result.size / 1024).toFixed(1)}KB)...`);
    const blobUrl = await uploadToBlob(pattern_id, result.buffer, result.contentType);
    
    await markUploaded(pattern_id, blobUrl, result.contentType, result.size);
    console.log(`  [${pattern_id}] ✓ ${blobUrl}`);
    
    return { status: 'uploaded', url: blobUrl };
  } catch (err) {
    console.error(`  [${pattern_id}] ✗ ${err.message}`);
    await markFailed(pattern_id, err.message);
    return { status: 'failed', error: err.message };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Commands ============

async function cmdStatus() {
  await ensureTable();
  const stats = await getStats();
  
  console.log('\n=== Tire Image Import Status ===\n');
  
  let total = 0;
  for (const row of stats) {
    console.log(`  ${row.status.padEnd(12)} ${row.count}`);
    total += parseInt(row.count);
  }
  console.log(`  ${'TOTAL'.padEnd(12)} ${total}\n`);
}

async function cmdSearchAndSeed(size) {
  await ensureTable();
  
  console.log(`\nSearching TireWire for size ${size}...`);
  const patterns = await searchTireWire(size);
  console.log(`Found ${patterns.length} unique patterns\n`);
  
  let added = 0;
  for (const p of patterns) {
    await upsertTireImage(p.patternId, p.brand, p.pattern);
    added++;
  }
  
  console.log(`Added/updated ${added} tire images to queue\n`);
}

async function cmdSeedCommon() {
  await ensureTable();
  
  console.log('\nSeeding database with common tire sizes...\n');
  
  let totalPatterns = 0;
  
  for (const size of COMMON_SIZES) {
    console.log(`Searching ${size}...`);
    try {
      const patterns = await searchTireWire(size);
      
      for (const p of patterns) {
        await upsertTireImage(p.patternId, p.brand, p.pattern);
      }
      
      console.log(`  Found ${patterns.length} patterns`);
      totalPatterns += patterns.length;
      
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }
  
  console.log(`\nTotal patterns queued: ${totalPatterns}\n`);
}

async function cmdImportPending() {
  await ensureTable();
  
  console.log('\nImporting pending tire images...\n');
  
  let processed = 0;
  let uploaded = 0;
  let failed = 0;
  let notFound = 0;
  
  while (true) {
    const pending = await getPendingImages(BATCH_SIZE);
    if (pending.length === 0) break;
    
    console.log(`Processing batch of ${pending.length}...`);
    
    for (const image of pending) {
      const result = await processImage(image);
      processed++;
      
      if (result.status === 'uploaded') uploaded++;
      else if (result.status === 'failed') failed++;
      else if (result.status === 'not_found') notFound++;
      
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\n=== Import Complete ===`);
  console.log(`  Processed:  ${processed}`);
  console.log(`  Uploaded:   ${uploaded}`);
  console.log(`  Not found:  ${notFound}`);
  console.log(`  Failed:     ${failed}\n`);
}

async function cmdRetryFailed() {
  await ensureTable();
  
  console.log('\nRetrying failed imports...\n');
  
  // Reset failed to pending
  const p = getPool();
  const { rowCount } = await p.query(`
    UPDATE tire_images SET status = 'pending', error_message = NULL
    WHERE status = 'failed'
  `);
  
  console.log(`Reset ${rowCount} failed images to pending\n`);
  
  if (rowCount > 0) {
    await cmdImportPending();
  }
}

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  
  // Only require BLOB token for actual uploads
  const needsBlob = !args.includes('--status') && !args.includes('--help');
  if (needsBlob && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN is required for importing images');
    console.error('Get it from: Vercel Dashboard → Storage → Blob → Settings');
    process.exit(1);
  }
  
  try {
    if (args.includes('--status')) {
      await cmdStatus();
    } else if (args.includes('--size')) {
      const idx = args.indexOf('--size');
      const size = args[idx + 1];
      if (!size) {
        console.error('Error: --size requires a value (e.g., --size 2256517)');
        process.exit(1);
      }
      await cmdSearchAndSeed(size);
    } else if (args.includes('--seed-common')) {
      await cmdSeedCommon();
    } else if (args.includes('--retry-failed')) {
      await cmdRetryFailed();
    } else if (args.includes('--import') || args.length === 0) {
      await cmdImportPending();
    } else {
      console.log(`
Tire Image Import Script

Usage:
  node import.js                    Import all pending images
  node import.js --status           Show import status
  node import.js --size 2256517     Search TireWire for size and queue
  node import.js --seed-common      Queue images for all common tire sizes
  node import.js --retry-failed     Retry failed imports
      `);
    }
  } finally {
    if (pool) await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
