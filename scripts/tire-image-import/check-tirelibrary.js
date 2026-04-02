#!/usr/bin/env node
/**
 * Quick check if TireLibrary has images for common off-road tire patterns
 */

const TIRELIBRARY_BASE = 'https://tireweb.tirelibrary.com/images/Products';

// Common off-road pattern IDs (guessing based on popular brands)
// These are TireLibrary patternIds - need to find real ones
const testPatternIds = [
  // Will test a few known IDs
  1000, 2000, 3000, 5000, 10000, 15000, 20000
];

async function checkImage(patternId) {
  const url = `${TIRELIBRARY_BASE}/${patternId}.jpg`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { patternId, exists: res.ok, status: res.status };
  } catch (e) {
    return { patternId, exists: false, error: e.message };
  }
}

async function main() {
  console.log('Checking TireLibrary image availability...\n');
  
  for (const id of testPatternIds) {
    const result = await checkImage(id);
    console.log(`Pattern ${id}: ${result.exists ? '✓ EXISTS' : `✗ ${result.status || result.error}`}`);
  }
  
  // Also try to hit the site's API to get actual patternIds
  console.log('\n--- Checking via site API ---\n');
  
  try {
    const res = await fetch('http://localhost:3001/api/tires/search?size=33125020&_tirewire=1');
    if (res.ok) {
      const data = await res.json();
      console.log(`API returned ${data.results?.length || 0} results`);
    }
  } catch (e) {
    console.log('Site API not available locally');
  }
}

main().catch(console.error);
