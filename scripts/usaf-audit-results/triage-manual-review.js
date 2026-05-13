/**
 * Manual Review Triage/Compression Report
 * Groups 3,460 manual review items into decision buckets
 */
const fs = require('fs');
const path = require('path');

// Load all batch files
const manualReviewItems = [];
for (let i = 1; i <= 10; i++) {
  const f = `batch-${String(i).padStart(2, '0')}.json`;
  const filePath = path.join(__dirname, f);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // manualReviewRequired is the array with all manual review items
    if (data.manualReviewRequired) {
      manualReviewItems.push(...data.manualReviewRequired);
    }
  }
}

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`MANUAL REVIEW TRIAGE REPORT`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
console.log(`Total raw manual review items: ${manualReviewItems.length}`);

// Analyze item structure
if (manualReviewItems.length > 0) {
  console.log('\nSample item keys:', Object.keys(manualReviewItems[0]));
  console.log('Sample item:', JSON.stringify(manualReviewItems[0], null, 2).slice(0, 1000));
}

// GROUP 1: By Make/Model
const byMakeModel = {};
for (const item of manualReviewItems) {
  const key = `${item.make}|${item.model}`;
  if (!byMakeModel[key]) byMakeModel[key] = [];
  byMakeModel[key].push(item);
}
console.log(`\nUnique Make/Model combinations: ${Object.keys(byMakeModel).length}`);

// GROUP 2: By issue type (reason patterns)
const byIssueType = {};
for (const item of manualReviewItems) {
  const reasons = item.reasons || [];
  const autoReject = item.autoReject || [];
  const issueKey = [...reasons, ...autoReject].sort().join('|') || 'unknown';
  if (!byIssueType[issueKey]) byIssueType[issueKey] = [];
  byIssueType[issueKey].push(item);
}
console.log(`Unique issue type combinations: ${Object.keys(byIssueType).length}`);

// GROUP 3: By tire size pattern (diameter only)
const byDiameter = {};
for (const item of manualReviewItems) {
  const diam = item.wheelDiameter || 'unknown';
  if (!byDiameter[diam]) byDiameter[diam] = [];
  byDiameter[diam].push(item);
}
console.log(`Unique wheel diameters: ${Object.keys(byDiameter).length}`);

// GROUP 4: By year range (decade)
const byDecade = {};
for (const item of manualReviewItems) {
  const decade = Math.floor(item.year / 10) * 10;
  const key = `${decade}s`;
  if (!byDecade[key]) byDecade[key] = [];
  byDecade[key].push(item);
}
console.log(`Year ranges: ${Object.keys(byDecade).join(', ')}`);

// GROUP 5: By staggered status
const byStaggered = { staggered: [], nonStaggered: [] };
for (const item of manualReviewItems) {
  if (item.vehicleFlags?.isStaggered) {
    byStaggered.staggered.push(item);
  } else {
    byStaggered.nonStaggered.push(item);
  }
}
console.log(`Staggered: ${byStaggered.staggered.length}, Non-staggered: ${byStaggered.nonStaggered.length}`);

// GROUP 6: By HD/DRW/SRW
const byHD = { hd: [], regular: [] };
for (const item of manualReviewItems) {
  if (item.vehicleFlags?.isHDTruck) {
    byHD.hd.push(item);
  } else {
    byHD.regular.push(item);
  }
}
console.log(`HD trucks: ${byHD.hd.length}, Regular: ${byHD.regular.length}`);

// GROUP 7: By new wheel diameter pattern
const byNewDiamPattern = {};
for (const item of manualReviewItems) {
  const existing = item.existingDiameters || [];
  const proposed = item.wheelDiameter;
  const isNew = !existing.includes(proposed);
  const key = isNew ? 'NEW_DIAMETER' : 'EXISTING_DIAMETER';
  if (!byNewDiamPattern[key]) byNewDiamPattern[key] = [];
  byNewDiamPattern[key].push(item);
}
console.log(`New diameter: ${byNewDiamPattern.NEW_DIAMETER?.length || 0}, Existing diameter: ${byNewDiamPattern.EXISTING_DIAMETER?.length || 0}`);

// Now create the COMPRESSED BUCKETS
console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`COMPRESSION ANALYSIS`);
console.log(`═══════════════════════════════════════════════════════════════════════`);

// Create composite buckets: Make|Model|IssuePattern|DiameterStatus|StaggeredStatus
const buckets = {};
for (const item of manualReviewItems) {
  const makeModel = `${item.make}|${item.model}`;
  
  // Classify issue type
  const reasons = item.reasons || [];
  const autoReject = item.autoReject || [];
  let issueType = 'UNKNOWN';
  
  // Check for specific patterns in reasons
  const allReasons = [...reasons, ...autoReject].join(' ').toLowerCase();
  
  if (allReasons.includes('staggered')) issueType = 'STAGGERED_COMPLEXITY';
  else if (allReasons.includes('hd') || allReasons.includes('heavy duty') || allReasons.includes('drw') || allReasons.includes('srw')) issueType = 'HD_TRUCK_COMPLEXITY';
  else if (allReasons.includes('new diameter') || allReasons.includes('adds new')) issueType = 'NEW_DIAMETER_ADDITION';
  else if (allReasons.includes('low confidence') || (item.confidence && item.confidence < 70)) issueType = 'LOW_CONFIDENCE';
  else if (allReasons.includes('format') || allReasons.includes('non-standard')) issueType = 'FORMAT_ISSUE';
  else if (allReasons.includes('performance') || allReasons.includes('ev')) issueType = 'SPECIAL_VEHICLE';
  else if (allReasons.includes('config') || allReasons.includes('trim')) issueType = 'CONFIG_TABLE_NEEDED';
  else issueType = 'GENERAL_REVIEW';

  // Diameter status
  const existing = item.existingDiameters || [];
  const proposed = item.wheelDiameter;
  const diamStatus = existing.includes(proposed) ? 'EXISTING_DIAM' : 'NEW_DIAM';
  
  // Year range
  const yearRange = `${Math.floor(item.year / 5) * 5}-${Math.floor(item.year / 5) * 5 + 4}`;
  
  // Staggered
  const staggered = item.vehicleFlags?.isStaggered ? 'STAGGERED' : 'SQUARE';
  
  // HD
  const hd = item.vehicleFlags?.isHDTruck ? 'HD' : 'STANDARD';
  
  // Composite key
  const bucketKey = `${makeModel}|${issueType}|${diamStatus}|${staggered}|${hd}|${yearRange}`;
  
  if (!buckets[bucketKey]) {
    buckets[bucketKey] = {
      make: item.make,
      model: item.model,
      issueType,
      diameterStatus: diamStatus,
      staggered,
      hdStatus: hd,
      yearRange,
      items: [],
      tireSizes: new Set(),
      diameters: new Set()
    };
  }
  buckets[bucketKey].items.push(item);
  buckets[bucketKey].tireSizes.add(item.tireSize);
  buckets[bucketKey].diameters.add(item.wheelDiameter);
}

// Convert sets to arrays and count
const sortedBuckets = Object.entries(buckets)
  .map(([key, data]) => ({
    key,
    make: data.make,
    model: data.model,
    issueType: data.issueType,
    diameterStatus: data.diameterStatus,
    staggered: data.staggered,
    hdStatus: data.hdStatus,
    yearRange: data.yearRange,
    count: data.items.length,
    uniqueTireSizes: data.tireSizes.size,
    diameters: Array.from(data.diameters).sort((a,b) => a-b),
    sampleTireSizes: Array.from(data.tireSizes).slice(0, 5)
  }))
  .sort((a, b) => b.count - a.count);

console.log(`\nTotal compressed buckets: ${sortedBuckets.length}`);

// Classify buckets into decision categories
const decisionCategories = {
  bulkSafeAfterSample: [],   // Large groups, existing diameter, low complexity
  needsExternalValidation: [], // Performance vehicles, EVs, special cases
  ignoreAsUsafNoise: [],      // Very low confidence, weird formats
  needsPlatformRule: [],      // HD trucks, staggered setups needing config
  trueManualOneOff: []        // Small groups (1-2 items), unique cases
};

for (const bucket of sortedBuckets) {
  if (bucket.count === 1) {
    decisionCategories.trueManualOneOff.push(bucket);
  } else if (bucket.issueType === 'HD_TRUCK_COMPLEXITY' || bucket.issueType === 'STAGGERED_COMPLEXITY') {
    decisionCategories.needsPlatformRule.push(bucket);
  } else if (bucket.issueType === 'SPECIAL_VEHICLE') {
    decisionCategories.needsExternalValidation.push(bucket);
  } else if (bucket.issueType === 'FORMAT_ISSUE' || bucket.issueType === 'LOW_CONFIDENCE') {
    decisionCategories.ignoreAsUsafNoise.push(bucket);
  } else if (bucket.count >= 3 && bucket.diameterStatus === 'EXISTING_DIAM') {
    decisionCategories.bulkSafeAfterSample.push(bucket);
  } else if (bucket.count >= 3) {
    decisionCategories.needsExternalValidation.push(bucket);
  } else {
    decisionCategories.trueManualOneOff.push(bucket);
  }
}

// Count items in each category
const categoryCounts = {
  bulkSafeAfterSample: decisionCategories.bulkSafeAfterSample.reduce((a, b) => a + b.count, 0),
  needsExternalValidation: decisionCategories.needsExternalValidation.reduce((a, b) => a + b.count, 0),
  ignoreAsUsafNoise: decisionCategories.ignoreAsUsafNoise.reduce((a, b) => a + b.count, 0),
  needsPlatformRule: decisionCategories.needsPlatformRule.reduce((a, b) => a + b.count, 0),
  trueManualOneOff: decisionCategories.trueManualOneOff.reduce((a, b) => a + b.count, 0)
};

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`DECISION BUCKETS`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
console.log(`\n📦 Bulk-safe after one sample review: ${categoryCounts.bulkSafeAfterSample} items in ${decisionCategories.bulkSafeAfterSample.length} buckets`);
console.log(`🔍 Needs external validation: ${categoryCounts.needsExternalValidation} items in ${decisionCategories.needsExternalValidation.length} buckets`);
console.log(`🗑️  Ignore as USAF noise: ${categoryCounts.ignoreAsUsafNoise} items in ${decisionCategories.ignoreAsUsafNoise.length} buckets`);
console.log(`⚙️  Needs platform rule: ${categoryCounts.needsPlatformRule} items in ${decisionCategories.needsPlatformRule.length} buckets`);
console.log(`👤 True manual one-off: ${categoryCounts.trueManualOneOff} items in ${decisionCategories.trueManualOneOff.length} buckets`);

const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
console.log(`\nTotal categorized: ${totalCategorized} / ${manualReviewItems.length}`);

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`TOP 50 BUCKETS BY COUNT`);
console.log(`═══════════════════════════════════════════════════════════════════════`);

for (let i = 0; i < Math.min(50, sortedBuckets.length); i++) {
  const b = sortedBuckets[i];
  console.log(`\n${i + 1}. [${b.count} items] ${b.make} ${b.model} (${b.yearRange})`);
  console.log(`   Issue: ${b.issueType} | Diameter: ${b.diameterStatus} | ${b.staggered} | ${b.hdStatus}`);
  console.log(`   Wheel sizes: ${b.diameters.map(d => d + '"').join(', ')}`);
  console.log(`   Sample tire sizes: ${b.sampleTireSizes.join(', ')}`);
}

// Estimate true manual reviews needed
const estimatedManualReviews = 
  decisionCategories.bulkSafeAfterSample.length +  // One sample per bucket
  decisionCategories.needsExternalValidation.length + // One check per bucket
  (decisionCategories.needsPlatformRule.length * 2) + // Need rule + verify
  decisionCategories.trueManualOneOff.length; // Each one-off

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`ESTIMATED EFFORT`);
console.log(`═══════════════════════════════════════════════════════════════════════`);
console.log(`\nEstimated true manual reviews needed: ${estimatedManualReviews}`);
console.log(`Compression ratio: ${(3460 / estimatedManualReviews).toFixed(1)}x`);

console.log(`\n═══════════════════════════════════════════════════════════════════════`);
console.log(`CANDIDATE BULK RULES`);
console.log(`═══════════════════════════════════════════════════════════════════════`);

// Find rules that could clear large groups
const bulkRuleCandidates = [];

// Rule 1: Existing diameter + high item count = likely safe
const existingDiamBuckets = sortedBuckets.filter(b => b.diameterStatus === 'EXISTING_DIAM' && b.count >= 5);
const existingDiamTotal = existingDiamBuckets.reduce((a, b) => a + b.count, 0);
bulkRuleCandidates.push({
  rule: 'EXISTING_DIAMETER_BULK_APPROVE',
  description: 'Auto-approve items that add tire size to existing wheel diameter',
  criteria: 'diameterStatus=EXISTING_DIAM AND count>=5',
  bucketsAffected: existingDiamBuckets.length,
  itemsCleared: existingDiamTotal,
  sampleBuckets: existingDiamBuckets.slice(0, 5).map(b => `${b.make} ${b.model} (${b.count})`)
});

// Rule 2: Non-staggered, non-HD, standard vehicles
const standardVehicles = sortedBuckets.filter(b => 
  b.staggered === 'SQUARE' && 
  b.hdStatus === 'STANDARD' && 
  b.issueType === 'GENERAL_REVIEW' &&
  b.count >= 3
);
const standardTotal = standardVehicles.reduce((a, b) => a + b.count, 0);
bulkRuleCandidates.push({
  rule: 'STANDARD_VEHICLE_BULK_APPROVE',
  description: 'Auto-approve standard vehicles (non-staggered, non-HD, general review)',
  criteria: 'staggered=SQUARE AND hdStatus=STANDARD AND issueType=GENERAL_REVIEW AND count>=3',
  bucketsAffected: standardVehicles.length,
  itemsCleared: standardTotal,
  sampleBuckets: standardVehicles.slice(0, 5).map(b => `${b.make} ${b.model} (${b.count})`)
});

// Rule 3: Same make/model across multiple year ranges (platform consistency)
const makeModelGroups = {};
for (const b of sortedBuckets) {
  const mm = `${b.make}|${b.model}`;
  if (!makeModelGroups[mm]) makeModelGroups[mm] = { buckets: [], totalItems: 0 };
  makeModelGroups[mm].buckets.push(b);
  makeModelGroups[mm].totalItems += b.count;
}
const platformConsistent = Object.entries(makeModelGroups)
  .filter(([_, v]) => v.buckets.length >= 3 && v.totalItems >= 10)
  .sort((a, b) => b[1].totalItems - a[1].totalItems);

bulkRuleCandidates.push({
  rule: 'PLATFORM_CONSISTENCY_RULE',
  description: 'Same make/model appearing in 3+ year ranges with 10+ total items',
  criteria: 'Same Make/Model with >=3 year-range buckets and >=10 total items',
  bucketsAffected: platformConsistent.reduce((a, [_, v]) => a + v.buckets.length, 0),
  itemsCleared: platformConsistent.reduce((a, [_, v]) => a + v.totalItems, 0),
  sampleBuckets: platformConsistent.slice(0, 5).map(([mm, v]) => `${mm.replace('|', ' ')} (${v.totalItems} items, ${v.buckets.length} ranges)`)
});

for (const rule of bulkRuleCandidates) {
  console.log(`\n📋 ${rule.rule}`);
  console.log(`   ${rule.description}`);
  console.log(`   Criteria: ${rule.criteria}`);
  console.log(`   Buckets affected: ${rule.bucketsAffected}`);
  console.log(`   Items clearable: ${rule.itemsCleared}`);
  console.log(`   Sample: ${rule.sampleBuckets.join(', ')}`);
}

// Write full report to file
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalRawManualItems: manualReviewItems.length,
    totalCompressedBuckets: sortedBuckets.length,
    estimatedTrueManualReviews: estimatedManualReviews,
    compressionRatio: (manualReviewItems.length / estimatedManualReviews).toFixed(1) + 'x'
  },
  decisionBuckets: {
    bulkSafeAfterSample: {
      bucketCount: decisionCategories.bulkSafeAfterSample.length,
      itemCount: categoryCounts.bulkSafeAfterSample,
      buckets: decisionCategories.bulkSafeAfterSample.slice(0, 20)
    },
    needsExternalValidation: {
      bucketCount: decisionCategories.needsExternalValidation.length,
      itemCount: categoryCounts.needsExternalValidation,
      buckets: decisionCategories.needsExternalValidation.slice(0, 20)
    },
    ignoreAsUsafNoise: {
      bucketCount: decisionCategories.ignoreAsUsafNoise.length,
      itemCount: categoryCounts.ignoreAsUsafNoise,
      buckets: decisionCategories.ignoreAsUsafNoise.slice(0, 20)
    },
    needsPlatformRule: {
      bucketCount: decisionCategories.needsPlatformRule.length,
      itemCount: categoryCounts.needsPlatformRule,
      buckets: decisionCategories.needsPlatformRule.slice(0, 20)
    },
    trueManualOneOff: {
      bucketCount: decisionCategories.trueManualOneOff.length,
      itemCount: categoryCounts.trueManualOneOff,
      buckets: decisionCategories.trueManualOneOff.slice(0, 20)
    }
  },
  top50Buckets: sortedBuckets.slice(0, 50),
  bulkRuleCandidates,
  allBuckets: sortedBuckets
};

fs.writeFileSync(path.join(__dirname, 'triage-report.json'), JSON.stringify(report, null, 2));
console.log(`\n\n✅ Full report written to triage-report.json`);
