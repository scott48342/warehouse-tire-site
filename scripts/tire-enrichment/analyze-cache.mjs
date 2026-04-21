/**
 * Phase 1: Analyze fitment-research cache for tire size data
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const CACHE_ROOT = 'C:\\Users\\Scott-Pc\\clawd\\fitment-research\\cache';

// Load DB connection
const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Get all vehicles missing tire sizes from DB
async function getMissingTireSizes() {
  const result = await pool.query(`
    SELECT DISTINCT 
      year, 
      make,
      model,
      display_trim,
      modification_id
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL 
       OR oem_tire_sizes::text = '' 
       OR oem_tire_sizes::text = '[]'
    ORDER BY make, model, year
  `);
  return result.rows;
}

// Normalize make/model for cache lookup
function normalizeMake(make) {
  // Handle special cases
  const mapping = {
    'mercedes': 'Mercedes-Benz',
    'mercedes-benz': 'Mercedes-Benz',
    'land rover': 'Land Rover',
    'land-rover': 'Land Rover',
    'alfa romeo': 'Alfa Romeo',
    'alfa-romeo': 'Alfa Romeo',
    'aston martin': 'Aston Martin',
    'aston-martin': 'Aston Martin',
    'rolls-royce': 'Rolls-Royce',
    'rolls royce': 'Rolls-Royce',
  };
  const lower = make.toLowerCase();
  if (mapping[lower]) return mapping[lower];
  // Title case
  return make.split(/[-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function normalizeModel(model) {
  // Convert "mustang" to "Mustang", "f-150" to "F-150", etc.
  return model.split(/[-\s]/).map(w => {
    if (w.match(/^\d/)) return w.toUpperCase(); // F-150, 300C
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join('-');
}

// Scan cache directory for tire data
function scanCacheForTires() {
  const tireData = new Map(); // key: "make|model|year" -> tire sizes
  
  if (!fs.existsSync(CACHE_ROOT)) {
    console.log('Cache root not found:', CACHE_ROOT);
    return tireData;
  }
  
  const makes = fs.readdirSync(CACHE_ROOT);
  let filesScanned = 0;
  let filesWithTires = 0;
  
  for (const make of makes) {
    const makePath = path.join(CACHE_ROOT, make);
    if (!fs.statSync(makePath).isDirectory()) continue;
    
    const models = fs.readdirSync(makePath);
    for (const model of models) {
      const modelPath = path.join(makePath, model);
      if (!fs.statSync(modelPath).isDirectory()) continue;
      
      const yearFiles = fs.readdirSync(modelPath).filter(f => f.endsWith('.json'));
      for (const yearFile of yearFiles) {
        filesScanned++;
        const year = yearFile.replace('.json', '');
        const filePath = path.join(modelPath, yearFile);
        
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          
          // Look for tire sizes in various places
          let tireSizes = [];
          
          // Check fitment.oem_tire_sizes (primary location)
          if (content.fitment?.oem_tire_sizes && Array.isArray(content.fitment.oem_tire_sizes)) {
            tireSizes = content.fitment.oem_tire_sizes;
          }
          // Check fitment.tire_sizes
          else if (content.fitment?.tire_sizes && Array.isArray(content.fitment.tire_sizes)) {
            tireSizes = content.fitment.tire_sizes;
          }
          // Check top-level tire_sizes
          else if (content.tire_sizes && Array.isArray(content.tire_sizes)) {
            tireSizes = content.tire_sizes;
          }
          // Check top-level oem_tire_sizes
          else if (content.oem_tire_sizes && Array.isArray(content.oem_tire_sizes)) {
            tireSizes = content.oem_tire_sizes;
          }
          
          if (tireSizes.length > 0) {
            filesWithTires++;
            // Store with normalized lowercase key for matching
            const key = `${make.toLowerCase()}|${model.toLowerCase()}|${year}`;
            tireData.set(key, {
              tireSizes: [...new Set(tireSizes)],
              cacheMake: make,
              cacheModel: model,
            });
          }
        } catch (e) {
          // Skip bad files
        }
      }
    }
  }
  
  console.log(`Cache scan: ${filesScanned} files, ${filesWithTires} with tire data`);
  return tireData;
}

// Match cache data to missing records
async function matchAndReport() {
  console.log('Fetching vehicles missing tire sizes...');
  const missing = await getMissingTireSizes();
  console.log(`Found ${missing.length} fitment records missing tire sizes\n`);
  
  console.log('Scanning cache for tire data...');
  const cacheData = scanCacheForTires();
  console.log(`Cache has tire data for ${cacheData.size} year/make/model combinations\n`);
  
  // Debug: Show some cache keys
  console.log('Sample cache keys:');
  let count = 0;
  for (const [key, val] of cacheData) {
    if (count++ < 5) console.log(`  ${key}: ${val.tireSizes.join(', ')}`);
  }
  console.log('');
  
  // Try to match
  let matchCount = 0;
  const matches = [];
  const noMatch = [];
  
  for (const row of missing) {
    // Build lookup keys
    const make = row.make.toLowerCase();
    const modelVariants = [
      row.model.toLowerCase(),
      row.model.toLowerCase().replace(/ /g, '-'),
      row.model.toLowerCase().replace(/-/g, ' '),
    ];
    
    let found = null;
    for (const model of modelVariants) {
      const key = `${make}|${model}|${row.year}`;
      if (cacheData.has(key)) {
        found = cacheData.get(key);
        break;
      }
    }
    
    // Also try with normalized make names
    if (!found) {
      const normalizedMake = normalizeMake(row.make).toLowerCase();
      for (const model of modelVariants) {
        const key = `${normalizedMake}|${model}|${row.year}`;
        if (cacheData.has(key)) {
          found = cacheData.get(key);
          break;
        }
      }
    }
    
    if (found) {
      matchCount++;
      matches.push({
        year: row.year,
        make: row.make,
        model: row.model,
        modification_id: row.modification_id,
        tireSizes: found.tireSizes,
      });
    } else {
      noMatch.push(row);
    }
  }
  
  console.log('=== MATCH RESULTS ===');
  console.log(`Total missing: ${missing.length}`);
  console.log(`Matches from cache: ${matchCount} (${(matchCount/missing.length*100).toFixed(1)}%)`);
  console.log(`Still missing: ${noMatch.length}`);
  
  // Sample matches
  console.log('\n=== SAMPLE MATCHES (first 15) ===');
  matches.slice(0, 15).forEach(m => {
    console.log(`  ${m.year} ${m.make} ${m.model}: ${m.tireSizes.join(', ')}`);
  });
  
  // Save matches for enrichment
  fs.writeFileSync(
    'scripts/tire-enrichment/cache-matches.json',
    JSON.stringify(matches, null, 2)
  );
  console.log(`\nSaved ${matches.length} matches to cache-matches.json`);
  
  // Analyze what's still missing
  const missingByMake = {};
  for (const row of noMatch) {
    missingByMake[row.make] = (missingByMake[row.make] || 0) + 1;
  }
  
  console.log('\n=== STILL MISSING BY MAKE (top 15) ===');
  Object.entries(missingByMake)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([make, count]) => {
      console.log(`  ${make}: ${count}`);
    });
  
  await pool.end();
  return { matches, noMatch };
}

matchAndReport().catch(console.error);
