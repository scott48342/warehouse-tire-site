/**
 * Discover WheelPros Canto albums - V2
 * Uses the REST API to explore the album structure
 */

const CANTO_BASE = 'https://wheelpros.canto.com';
const PORTAL_ID = 'WheelPros';

// Fetch album content by path code
async function fetchAlbum(pathCode) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/album/${pathCode}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// Fetch folder tree
async function fetchTree() {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/tree`;
  console.log(`Fetching tree: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  Status: ${res.status}`);
    return null;
  }
  return res.json();
}

// Fetch folder children
async function fetchFolder(folderPath) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/folder/${folderPath}`;
  console.log(`Fetching folder: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  Status: ${res.status}`);
    return null;
  }
  return res.json();
}

// Fetch all albums in a folder
async function fetchFolderAlbums(folderPath) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/folder/${folderPath}/subalbums?limit=1000`;
  console.log(`Fetching folder albums: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  Status: ${res.status}`);
    return null;
  }
  return res.json();
}

// Browse with cursor
async function browseAlbums(limit = 100, sortBy = 'name') {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/album?limit=${limit}&sortBy=${sortBy}`;
  console.log(`Browsing albums: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  Status: ${res.status}`);
    return null;
  }
  return res.json();
}

// Search albums
async function searchAlbums(keyword) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/search/album?keyword=${encodeURIComponent(keyword)}&limit=100`;
  console.log(`Searching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  Status: ${res.status}`);
    return null;
  }
  return res.json();
}

async function run() {
  console.log('=== Canto Album Discovery V2 ===\n');
  
  // 1. Try to get tree structure
  console.log('1. Fetching folder tree...');
  const tree = await fetchTree();
  if (tree?.results) {
    console.log(`   Found ${tree.results.length} root folders:`);
    tree.results.slice(0, 20).forEach(f => {
      console.log(`   - ${f.name || f.displayName} (${f.id || f.scheme})`);
    });
  } else if (tree) {
    console.log('   Tree response:', JSON.stringify(tree).slice(0, 500));
  }
  
  // 2. Try browsing albums
  console.log('\n2. Browsing albums...');
  const albums = await browseAlbums(200);
  if (albums?.results) {
    console.log(`   Found ${albums.found || albums.results.length} albums`);
    
    // Group by brand keywords
    const brandCounts = { fuel: 0, kmc: 0, xd: 0, motoMetal: 0, blackRhino: 0, asanti: 0, other: 0 };
    const brandAlbums = { fuel: [], kmc: [], xd: [], motoMetal: [], blackRhino: [], asanti: [], other: [] };
    
    for (const album of albums.results) {
      const name = (album.name || album.displayName || '').toUpperCase();
      const id = album.id || album.scheme;
      
      if (name.includes('FUEL') || /^(REBEL|BLITZ|COVERT|VAPOR|ASSAULT|MAVERICK|HOSTAGE|SLEDGE|KRANK|VECTOR)\s/.test(name)) {
        brandCounts.fuel++;
        brandAlbums.fuel.push({ name: album.name || album.displayName, path: id });
      } else if (name.includes('KMC') || /^(KM\d|IMPACT|SLIDE|MESA)\s/.test(name)) {
        brandCounts.kmc++;
        brandAlbums.kmc.push({ name: album.name || album.displayName, path: id });
      } else if (name.includes('XD') || /^(XD\d|ROCKSTAR|MONSTER|GRENADE)\s/.test(name)) {
        brandCounts.xd++;
        brandAlbums.xd.push({ name: album.name || album.displayName, path: id });
      } else if (name.includes('MOTO') || name.includes('MO ') || /^(MO\d)\s/.test(name)) {
        brandCounts.motoMetal++;
        brandAlbums.motoMetal.push({ name: album.name || album.displayName, path: id });
      } else if (name.includes('BLACK RHINO') || name.includes('RHINO') || /^(TANAY|BARSTOW|BOXER|PRIMM|CHAMBER)\s/.test(name)) {
        brandCounts.blackRhino++;
        brandAlbums.blackRhino.push({ name: album.name || album.displayName, path: id });
      } else if (name.includes('ASANTI') || /^(ABL-|AF-)\s/.test(name)) {
        brandCounts.asanti++;
        brandAlbums.asanti.push({ name: album.name || album.displayName, path: id });
      } else {
        brandCounts.other++;
        if (brandAlbums.other.length < 20) {
          brandAlbums.other.push({ name: album.name || album.displayName, path: id });
        }
      }
    }
    
    console.log('\n   Albums by brand:');
    console.log(`     Fuel: ${brandCounts.fuel}`);
    console.log(`     KMC: ${brandCounts.kmc}`);
    console.log(`     XD: ${brandCounts.xd}`);
    console.log(`     Moto Metal: ${brandCounts.motoMetal}`);
    console.log(`     Black Rhino: ${brandCounts.blackRhino}`);
    console.log(`     Asanti: ${brandCounts.asanti}`);
    console.log(`     Other: ${brandCounts.other}`);
    
    // Show samples from each brand
    for (const [brand, albumList] of Object.entries(brandAlbums)) {
      if (albumList.length > 0 && brand !== 'other') {
        console.log(`\n   ${brand.toUpperCase()} samples:`);
        albumList.slice(0, 5).forEach(a => {
          console.log(`     - ${a.name}: ${a.path}`);
        });
      }
    }
    
    // Show other samples
    if (brandAlbums.other.length > 0) {
      console.log('\n   OTHER samples (unclassified):');
      brandAlbums.other.slice(0, 10).forEach(a => {
        console.log(`     - ${a.name}: ${a.path}`);
      });
    }
    
  } else if (albums) {
    console.log('   Response:', JSON.stringify(albums).slice(0, 1000));
  }
  
  // 3. Try specific search for brands
  console.log('\n3. Searching for specific brands...');
  for (const keyword of ['KMC FORD', 'XD SERIES', 'MOTO METAL', 'BLACK RHINO']) {
    console.log(`\n   Searching "${keyword}"...`);
    const results = await searchAlbums(keyword);
    if (results?.results?.length) {
      console.log(`   Found ${results.found || results.results.length} results:`);
      results.results.slice(0, 5).forEach(a => {
        console.log(`     - ${a.name || a.displayName}: ${a.id || a.scheme}`);
      });
    }
  }
}

run().catch(console.error);
