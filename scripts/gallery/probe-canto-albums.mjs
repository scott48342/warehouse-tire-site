/**
 * Probe Canto for albums matching brand patterns
 * Uses the REST API to check if specific album paths exist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CANTO_BASE = 'https://wheelpros.canto.com';
const PORTAL_ID = 'WheelPros';

// Known models for each brand (from our inventory)
const BRAND_MODELS = {
  kmc: [
    'MESA', 'IMPACT', 'GRS', 'IMS', 'TREK', 'CHASE', 'DIRTY HARRY', 'RECON',
    'ATTACK', 'SLIDE', 'DISTRICT', 'BULLY', 'RIOT', 'GRENADE', 'CARNAGE', 'OUTRUN'
  ],
  xd: [
    'ROCKSTAR', 'MONSTER', 'GRENADE', 'HOSS', 'BUCK', 'ADDICT', 'HEIST', 
    'FMJ', 'CHOPSTIX', 'SURGE', 'BONES', 'DELTA', 'SYNDICATE', 'MACHETE'
  ],
  motoMetal: [
    'LEGACY', 'COMBAT', 'TURBINE', 'SPIDER', 'STINGER', 'RAZOR', 'SIEGE',
    'BREAKOUT', 'SENTRY', 'KRAKEN', 'HURRICANE', 'FOLSOM', 'HYDRA'
  ],
  blackRhino: [
    'ARMORY', 'ARSENAL', 'SOL', 'DIAMONDBACK', 'ALPHA', 'RIVAL', 'AWOL',
    'BAHARI', 'XPLORER', 'OUTBACK', 'VOLL', 'TUSK', 'VOYAGER', 'ATLAS',
    'ARCHES', 'TROOPER', 'GUARD', 'CONGO', 'TEMBO', 'KUMA', 'BOXER'
  ],
  asanti: [
    'MOGUL', 'TIARA', 'ESQUIRE', 'ARISTOCRAT', 'DUKE', 'VICEROY', 'ENVOY',
    'WARTHOG', 'ANVIL', 'WORKHORSE', 'CLEAVER', 'MATAR', 'SIGMA', 'DYNASTY'
  ]
};

// Common vehicle makes/models
const VEHICLES = [
  'FORD F150', 'FORD F250', 'FORD F350', 'FORD BRONCO', 'FORD RANGER', 'FORD RAPTOR',
  'CHEVROLET SILVERADO', 'CHEVROLET TAHOE', 'CHEVROLET COLORADO', 'CHEVY SILVERADO',
  'GMC SIERRA', 'GMC YUKON',
  'RAM 1500', 'RAM 2500', 'RAM TRX', 'DODGE RAM',
  'TOYOTA TACOMA', 'TOYOTA TUNDRA', 'TOYOTA 4RUNNER', 'TOYOTA LAND CRUISER',
  'JEEP WRANGLER', 'JEEP GLADIATOR', 'JEEP RUBICON',
  'LEXUS GX'
];

// Generate album name patterns to search
function generateSearchPatterns(brand, models) {
  const patterns = [];
  for (const model of models) {
    // Model + Vehicle combos
    for (const vehicle of VEHICLES) {
      patterns.push(`${model} ${vehicle}`);
    }
    // Just model (some albums are like "ARMORY TOYOTA" without full vehicle)
    patterns.push(model);
  }
  return patterns;
}

// Test if an album exists by trying common path variations
async function probeAlbum(albumName) {
  // Try fetching via search
  const searchUrl = `${CANTO_BASE}/rest/v/${PORTAL_ID}/search?scheme=album&keyword=${encodeURIComponent(albumName)}&limit=10`;
  
  try {
    const res = await fetch(searchUrl, { timeout: 5000 });
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.results?.length > 0) {
      // Find exact or close matches
      const matches = data.results.filter(r => {
        const name = (r.name || r.displayName || '').toUpperCase();
        return name.includes(albumName.toUpperCase());
      });
      return matches;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Test direct album path (using known Fuel pattern)
async function testAlbumPath(pathCode) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/album/${pathCode}`;
  try {
    const res = await fetch(url, { timeout: 5000 });
    return res.ok;
  } catch {
    return false;
  }
}

// Search broadly for brand
async function searchBrand(brand) {
  const searchUrl = `${CANTO_BASE}/rest/v/${PORTAL_ID}/search?scheme=album&keyword=${encodeURIComponent(brand)}&limit=100`;
  
  console.log(`\n=== Searching for "${brand}" ===`);
  console.log(`URL: ${searchUrl}`);
  
  try {
    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.log(`  Status: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    console.log(`  Found: ${data.found || data.results?.length || 0} results`);
    
    if (data.results?.length > 0) {
      return data.results.map(r => ({
        name: r.name || r.displayName,
        path: r.id || r.scheme,
        url: r.url
      }));
    }
    return [];
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return [];
  }
}

// Search for vehicle + model combos
async function searchVehicleWheelCombos(wheelModel, make) {
  const keyword = `${wheelModel} ${make}`;
  const searchUrl = `${CANTO_BASE}/rest/v/${PORTAL_ID}/search?scheme=album&keyword=${encodeURIComponent(keyword)}&limit=20`;
  
  try {
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (data.results?.length > 0) {
      return data.results.map(r => ({
        name: r.name || r.displayName,
        path: r.id || r.scheme
      }));
    }
    return [];
  } catch {
    return [];
  }
}

async function run() {
  console.log('=== Probing Canto for Brand Albums ===\n');
  
  const allAlbums = {
    kmc: [],
    xd: [],
    motoMetal: [],
    blackRhino: [],
    asanti: []
  };
  
  // Strategy 1: Search by brand name directly
  for (const [brand, displayName] of [
    ['kmc', 'KMC'],
    ['xd', 'XD SERIES'],
    ['motoMetal', 'MOTO METAL'],
    ['blackRhino', 'BLACK RHINO'],
    ['asanti', 'ASANTI']
  ]) {
    const results = await searchBrand(displayName);
    if (results.length > 0) {
      allAlbums[brand] = results;
      console.log(`  Sample results:`);
      results.slice(0, 5).forEach(r => console.log(`    - ${r.name}: ${r.path}`));
    }
    
    // Also try wheel model + vehicle combos
    const models = BRAND_MODELS[brand].slice(0, 3);
    const makes = ['FORD', 'TOYOTA', 'JEEP'];
    
    for (const model of models) {
      for (const make of makes) {
        const combos = await searchVehicleWheelCombos(model, make);
        for (const c of combos) {
          if (!allAlbums[brand].find(a => a.path === c.path)) {
            allAlbums[brand].push(c);
          }
        }
        await new Promise(r => setTimeout(r, 100)); // Rate limit
      }
    }
  }
  
  // Save results
  console.log('\n=== Summary ===');
  for (const [brand, albums] of Object.entries(allAlbums)) {
    console.log(`${brand}: ${albums.length} albums found`);
    
    // Save to JSON file
    if (albums.length > 0) {
      const filename = `${brand}-albums.json`;
      fs.writeFileSync(
        path.join(__dirname, filename),
        JSON.stringify(albums, null, 2)
      );
      console.log(`  Saved to ${filename}`);
    }
  }
}

run().catch(console.error);
