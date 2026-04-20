/**
 * Import extracted KMC + Moto Metal vehicle photos into gallery_assets
 * Uses CloudFront URLs from Canto extraction
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

const DRY_RUN = process.argv.includes('--dry-run');
const EXTRACTED_DIR = path.join(__dirname, 'extracted');

// ============================================================================
// Vehicle Parsing from album names like "ARCHER 2024 CHEVROLET COLORADO"
// ============================================================================
const MAKE_NORMALIZATIONS = {
  'CHEVY': 'Chevrolet', 'CHEVROLET': 'Chevrolet', 'DODGE': 'Dodge',
  'FORD': 'Ford', 'GMC': 'GMC', 'JEEP': 'Jeep', 'LEXUS': 'Lexus',
  'RAM': 'RAM', 'TOYOTA': 'Toyota', 'NISSAN': 'Nissan', 'HONDA': 'Honda',
  'SUBARU': 'Subaru', 'MAZDA': 'Mazda', 'CADILLAC': 'Cadillac',
  'LINCOLN': 'Lincoln', 'HYUNDAI': 'Hyundai', 'KIA': 'Kia',
  'RANGE': 'Land Rover', 'SUZUKI': 'Suzuki', 'MASTERCRAFT': 'Mastercraft'
};

const KNOWN_MODELS = [
  'COLORADO', 'SILVERADO', 'TACOMA', 'TUNDRA', 'F-150', 'F150', 'F-250', 'F250',
  'RANGER', 'BRONCO', 'WRANGLER', 'GLADIATOR', '4RUNNER', 'SEQUOIA', 'LAND CRUISER',
  'SIERRA', 'CANYON', 'YUKON', 'TAHOE', 'SUBURBAN', 'EXPEDITION', 'EXPLORER',
  'RAM 1500', 'RAM 2500', 'RAM 3500', '1500', '2500', '3500', 'GRAND CHEROKEE',
  'CHEROKEE', 'COMPASS', 'RENEGADE', 'DURANGO', 'CHARGER', 'CHALLENGER',
  'MUSTANG', 'CAMARO', 'CORVETTE', 'OUTBACK', 'FORESTER', 'CROSSTREK', 'CX-5', 'CX-50'
];

function parseAlbumName(albumName, brand) {
  // Examples: 
  // "ARCHER 2024 CHEVROLET COLORADO" (with year)
  // "KM235 Ford F150" (no year)
  // "MO970 20x10 Chevy Silverado" (with size prefix)
  
  const parts = albumName.toUpperCase().split(/[\s_]+/);
  
  // Find year (4 digits starting with 19 or 20)
  const yearIdx = parts.findIndex(p => /^(19|20)\d{2}$/.test(p));
  
  let wheelModel, year, makeIdx;
  
  if (yearIdx !== -1) {
    // Has year
    wheelModel = parts.slice(0, yearIdx).join(' ');
    year = parseInt(parts[yearIdx]);
    makeIdx = yearIdx + 1;
  } else {
    // No year - find where make starts by looking for known makes
    const makeNames = Object.keys(MAKE_NORMALIZATIONS);
    makeIdx = parts.findIndex(p => makeNames.includes(p));
    
    if (makeIdx === -1) return null; // Can't find make
    
    wheelModel = parts.slice(0, makeIdx).join(' ');
    // Filter out size specs like "20x10"
    wheelModel = wheelModel.replace(/\d+X\d+/g, '').trim();
    year = null; // Unknown year
  }
  
  const remaining = parts.slice(makeIdx);
  if (remaining.length === 0) return null;
  
  // First remaining part is make
  const rawMake = remaining[0];
  const make = MAKE_NORMALIZATIONS[rawMake] || rawMake;
  
  // Rest is model (join remaining parts)
  let model = remaining.slice(1).join(' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\d+X\d+/g, '') // Remove size specs
    .replace(/\s*\d+\s*$/, '') // Remove trailing numbers like "2"
    .trim();
  
  // Handle "Jeep" with no model -> default to "Wrangler"
  if (make === 'Jeep' && (!model || model === 'JL')) model = 'Wrangler';
  if (!model && make === 'Ford') model = 'F-150';
  
  return { wheelModel, year, make, model: model || 'Unknown' };
}

// ============================================================================
// Main Import
// ============================================================================
async function importBrand(filename, brand) {
  const filepath = path.join(EXTRACTED_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${filename} not found, skipping`);
    return { albums: 0, images: 0, inserted: 0, updated: 0, failed: 0 };
  }
  
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const albums = data.albums || [];
  
  let inserted = 0, updated = 0, failed = 0, totalImages = 0;
  
  for (const album of albums) {
    const parsed = parseAlbumName(album.name, brand);
    if (!parsed) {
      console.log(`  ⚠️  Could not parse: ${album.name}`);
      failed++;
      continue;
    }
    
    for (const img of (album.images || [])) {
      totalImages++;
      
      if (DRY_RUN) continue;
      
      try {
        // Upsert based on source_url (the CDN URL is the unique identifier)
        const result = await pool.query(`
          INSERT INTO gallery_assets (
            wheel_brand, wheel_model, vehicle_year, vehicle_make, vehicle_model,
            source_url, cdn_url, source_album_name, parse_confidence, media_type,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'high', 'image', NOW(), NOW())
          ON CONFLICT (source_url) DO UPDATE SET
            cdn_url = EXCLUDED.cdn_url,
            wheel_brand = EXCLUDED.wheel_brand,
            wheel_model = EXCLUDED.wheel_model,
            vehicle_year = EXCLUDED.vehicle_year,
            vehicle_make = EXCLUDED.vehicle_make,
            vehicle_model = EXCLUDED.vehicle_model,
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [brand, parsed.wheelModel, parsed.year, parsed.make, parsed.model, img.url, album.name]);
        
        if (result.rows[0]?.is_insert) inserted++;
        else updated++;
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        failed++;
      }
    }
  }
  
  return { albums: albums.length, images: totalImages, inserted, updated, failed };
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GALLERY IMPORT - ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Check for unique constraint on source_url
  const { rows: constraints } = await pool.query(`
    SELECT constraint_name FROM information_schema.table_constraints 
    WHERE table_name = 'gallery_assets' AND constraint_type = 'UNIQUE'
  `);
  
  if (!constraints.some(c => c.constraint_name.includes('source_url'))) {
    console.log('Adding unique constraint on source_url...');
    if (!DRY_RUN) {
      await pool.query(`
        ALTER TABLE gallery_assets 
        ADD CONSTRAINT gallery_assets_source_url_key UNIQUE (source_url)
      `).catch(() => console.log('  (constraint may already exist)'));
    }
  }
  
  const results = {};
  
  // Import KMC
  console.log('📦 Importing KMC...');
  results.KMC = await importBrand('kmc-full.json', 'KMC');
  console.log(`   Albums: ${results.KMC.albums}, Images: ${results.KMC.images}`);
  console.log(`   Inserted: ${results.KMC.inserted}, Updated: ${results.KMC.updated}, Failed: ${results.KMC.failed}`);
  
  // Import Moto Metal
  console.log('\n📦 Importing Moto Metal...');
  results['Moto Metal'] = await importBrand('motometal-full.json', 'Moto Metal');
  console.log(`   Albums: ${results['Moto Metal'].albums}, Images: ${results['Moto Metal'].images}`);
  console.log(`   Inserted: ${results['Moto Metal'].inserted}, Updated: ${results['Moto Metal'].updated}, Failed: ${results['Moto Metal'].failed}`);
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  let totalInserted = 0, totalImages = 0;
  for (const [brand, r] of Object.entries(results)) {
    console.log(`${brand}: ${r.images} images from ${r.albums} albums`);
    totalInserted += r.inserted;
    totalImages += r.images;
  }
  console.log(`\nTotal: ${totalImages} images`);
  if (!DRY_RUN) console.log(`Inserted: ${totalInserted}`);
  
  // Verify final state
  if (!DRY_RUN) {
    const { rows } = await pool.query(`
      SELECT wheel_brand, COUNT(*) as cnt, COUNT(cdn_url) as with_cdn
      FROM gallery_assets WHERE cdn_url IS NOT NULL
      GROUP BY wheel_brand ORDER BY cnt DESC
    `);
    console.log('\n=== Final gallery_assets with CDN URLs ===');
    rows.forEach(r => console.log(`  ${r.wheel_brand}: ${r.cnt}`));
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  pool.end();
  process.exit(1);
});
