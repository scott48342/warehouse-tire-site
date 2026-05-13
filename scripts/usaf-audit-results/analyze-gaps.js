const fs = require('fs');

// Collect all data from all batches
const allUsafOnly = [];
const allWtdOnly = [];
const allManualReview = [];
const batchSummaries = [];

for (let i = 1; i <= 10; i++) {
  const batchNum = i.toString().padStart(2, '0');
  const filePath = 'batch-' + batchNum + '.json';
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    batchSummaries.push({
      batch: batchNum,
      total: data.summary.totalVehicles,
      exactMatch: data.summary.exactMatch,
      partialMatch: data.summary.partialMatch,
      wtdOnly: data.summary.wtdOnly,
      usafOnly: data.summary.usafOnly,
      safeAutoFix: data.summary.safeAutoFixCount,
      legacyFallback: data.summary.legacyFallbackCount,
      manualReview: data.summary.manualReviewCount
    });
    
    // Look for usafOnly vehicles
    if (data.usafOnlyVehicles && Array.isArray(data.usafOnlyVehicles)) {
      allUsafOnly.push(...data.usafOnlyVehicles);
    }
    
    // Look for wtdOnly vehicles  
    if (data.wtdOnlyVehicles && Array.isArray(data.wtdOnlyVehicles)) {
      allWtdOnly.push(...data.wtdOnlyVehicles);
    }
    
    // Look in manualReview for usafOnly candidates
    if (data.manualReview && Array.isArray(data.manualReview)) {
      data.manualReview.forEach(item => {
        if (item.category === 'usaf_only' || item.matchType === 'usafOnly') {
          allUsafOnly.push(item);
        }
        if (item.category === 'wtd_only' || item.matchType === 'wtdOnly') {
          allWtdOnly.push(item);
        }
        allManualReview.push(item);
      });
    }
    
    // Check all keys for any arrays containing vehicle data
    const keys = Object.keys(data);
    keys.forEach(key => {
      if (key !== 'summary' && Array.isArray(data[key])) {
        const sample = data[key][0];
        if (sample && sample.matchType === 'usafOnly') {
          data[key].forEach(v => {
            if (v.matchType === 'usafOnly') {
              allUsafOnly.push(v);
            }
          });
        }
        if (sample && sample.matchType === 'wtdOnly') {
          data[key].forEach(v => {
            if (v.matchType === 'wtdOnly') {
              allWtdOnly.push(v);
            }
          });
        }
      }
    });
    
  } catch(e) {
    console.error('Error reading', filePath, e.message);
  }
}

console.log('=== BATCH SUMMARIES ===');
console.table(batchSummaries);

// Calculate totals
const totals = batchSummaries.reduce((acc, b) => ({
  total: acc.total + b.total,
  exactMatch: acc.exactMatch + b.exactMatch,
  partialMatch: acc.partialMatch + b.partialMatch,
  wtdOnly: acc.wtdOnly + b.wtdOnly,
  usafOnly: acc.usafOnly + b.usafOnly,
  safeAutoFix: acc.safeAutoFix + b.safeAutoFix,
  legacyFallback: acc.legacyFallback + b.legacyFallback,
  manualReview: acc.manualReview + b.manualReview
}), {total: 0, exactMatch: 0, partialMatch: 0, wtdOnly: 0, usafOnly: 0, safeAutoFix: 0, legacyFallback: 0, manualReview: 0});

console.log('\n=== TOTALS ===');
console.log(JSON.stringify(totals, null, 2));

console.log('\n=== ARRAYS FOUND ===');
console.log('USAF-Only vehicles collected:', allUsafOnly.length);
console.log('WTD-Only vehicles collected:', allWtdOnly.length);
console.log('Manual review items collected:', allManualReview.length);

// Show sample structure
if (allUsafOnly.length > 0) {
  console.log('\nSample USAF-Only vehicle:');
  console.log(JSON.stringify(allUsafOnly[0], null, 2));
}

if (allManualReview.length > 0) {
  console.log('\nSample manual review item:');
  console.log(JSON.stringify(allManualReview[0], null, 2));
  
  // Count categories in manual review
  const categories = {};
  allManualReview.forEach(item => {
    const cat = item.category || item.matchType || 'unknown';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('\nManual review categories:');
  console.log(JSON.stringify(categories, null, 2));
}
