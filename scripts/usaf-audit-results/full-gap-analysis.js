const fs = require('fs');

// Collect all data from all batches
const allSafeAutoFixes = [];
const allLegacyFallback = [];
const allManualReview = [];
const usafOnlyVehicles = [];
const wtdOnlyVehicles = [];
const makeModelGaps = new Map();

for (let i = 1; i <= 10; i++) {
  const batchNum = i.toString().padStart(2, '0');
  try {
    const data = JSON.parse(fs.readFileSync('batch-' + batchNum + '.json', 'utf8'));
    
    // Collect all arrays
    allSafeAutoFixes.push(...(data.safeAutoFixes || []));
    allLegacyFallback.push(...(data.legacyFallbackEnrichments || []));
    allManualReview.push(...(data.manualReviewRequired || []));
    
  } catch(e) {
    console.error('Error reading batch', batchNum, e.message);
  }
}

// Combine all records
const allRecords = [...allSafeAutoFixes, ...allLegacyFallback, ...allManualReview];

console.log('=== TOTAL RECORDS ANALYZED ===');
console.log('Safe auto fixes:', allSafeAutoFixes.length);
console.log('Legacy fallback:', allLegacyFallback.length);
console.log('Manual review:', allManualReview.length);
console.log('Total records:', allRecords.length);

// Analyze for USAF-only (WTD has no sizes, USAF has sizes)
allRecords.forEach(item => {
  const wtdEmpty = !item.existingWtdSizes || item.existingWtdSizes.length === 0;
  const usafEmpty = !item.existingUsafSizes || item.existingUsafSizes.length === 0;
  
  if (wtdEmpty && !usafEmpty) {
    usafOnlyVehicles.push(item);
    const key = item.make + '|' + item.model;
    if (!makeModelGaps.has(key)) {
      makeModelGaps.set(key, { make: item.make, model: item.model, years: [], sizes: new Set() });
    }
    makeModelGaps.get(key).years.push(item.year);
    item.existingUsafSizes.forEach(s => makeModelGaps.get(key).sizes.add(s));
  }
  
  if (!wtdEmpty && usafEmpty) {
    wtdOnlyVehicles.push(item);
  }
});

console.log('\n=== COVERAGE GAPS ===');
console.log('USAF-only vehicles (WTD missing):', usafOnlyVehicles.length);
console.log('WTD-only vehicles (USAF missing):', wtdOnlyVehicles.length);

// Deduplicate usafOnly by year/make/model
const uniqueUsafOnly = new Map();
usafOnlyVehicles.forEach(v => {
  const key = v.year + '|' + v.make + '|' + v.model;
  if (!uniqueUsafOnly.has(key)) {
    uniqueUsafOnly.set(key, v);
  }
});

console.log('\n=== UNIQUE USAF-ONLY VEHICLES (WTD MISSING) ===');
console.log('Total unique:', uniqueUsafOnly.size);

// Group by make/model
console.log('\n--- By Make/Model ---');
const groupedUsafOnly = new Map();
uniqueUsafOnly.forEach(v => {
  const key = v.make + ' ' + v.model;
  if (!groupedUsafOnly.has(key)) {
    groupedUsafOnly.set(key, { years: [], sizes: new Set() });
  }
  groupedUsafOnly.get(key).years.push(v.year);
  v.existingUsafSizes.forEach(s => groupedUsafOnly.get(key).sizes.add(s));
});

const sortedGroups = Array.from(groupedUsafOnly.entries())
  .sort((a, b) => b[1].years.length - a[1].years.length);

sortedGroups.forEach(([makeModel, data]) => {
  const yearRange = data.years.sort((a,b) => a-b);
  const minYear = yearRange[0];
  const maxYear = yearRange[yearRange.length - 1];
  console.log(makeModel + ' (' + minYear + '-' + maxYear + '):', Array.from(data.sizes).join(', '));
});

// Look for patterns - missing makes
console.log('\n\n=== PATTERN ANALYSIS ===');
const makeBreakdown = new Map();
uniqueUsafOnly.forEach(v => {
  const make = v.make.toLowerCase();
  if (!makeBreakdown.has(make)) {
    makeBreakdown.set(make, { count: 0, models: new Set(), years: [] });
  }
  makeBreakdown.get(make).count++;
  makeBreakdown.get(make).models.add(v.model.toLowerCase());
  makeBreakdown.get(make).years.push(v.year);
});

console.log('\n--- Missing by Make ---');
Array.from(makeBreakdown.entries())
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([make, data]) => {
    const models = Array.from(data.models).join(', ');
    const yearRange = data.years.sort((a,b) => a-b);
    console.log(make + ': ' + data.count + ' vehicles | Models: ' + models + ' | Years: ' + yearRange[0] + '-' + yearRange[yearRange.length-1]);
  });

// Year distribution for WTD-only
console.log('\n\n=== WTD-ONLY (USAF CANNOT COVER) ===');
console.log('Total WTD-only records:', wtdOnlyVehicles.length);

// Sample WTD-only vehicles
if (wtdOnlyVehicles.length > 0) {
  console.log('\nSample WTD-only vehicles (first 20):');
  wtdOnlyVehicles.slice(0, 20).forEach(v => {
    console.log(v.year, v.make, v.model, '| WTD sizes:', (v.existingWtdSizes || []).join(', '));
  });
}

// Output top 100 missing candidates
console.log('\n\n=== TOP 100 MISSING VEHICLE CANDIDATES ===');
console.log('Year | Make | Model | USAF Tire Sizes');
console.log('-----+------+-------+----------------');

let count = 0;
Array.from(uniqueUsafOnly.values())
  .sort((a, b) => b.year - a.year)
  .forEach(v => {
    if (count < 100) {
      console.log(v.year + ' | ' + v.make + ' | ' + v.model + ' | ' + v.existingUsafSizes.join(', '));
      count++;
    }
  });
