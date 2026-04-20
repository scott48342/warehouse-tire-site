/**
 * Extract album paths from WheelPros Canto portal
 * Uses REST API to fetch folder contents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CANTO_BASE = 'https://wheelpros.canto.com';
const PORTAL_ID = 'WheelPros';

// Known folder paths from browser exploration (need to discover these)
// Format: folder/{path}
async function fetchFolderContents(folderPath) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/folder/${folderPath}?sortBy=name&limit=1000`;
  console.log(`Fetching: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

// Fetch all albums in a folder
async function fetchFolderAlbums(folderPath) {
  // Canto uses subalbums endpoint
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/folder/${folderPath}/subalbums?sortBy=name&limit=1000`;
  console.log(`Fetching albums: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    
    if (data.results) {
      return data.results.map(r => ({
        name: r.name || r.displayName,
        path: r.id || r.scheme
      }));
    }
    return [];
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return [];
  }
}

// Get folder tree/children
async function fetchFolderTree(folderPath) {
  const url = `${CANTO_BASE}/rest/v/${PORTAL_ID}/folder/${folderPath}?sortBy=name&limit=100`;
  console.log(`Fetching tree: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  Error: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

// Search for albums by keyword
async function searchAlbums(keyword) {
  const url = `${CANTO_BASE}/api/v1/search?keyword=${encodeURIComponent(keyword)}&scheme=album&limit=200`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    
    if (data.results) {
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
  console.log('=== Extracting Brand Albums ===\n');
  
  // Known folder paths from the Canto browser exploration
  // We saw: /folder/M6QU7 for KM549 Ford F150
  // Need to find parent folder paths for each brand's Vehicles folder
  
  // Try to fetch the KMC folder to find Vehicles subfolder path
  console.log('Exploring KMC folder structure...');
  
  // Try different folder approaches
  const approaches = [
    { brand: 'KMC', path: 'KMC' },
    { brand: 'KMC', path: 'N68AG' },  // From browser URL for KMC/Vehicles
    { brand: 'XD', path: 'XD' },
    { brand: 'MOTO METAL', path: 'MOTO_METAL' },
    { brand: 'BLACK RHINO', path: 'BLACK_RHINO' },
  ];
  
  for (const { brand, path: folderPath } of approaches) {
    console.log(`\n=== ${brand} (folder: ${folderPath}) ===`);
    
    // Try folder contents
    const contents = await fetchFolderTree(folderPath);
    if (contents) {
      console.log('Found folder contents:');
      if (contents.results) {
        contents.results.slice(0, 10).forEach(r => {
          console.log(`  ${r.scheme || 'folder'}: ${r.name || r.displayName} (${r.id})`);
        });
      } else {
        console.log('  Response:', JSON.stringify(contents).slice(0, 500));
      }
    }
    
    // Try albums endpoint
    const albums = await fetchFolderAlbums(folderPath);
    if (albums.length > 0) {
      console.log(`Found ${albums.length} albums:`);
      albums.slice(0, 10).forEach(a => console.log(`  ${a.name}: ${a.path}`));
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Search approach - try searching for specific wheel+vehicle combos
  console.log('\n=== Search approach ===');
  const searchTerms = [
    'KM549 Ford',
    'XD820 Ford',
    'MO970 Ford',
    'ARMORY Ford'
  ];
  
  for (const term of searchTerms) {
    console.log(`\nSearching: "${term}"`);
    const results = await searchAlbums(term);
    if (results.length > 0) {
      console.log(`  Found ${results.length} albums:`);
      results.slice(0, 5).forEach(r => console.log(`    ${r.name}: ${r.path}`));
    } else {
      console.log('  No results');
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

run().catch(console.error);
