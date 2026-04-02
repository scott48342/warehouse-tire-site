#!/usr/bin/env node
/**
 * Merge new tire image mappings into the main mappings.json file
 * Usage: node merge-mappings.js '[{"p":"ABC123","d":"Description","i":"https://..."}]' "2657017"
 */

const fs = require('fs');
const path = require('path');

const MAPPINGS_FILE = path.join(__dirname, 'mappings.json');

function loadMappings() {
  try {
    return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
  } catch (e) {
    return { lastUpdated: null, sizesSearched: [], mappings: {} };
  }
}

function saveMappings(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2));
}

function merge(newItems, sizeSearched) {
  const data = loadMappings();
  
  let added = 0;
  let updated = 0;
  
  for (const item of newItems) {
    const partNumber = item.p || item.partNumber;
    const imageUrl = item.i || item.imageUrl;
    const description = item.d || item.description || '';
    
    if (!partNumber || !imageUrl) continue;
    
    if (data.mappings[partNumber]) {
      updated++;
    } else {
      added++;
    }
    
    data.mappings[partNumber] = { imageUrl, description };
  }
  
  if (sizeSearched && !data.sizesSearched.includes(sizeSearched)) {
    data.sizesSearched.push(sizeSearched);
  }
  
  saveMappings(data);
  
  console.log(JSON.stringify({
    added,
    updated,
    total: Object.keys(data.mappings).length,
    sizesSearched: data.sizesSearched.length
  }));
}

// Run if called directly
if (require.main === module) {
  const [,, jsonArg, sizeArg] = process.argv;
  if (!jsonArg) {
    console.error('Usage: node merge-mappings.js <json-file-or-array> "sizeCode"');
    process.exit(1);
  }
  
  let items;
  // Check if it's a file path
  if (fs.existsSync(jsonArg)) {
    items = JSON.parse(fs.readFileSync(jsonArg, 'utf8'));
  } else {
    items = JSON.parse(jsonArg);
  }
  merge(items, sizeArg);
}

module.exports = { loadMappings, saveMappings, merge };
