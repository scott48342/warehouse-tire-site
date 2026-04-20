/**
 * Discover WheelPros Canto albums for different brands
 */

const CANTO_BASE = 'https://wheelpros.canto.com';
const PORTAL_ID = 'WheelPros';

// Known brand folders in Canto (from structure inspection)
const BRAND_FOLDERS = {
  'fuel': 'FUEL_LIBRARY',      // Fuel Off-Road
  'kmc': 'KMC_LIBRARY',        // KMC Wheels
  'motoMetal': 'MOTO_METAL_LIBRARY', // Moto Metal
  'xd': 'XD_LIBRARY',          // XD Series
  'blackRhino': 'BLACK_RHINO_LIBRARY', // Black Rhino
  'asanti': 'ASANTI_LIBRARY',  // Asanti
};

// Try to fetch the root tree/album listing
async function fetchAlbums(folderPath) {
  try {
    // Try album listing endpoint
    const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/tree/folder/${folderPath}`;
    console.log(`Fetching: ${url}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Status: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

// Try search API for vehicle albums
async function searchVehicleAlbums(brand) {
  try {
    // Search for album names containing vehicle keywords
    const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/search?scheme=album&keyword=${brand}+vehicle&limit=50`;
    console.log(`Searching: ${url}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Status: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

// Try public album listing
async function fetchPublicAlbums() {
  try {
    const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/album`;
    console.log(`Fetching public albums: ${url}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Status: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

async function run() {
  console.log('=== Discovering WheelPros Canto Albums ===\n');
  
  // Try public album listing first
  console.log('1. Fetching public album listing...');
  const publicAlbums = await fetchPublicAlbums();
  if (publicAlbums) {
    console.log(`   Found ${publicAlbums.found || publicAlbums.length || 'unknown'} albums`);
    if (publicAlbums.results) {
      console.log('   Sample albums:');
      publicAlbums.results.slice(0, 10).forEach(a => {
        console.log(`     - ${a.name || a.displayName}: ${a.id || a.scheme}`);
      });
    }
  }
  
  console.log('\n2. Testing known Fuel album paths...');
  // Test a known Fuel album
  const testUrl = `${CANTO_BASE}/rest/v/${PORTAL_ID}/album/IRNPK`;
  console.log(`Testing: ${testUrl}`);
  try {
    const res = await fetch(testUrl);
    console.log(`   Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`   Album name: ${data.name}`);
      console.log(`   Asset count: ${data.found || data.results?.length || 'unknown'}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Search for brand-specific albums
  console.log('\n3. Searching for brand albums...');
  for (const brand of ['KMC', 'XD', 'MOTO METAL', 'BLACK RHINO']) {
    console.log(`\n   Searching for ${brand}...`);
    const results = await searchVehicleAlbums(brand);
    if (results?.results?.length) {
      console.log(`   Found ${results.results.length} results`);
      results.results.slice(0, 5).forEach(r => {
        console.log(`     - ${r.name}: ${r.id || r.scheme}`);
      });
    }
  }
}

run().catch(console.error);
