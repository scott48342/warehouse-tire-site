/**
 * Auto-fix priority fitment gaps
 * 
 * Fetches high-priority gaps from the API, searches for fitment data,
 * and adds missing vehicles to the database.
 * 
 * Usage: node scripts/tire-enrichment/auto-fix-priority.mjs [--limit=10] [--dry-run]
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

// Known fitment data for common US vehicles
const KNOWN_FITMENTS = {
  // Trucks
  'nissan|frontier': { bolt: '6x114.3', hub: 66.1, offset: [10, 45], tires: ['265/70R17', '265/65R18', '275/55R20'], wheels: [{d:17,w:7.5,o:30},{d:18,w:7.5,o:30},{d:20,w:8.5,o:35}] },
  'gmc|yukon': { bolt: '6x139.7', hub: 78.1, offset: [20, 44], tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}] },
  'gmc|sierra': { bolt: '6x139.7', hub: 78.1, offset: [20, 44], tires: ['265/70R17', '275/60R20', '275/55R22'], wheels: [{d:17,w:8,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}] },
  'chevrolet|silverado': { bolt: '6x139.7', hub: 78.1, offset: [20, 44], tires: ['265/70R17', '275/60R20', '275/55R22'], wheels: [{d:17,w:8,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}] },
  'chevrolet|tahoe': { bolt: '6x139.7', hub: 78.1, offset: [20, 44], tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}] },
  'chevrolet|suburban': { bolt: '6x139.7', hub: 78.1, offset: [20, 44], tires: ['275/65R18', '275/60R20', '285/45R22'], wheels: [{d:18,w:8.5,o:24},{d:20,w:9,o:24},{d:22,w:9,o:28}] },
  'ford|f-150': { bolt: '6x135', hub: 87.1, offset: [25, 50], tires: ['265/70R17', '275/65R18', '275/55R20', '275/45R22'], wheels: [{d:17,w:7.5,o:44},{d:18,w:8.5,o:44},{d:20,w:8.5,o:44},{d:22,w:9,o:44}] },
  'ram|1500': { bolt: '6x139.7', hub: 77.8, offset: [20, 35], tires: ['275/65R18', '275/55R20', '285/45R22'], wheels: [{d:18,w:8,o:24},{d:20,w:9,o:19},{d:22,w:9,o:19}] },
  'toyota|tundra': { bolt: '6x139.7', hub: 106.1, offset: [0, 60], tires: ['275/65R18', '275/55R20', '305/45R22'], wheels: [{d:18,w:8,o:45},{d:20,w:8,o:45},{d:22,w:9,o:35}] },
  'toyota|tacoma': { bolt: '6x139.7', hub: 106.1, offset: [0, 30], tires: ['245/75R16', '265/70R17', '265/65R18'], wheels: [{d:16,w:7,o:15},{d:17,w:7.5,o:25},{d:18,w:7.5,o:25}] },
  
  // SUVs
  'toyota|4runner': { bolt: '6x139.7', hub: 106.1, offset: [0, 30], tires: ['265/70R17', '265/65R18', '265/55R20'], wheels: [{d:17,w:7,o:15},{d:18,w:7.5,o:25},{d:20,w:8,o:20}] },
  'toyota|highlander': { bolt: '5x114.3', hub: 60.1, offset: [35, 50], tires: ['235/65R18', '235/55R20'], wheels: [{d:18,w:7.5,o:45},{d:20,w:8,o:40}] },
  'toyota|rav4': { bolt: '5x114.3', hub: 60.1, offset: [35, 50], tires: ['225/65R17', '225/60R18', '235/55R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:40},{d:19,w:7.5,o:40}] },
  'honda|cr-v': { bolt: '5x114.3', hub: 64.1, offset: [40, 55], tires: ['235/65R17', '235/60R18', '235/55R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:50},{d:19,w:7.5,o:45}] },
  'honda|pilot': { bolt: '5x120', hub: 64.1, offset: [40, 55], tires: ['245/60R18', '255/55R20'], wheels: [{d:18,w:8,o:50},{d:20,w:8.5,o:50}] },
  'jeep|wrangler': { bolt: '5x127', hub: 71.5, offset: [-12, 50], tires: ['255/70R18', '285/70R17', '315/70R17'], wheels: [{d:17,w:7.5,o:44},{d:18,w:7.5,o:44},{d:17,w:9,o:-12}] },
  'jeep|grand cherokee': { bolt: '5x127', hub: 71.5, offset: [40, 56], tires: ['265/60R18', '265/50R20', '295/45R21'], wheels: [{d:18,w:8,o:50},{d:20,w:8.5,o:50},{d:21,w:9,o:50}] },
  'ford|explorer': { bolt: '6x135', hub: 87.1, offset: [40, 55], tires: ['255/65R18', '255/55R20', '275/45R21'], wheels: [{d:18,w:8,o:45},{d:20,w:8.5,o:45},{d:21,w:9,o:45}] },
  'ford|bronco': { bolt: '6x139.7', hub: 93.1, offset: [-10, 35], tires: ['255/70R18', '275/70R17', '315/70R17'], wheels: [{d:17,w:8,o:25},{d:18,w:8,o:25},{d:17,w:9,o:0}] },
  'dodge|durango': { bolt: '5x127', hub: 71.5, offset: [18, 56], tires: ['265/60R18', '265/50R20', '295/45R21'], wheels: [{d:18,w:8,o:50},{d:20,w:8.5,o:45},{d:21,w:9,o:42}] },
  
  // Sedans/Cars
  'toyota|camry': { bolt: '5x114.3', hub: 60.1, offset: [38, 55], tires: ['205/65R16', '215/55R17', '235/45R18', '235/40R19'], wheels: [{d:16,w:7,o:45},{d:17,w:7,o:45},{d:18,w:8,o:40},{d:19,w:8,o:38}] },
  'toyota|corolla': { bolt: '5x114.3', hub: 60.1, offset: [40, 50], tires: ['195/65R15', '205/55R16', '225/40R18'], wheels: [{d:15,w:6,o:45},{d:16,w:6.5,o:45},{d:18,w:7.5,o:40}] },
  'honda|accord': { bolt: '5x114.3', hub: 64.1, offset: [40, 55], tires: ['225/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7.5,o:50},{d:18,w:8,o:50},{d:19,w:8.5,o:45}] },
  'honda|civic': { bolt: '5x114.3', hub: 64.1, offset: [40, 55], tires: ['215/55R16', '215/50R17', '235/40R18'], wheels: [{d:16,w:7,o:45},{d:17,w:7,o:45},{d:18,w:8,o:40}] },
  'nissan|altima': { bolt: '5x114.3', hub: 66.1, offset: [40, 50], tires: ['215/60R16', '235/45R18', '235/40R19'], wheels: [{d:16,w:7,o:45},{d:18,w:8,o:40},{d:19,w:8,o:40}] },
  'nissan|maxima': { bolt: '5x114.3', hub: 66.1, offset: [40, 55], tires: ['245/45R18', '245/40R19'], wheels: [{d:18,w:8,o:45},{d:19,w:8.5,o:45}] },
  'hyundai|sonata': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['205/65R16', '215/55R17', '235/45R18', '245/40R19'], wheels: [{d:16,w:6.5,o:45},{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:8,o:45}] },
  'hyundai|tucson': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['225/60R17', '235/55R18', '235/50R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:19,w:7.5,o:45}] },
  'kia|optima': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['205/65R16', '215/55R17', '235/45R18'], wheels: [{d:16,w:6.5,o:45},{d:17,w:7,o:45},{d:18,w:7.5,o:45}] },
  'kia|sorento': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['235/65R17', '235/60R18', '255/45R20'], wheels: [{d:17,w:7,o:45},{d:18,w:7.5,o:45},{d:20,w:8,o:40}] },
  'volkswagen|jetta': { bolt: '5x112', hub: 57.1, offset: [40, 55], tires: ['205/55R16', '225/45R17', '225/40R18'], wheels: [{d:16,w:7,o:46},{d:17,w:7,o:46},{d:18,w:7.5,o:46}] },
  'volkswagen|passat': { bolt: '5x112', hub: 57.1, offset: [40, 55], tires: ['215/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7,o:46},{d:18,w:8,o:46},{d:19,w:8,o:46}] },
  'volkswagen|tiguan': { bolt: '5x112', hub: 57.1, offset: [40, 55], tires: ['215/65R17', '235/55R18', '235/50R19', '255/40R20'], wheels: [{d:17,w:7,o:43},{d:18,w:7.5,o:43},{d:19,w:8,o:43},{d:20,w:8,o:40}] },
  'mazda|mazda6': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['205/60R16', '225/55R17', '225/45R19'], wheels: [{d:16,w:7,o:50},{d:17,w:7.5,o:50},{d:19,w:7.5,o:45}] },
  'mazda|cx-5': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['225/65R17', '225/55R19'], wheels: [{d:17,w:7,o:50},{d:19,w:7,o:45}] },
  'mazda|cx-9': { bolt: '5x114.3', hub: 67.1, offset: [40, 55], tires: ['255/60R18', '255/50R20'], wheels: [{d:18,w:7.5,o:45},{d:20,w:8.5,o:40}] },
  'subaru|outback': { bolt: '5x114.3', hub: 56.1, offset: [40, 55], tires: ['225/65R17', '225/60R18'], wheels: [{d:17,w:7,o:48},{d:18,w:7,o:48}] },
  'subaru|forester': { bolt: '5x114.3', hub: 56.1, offset: [40, 55], tires: ['225/60R17', '225/55R18'], wheels: [{d:17,w:7,o:48},{d:18,w:7,o:48}] },
  'subaru|ascent': { bolt: '5x114.3', hub: 56.1, offset: [40, 55], tires: ['245/60R18', '245/50R20'], wheels: [{d:18,w:7.5,o:48},{d:20,w:8,o:45}] },
  'dodge|challenger': { bolt: '5x115', hub: 71.5, offset: [18, 42], tires: ['245/45R20', '275/40R20', '305/35R20'], wheels: [{d:20,w:9,o:20},{d:20,w:9.5,o:20},{d:20,w:11,o:18}] },
  'dodge|charger': { bolt: '5x115', hub: 71.5, offset: [18, 42], tires: ['245/45R20', '275/40R20'], wheels: [{d:20,w:8,o:24},{d:20,w:9,o:20}] },
  'ford|mustang': { bolt: '5x114.3', hub: 70.5, offset: [30, 55], tires: ['235/55R17', '255/40R19', '275/35R19', '275/40R19', '305/30R19'], wheels: [{d:17,w:8,o:45},{d:19,w:9,o:45},{d:19,w:9.5,o:45},{d:19,w:10,o:40},{d:19,w:11,o:53}] },
  'chevrolet|camaro': { bolt: '5x120', hub: 66.9, offset: [30, 58], tires: ['245/45R20', '275/35R20', '285/30R20', '305/30R20'], wheels: [{d:20,w:8.5,o:30},{d:20,w:9,o:30},{d:20,w:10,o:35},{d:20,w:11,o:43}] },
  
  // Crossovers
  'nissan|rogue': { bolt: '5x114.3', hub: 66.1, offset: [40, 55], tires: ['225/65R17', '225/60R18', '235/50R19'], wheels: [{d:17,w:7,o:45},{d:18,w:7,o:45},{d:19,w:7.5,o:40}] },
  'toyota|venza': { bolt: '5x114.3', hub: 60.1, offset: [35, 50], tires: ['225/60R18', '235/50R19'], wheels: [{d:18,w:7.5,o:45},{d:19,w:8,o:40}] },
  'ford|escape': { bolt: '5x108', hub: 63.4, offset: [45, 55], tires: ['225/65R17', '225/60R18', '235/50R19'], wheels: [{d:17,w:7,o:50},{d:18,w:7.5,o:50},{d:19,w:7.5,o:50}] },
  'chevrolet|equinox': { bolt: '5x120', hub: 67.1, offset: [40, 55], tires: ['225/65R17', '235/55R18', '245/45R19'], wheels: [{d:17,w:7,o:50},{d:18,w:7.5,o:50},{d:19,w:8,o:45}] },
  
  // Minivans
  'honda|odyssey': { bolt: '5x120', hub: 64.1, offset: [40, 55], tires: ['235/60R18', '235/55R19'], wheels: [{d:18,w:7.5,o:50},{d:19,w:8,o:50}] },
  'toyota|sienna': { bolt: '5x114.3', hub: 60.1, offset: [35, 55], tires: ['235/60R18', '235/55R19', '235/50R20'], wheels: [{d:18,w:7.5,o:45},{d:19,w:8,o:45},{d:20,w:8,o:40}] },
  'chrysler|pacifica': { bolt: '5x127', hub: 71.5, offset: [40, 56], tires: ['235/65R17', '235/60R18', '235/50R20'], wheels: [{d:17,w:7,o:43},{d:18,w:7.5,o:43},{d:20,w:8,o:40}] },
  
  // Luxury
  'lexus|rx': { bolt: '5x114.3', hub: 60.1, offset: [35, 55], tires: ['235/65R18', '235/55R20', '235/50R21'], wheels: [{d:18,w:8,o:30},{d:20,w:8,o:30},{d:21,w:8.5,o:30}] },
  'lexus|es': { bolt: '5x114.3', hub: 60.1, offset: [35, 50], tires: ['215/55R17', '235/45R18', '235/40R19'], wheels: [{d:17,w:7,o:45},{d:18,w:8,o:45},{d:19,w:8,o:40}] },
  'acura|mdx': { bolt: '5x120', hub: 64.1, offset: [40, 55], tires: ['255/55R19', '275/45R20', '275/40R21'], wheels: [{d:19,w:8,o:50},{d:20,w:9,o:50},{d:21,w:9.5,o:50}] },
  'acura|rdx': { bolt: '5x114.3', hub: 64.1, offset: [40, 55], tires: ['255/55R19', '255/45R20'], wheels: [{d:19,w:8,o:50},{d:20,w:8.5,o:50}] },
  'infiniti|qx60': { bolt: '5x114.3', hub: 66.1, offset: [40, 55], tires: ['235/65R18', '255/50R20'], wheels: [{d:18,w:7.5,o:50},{d:20,w:8,o:45}] },
  'mini|clubman': { bolt: '5x112', hub: 66.6, offset: [45, 55], tires: ['205/55R17', '225/45R18', '225/40R19'], wheels: [{d:17,w:7,o:48},{d:18,w:7.5,o:48},{d:19,w:8,o:48}] },
  'mini|countryman': { bolt: '5x112', hub: 66.6, offset: [45, 55], tires: ['225/55R17', '225/50R18', '225/45R19'], wheels: [{d:17,w:7,o:48},{d:18,w:7.5,o:48},{d:19,w:8,o:48}] },
};

async function fetchPriorityGaps() {
  const url = 'https://shop.warehousetiredirect.com/api/admin/fitment-gaps?report=priority';
  const res = await fetch(url);
  const data = await res.json();
  return data.vehicles || [];
}

function findFitment(make, model) {
  const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
  if (KNOWN_FITMENTS[key]) return KNOWN_FITMENTS[key];
  
  // Try partial match (e.g., "1500" for "silverado 1500")
  for (const [k, v] of Object.entries(KNOWN_FITMENTS)) {
    const [m, mo] = k.split('|');
    if (m === make.toLowerCase() && model.toLowerCase().includes(mo)) return v;
  }
  return null;
}

async function main() {
  console.log(`Fetching priority gaps (limit: ${limit})...\n`);
  
  const gaps = await fetchPriorityGaps();
  if (!gaps.length) {
    console.log('No priority gaps found!');
    await pool.end();
    return;
  }
  
  console.log(`Found ${gaps.length} priority gaps. Processing top ${limit}...\n`);
  
  const client = await pool.connect();
  let added = 0, updated = 0, skipped = 0;
  
  try {
    for (const gap of gaps.slice(0, limit)) {
      const { year, make, model } = gap;
      
      // Check if already exists
      const existing = await client.query(
        `SELECT id, oem_tire_sizes FROM vehicle_fitments WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3`,
        [year, make, model]
      );
      
      if (existing.rows.length > 0 && existing.rows[0].oem_tire_sizes?.length > 0) {
        console.log(`⏭️  ${year} ${make} ${model} - already has data`);
        skipped++;
        continue;
      }
      
      const fitment = findFitment(make, model);
      if (!fitment) {
        console.log(`❌ ${year} ${make} ${model} - no known fitment data`);
        skipped++;
        continue;
      }
      
      if (dryRun) {
        console.log(`🔍 ${year} ${make} ${model} - would add: ${fitment.tires.join(', ')}`);
        continue;
      }
      
      if (existing.rows.length > 0) {
        // Update
        await client.query(`
          UPDATE vehicle_fitments SET
            bolt_pattern = $1, center_bore_mm = $2,
            offset_min_mm = $3, offset_max_mm = $4,
            oem_tire_sizes = $5, oem_wheel_sizes = $6,
            updated_at = NOW()
          WHERE year = $7 AND make ILIKE $8 AND model ILIKE $9
        `, [fitment.bolt, fitment.hub, fitment.offset[0], fitment.offset[1],
            JSON.stringify(fitment.tires), JSON.stringify(fitment.wheels),
            year, make, model]);
        console.log(`✅ ${year} ${make} ${model} - updated`);
        updated++;
      } else {
        // Insert
        const modId = `${model.toLowerCase().replace(/\s+/g, '-')}-${year}-base`;
        await client.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, display_trim,
            bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
            oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'priority-fix', NOW(), NOW())
        `, [year, make, model, modId, 'Base',
            fitment.bolt, fitment.hub, fitment.offset[0], fitment.offset[1],
            JSON.stringify(fitment.tires), JSON.stringify(fitment.wheels)]);
        console.log(`✅ ${year} ${make} ${model} - added`);
        added++;
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Added: ${added}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    if (dryRun) console.log('(dry run - no changes made)');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
